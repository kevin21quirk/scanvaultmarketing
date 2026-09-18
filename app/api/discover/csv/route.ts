import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { scoreLead } from "@/lib/scoring";
import { autoEnroll } from "@/lib/cadence";

type CsvRow = Record<string, string>;

function pick(row: CsvRow, ...keys: string[]): string | null {
  for (const k of keys) {
    const found = Object.keys(row).find(
      (rk) => rk.toLowerCase().replace(/[^a-z0-9]/g, "") === k.toLowerCase().replace(/[^a-z0-9]/g, "")
    );
    if (found && row[found]?.trim()) return row[found].trim();
  }
  return null;
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { rows } = (await req.json()) as { rows: CsvRow[] };
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });
    }

    const job = await prisma.importJob.create({
      data: { source: "CSV", status: "RUNNING", totalFound: rows.length, createdById: user.id },
    });

    const defaultStage = await prisma.pipelineStage.findFirst({ where: { isDefault: true } });
    let imported = 0;
    let duplicates = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of rows.slice(0, 5000)) {
      const name = pick(row, "name", "carehome", "carehomename", "locationname", "organisation", "company");
      if (!name) {
        failed++;
        continue;
      }
      const postcode = pick(row, "postcode", "postalcode", "post_code", "zip");
      const phone = pick(row, "phone", "telephone", "tel", "phonenumber", "mainphonenumber");
      const email = pick(row, "email", "emailaddress", "mail");
      const beds = pick(row, "beds", "numberofbeds", "capacity");

      try {
        // Dedupe: same name + postcode, or same CQC id
        const cqcId = pick(row, "cqclocationid", "locationid", "cqc");
        const existing = await prisma.lead.findFirst({
          where: cqcId
            ? { cqcLocationId: cqcId }
            : postcode
              ? { name: { equals: name, mode: "insensitive" }, postcode: { equals: postcode, mode: "insensitive" } }
              : { name: { equals: name, mode: "insensitive" }, town: { equals: pick(row, "town", "city", "towncity") || "", mode: "insensitive" } },
        });
        if (existing) {
          duplicates++;
          continue;
        }

        const mapped = {
          name,
          type: "CARE_HOME" as const,
          addressLine1: pick(row, "address", "addressline1", "street", "address1"),
          town: pick(row, "town", "city", "towncity", "postaladdresstowncity"),
          county: pick(row, "county", "postaladdresscounty"),
          postcode,
          region: pick(row, "region"),
          phone,
          email,
          website: pick(row, "website", "webaddress", "url", "web"),
          beds: beds ? parseInt(beds, 10) || null : null,
          providerName: pick(row, "provider", "providername", "group"),
          cqcLocationId: cqcId,
          cqcRating: pick(row, "cqcrating", "rating", "overallrating"),
          source: "CSV_IMPORT" as const,
          sourceDetail: "CSV upload",
          stageId: defaultStage?.id ?? null,
        };
        const lead = await prisma.lead.create({ data: { ...mapped, score: scoreLead(mapped) } });
        await autoEnroll(lead.id);
        imported++;
      } catch (err) {
        failed++;
        if (errors.length < 10) errors.push(`${name}: ${err instanceof Error ? err.message : "error"}`);
      }
    }

    await prisma.importJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED", imported, duplicates, failed, errors: errors.length ? errors : undefined, completedAt: new Date() },
    });

    return NextResponse.json({ jobId: job.id, imported, duplicates, failed, errors });
  } catch (e) {
    console.error("CSV import error", e);
    return NextResponse.json({ error: "CSV import failed" }, { status: 500 });
  }
}
