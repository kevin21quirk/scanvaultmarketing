import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { searchLocations, cqcLocationToLead } from "@/lib/cqc";
import { scoreLead } from "@/lib/scoring";
import { autoEnroll } from "@/lib/cadence";

// GET /api/cron/cqc-sync — Vercel Cron endpoint.
// Re-scans the CQC register, imports newly registered care homes and
// flags rating changes (a downgrade = warm lead for ScanVault).
// Secured by CRON_SECRET (Vercel sends it as a Bearer token).

export const maxDuration = 300;

const RATING_ORDER = ["Inadequate", "Requires improvement", "Good", "Outstanding"];

function ratingWorse(prev: string, next: string): boolean {
  const p = RATING_ORDER.indexOf(prev);
  const n = RATING_ORDER.indexOf(next);
  return p !== -1 && n !== -1 && n < p;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const regions = url.searchParams.getAll("region"); // optional scoping
  const maxPages = Math.min(Number(url.searchParams.get("pages")) || 10, 50);
  const dryRun = url.searchParams.get("dry") === "1";

  const job = await prisma.importJob.create({
    data: {
      source: "CQC",
      status: "RUNNING",
      query: { cron: true, regions, maxPages, dryRun },
    },
  });

  let scanned = 0;
  let created = 0;
  let updated = 0;
  let downgrades = 0;
  let failed = 0;
  const errors: string[] = [];
  const newLeadIds: string[] = [];

  try {
    const defaultStage = await prisma.pipelineStage.findFirst({
      where: { isDefault: true },
    });
    const adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
    });

    // Scan each requested region, or a single unfiltered pass.
    const passes = regions.length ? regions : [null];

    for (const region of passes) {
      let page = 1;
      let totalPages = 1;
      do {
        const batch = await searchLocations({
          careHome: true,
          region: region ?? undefined,
          page,
          perPage: 500,
        });
        totalPages = Math.min(batch.totalPages, maxPages);

        for (const loc of batch.locations) {
          if (!loc.locationId) continue;
          scanned++;
          const mapped = cqcLocationToLead(loc);

          try {
            const existing = await prisma.lead.findUnique({
              where: { cqcLocationId: loc.locationId },
            });

            if (!existing) {
              if (!dryRun) {
                const lead = await prisma.lead.create({
                  data: {
                    ...mapped,
                    stageId: defaultStage?.id ?? null,
                    assignedToId: adminUser?.id ?? null,
                    score: scoreLead(mapped),
                    sourceDetail: "CQC auto-sync",
                  },
                });
                newLeadIds.push(lead.id);
                await autoEnroll(lead.id);
              }
              created++;
              continue;
            }

            // Detect rating change — log it as an activity + follow-up task.
            const prev = existing.cqcRating;
            const next = mapped.cqcRating;
            const ratingChanged = prev && next && prev !== next;
            const worse = ratingChanged && ratingWorse(prev!, next!);

            if (!dryRun && (ratingChanged || existing.phone !== mapped.phone || existing.beds !== mapped.beds)) {
              await prisma.lead.update({
                where: { id: existing.id },
                data: {
                  cqcRating: mapped.cqcRating,
                  cqcRatedAt: mapped.cqcRatedAt,
                  beds: mapped.beds ?? existing.beds,
                  phone: mapped.phone ?? existing.phone,
                  website: mapped.website ?? existing.website,
                  score: scoreLead({ ...existing, ...mapped }),
                },
              });
            }

            if (!dryRun && ratingChanged) {
              await prisma.activity.create({
                data: {
                  type: "NOTE",
                  leadId: existing.id,
                  userId: adminUser?.id ?? null,
                  subject: `CQC rating ${worse ? "downgraded" : "changed"}: ${prev} → ${next}`,
                  body: worse
                    ? `${existing.name} was downgraded by the CQC from ${prev} to ${next}. Strong opening for ScanVault — providers under enforcement pressure need audit-ready documentation.`
                    : `${existing.name} CQC rating changed from ${prev} to ${next}.`,
                },
              });

              if (worse && adminUser) {
                downgrades++;
                await prisma.task.create({
                  data: {
                    title: `Follow up: ${existing.name} downgraded to ${next}`,
                    description: `CQC rating dropped ${prev} → ${next}. Prioritise outreach — documentation compliance is a live pain point.`,
                    priority: "HIGH",
                    leadId: existing.id,
                    assignedToId: adminUser.id,
                    dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
                  },
                });
              }
            }

            updated++;
          } catch (err) {
            failed++;
            if (errors.length < 10) {
              errors.push(`${loc.locationName}: ${err instanceof Error ? err.message : "error"}`);
            }
          }
        }
        page++;
      } while (page <= totalPages);
    }

    if (newLeadIds.length) {
      await prisma.importJobLead.createMany({
        data: newLeadIds.map((leadId) => ({ importJobId: job.id, leadId })),
      });
    }

    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        totalFound: scanned,
        imported: created,
        duplicates: updated,
        failed,
        errors: errors.length ? errors : undefined,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      jobId: job.id,
      scanned,
      created,
      updated,
      ratingDowngrades: downgrades,
      failed,
      dryRun,
      errors,
    });
  } catch (e) {
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errors: [e instanceof Error ? e.message : "Unknown error"],
        completedAt: new Date(),
      },
    });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 }
    );
  }
}
