import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { searchLocations, getLocation, cqcLocationToLead, type CqcSearchParams } from "@/lib/cqc";
import { scoreLead } from "@/lib/scoring";
import { autoEnroll } from "@/lib/cadence";

// Preview: return matching locations without importing.
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { mode, params, maxPages } = (await req.json()) as {
      mode: "search" | "import";
      params: CqcSearchParams;
      maxPages?: number;
    };

    if (mode === "search") {
      const result = await searchLocations({ ...params, perPage: 25 });
      return NextResponse.json(result);
    }

    // IMPORT — paginate through results, dedupe by cqcLocationId
    const job = await prisma.importJob.create({
      data: {
        source: "CQC",
        status: "RUNNING",
        query: params as object,
        createdById: user.id,
      },
    });

    const pageCap = Math.min(maxPages ?? 20, 100);
    let imported = 0;
    let duplicates = 0;
    let failed = 0;
    let total = 0;
    const errors: string[] = [];
    const importedLeadIds: string[] = [];

    const defaultStage = await prisma.pipelineStage.findFirst({ where: { isDefault: true } });

    try {
      let page = 1;
      let totalPages = 1;
      do {
        const batch = await searchLocations({ ...params, page, perPage: 100 });
        total = batch.total;
        totalPages = Math.min(batch.totalPages, pageCap);

        for (const loc of batch.locations) {
          if (!loc.locationId) continue;
          // Summary only has id/name/postcode — fetch full detail for real data
          let fullLoc = loc;
          try {
            fullLoc = await getLocation(loc.locationId);
          } catch {
            // use summary if detail fetch fails
          }
          const mapped = cqcLocationToLead(fullLoc);
          try {
              const existing = await prisma.lead.findUnique({
              where: { cqcLocationId: fullLoc.locationId },
            });
            if (existing) {
              // Refresh CQC-sourced fields on existing records
              await prisma.lead.update({
                where: { id: existing.id },
                data: {
                  cqcRating: mapped.cqcRating,
                  cqcRatedAt: mapped.cqcRatedAt,
                  beds: mapped.beds ?? existing.beds,
                  phone: existing.phone || mapped.phone,
                  website: existing.website || mapped.website,
                  providerName: existing.providerName || mapped.providerName,
                },
              });
              duplicates++;
              continue;
            }
            const lead = await prisma.lead.create({
              data: {
                ...mapped,
                stageId: defaultStage?.id ?? null,
                score: scoreLead(mapped),
              },
            });
            importedLeadIds.push(lead.id);
            await autoEnroll(lead.id);
            imported++;
          } catch (err) {
            failed++;
            if (errors.length < 10) {
              errors.push(`${fullLoc.locationName}: ${err instanceof Error ? err.message : "error"}`);
            }
          }
        }
        page++;
      } while (page <= totalPages);

      await prisma.importJobLead.createMany({
        data: importedLeadIds.map((leadId) => ({ importJobId: job.id, leadId })),
      });

      await prisma.importJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          totalFound: total,
          imported,
          duplicates,
          failed,
          errors: errors.length ? errors : undefined,
          completedAt: new Date(),
        },
      });

      return NextResponse.json({
        jobId: job.id,
        total,
        imported,
        duplicates,
        failed,
        errors,
      });
    } catch (e) {
      await prisma.importJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          errors: [e instanceof Error ? e.message : "Unknown error"],
          imported,
          duplicates,
          failed,
          totalFound: total,
          completedAt: new Date(),
        },
      });
      throw e;
    }
  } catch (e) {
    console.error("CQC discover error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "CQC request failed" },
      { status: 500 }
    );
  }
}
