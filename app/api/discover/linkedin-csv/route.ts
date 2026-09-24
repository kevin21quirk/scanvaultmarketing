import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { scoreLead } from "@/lib/scoring";
import { autoEnroll } from "@/lib/cadence";

type CsvRow = Record<string, string>;

// Case- and punctuation-insensitive column lookup
function pick(row: CsvRow, ...keys: string[]): string | null {
  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const k of keys) {
    const found = Object.keys(row).find((rk) => normalise(rk) === normalise(k));
    if (found && row[found]?.trim()) return row[found].trim();
  }
  return null;
}

// Detect whether this is a Lead List (people) or Account List (companies) export
function detectType(rows: CsvRow[]): "lead" | "account" {
  const first = rows[0] ?? {};
  const keys = Object.keys(first).map((k) => k.toLowerCase());
  if (keys.some((k) => k.includes("first name") || k === "firstname")) return "lead";
  if (keys.some((k) => k.includes("account name") || k.includes("company name"))) return "account";
  // Fallback: if there's a "company" column alongside "title", treat as lead list
  if (keys.some((k) => k.includes("title")) && keys.some((k) => k.includes("company"))) return "lead";
  return "account";
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { rows } = (await req.json()) as { rows: CsvRow[] };
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });
    }

    const mode = detectType(rows);
    const job = await prisma.importJob.create({
      data: {
        source: "LINKEDIN_SALES_NAV",
        status: "RUNNING",
        totalFound: rows.length,
        createdById: user.id,
      },
    });

    const defaultStage = await prisma.pipelineStage.findFirst({ where: { isDefault: true } });
    let imported = 0;
    let duplicates = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of rows.slice(0, 5000)) {
      try {
        if (mode === "lead") {
          // --- Lead-list (people) import ---
          const firstName = pick(row, "First Name", "firstname") ?? "";
          const lastName = pick(row, "Last Name", "lastname") ?? "";
          const company = pick(row, "Company", "Company Name", "Account Name", "Account");
          const title = pick(row, "Title", "Job Title");
          const email = pick(row, "Email Address", "Email", "email");
          const phone = pick(row, "Phone Number", "Phone");
          const linkedInProfile =
            pick(row, "URL", "LinkedIn URL", "LinkedIn Member URL", "Profile URL") ?? null;
          const geography = pick(row, "Geography", "Location", "Headquarters", "Location (Headquarters)");
          const industry = pick(row, "Industry", "Company Industry");
          const companySize = pick(row, "Company Size", "Employees", "Number of Employees");

          if (!company && !firstName) {
            failed++;
            continue;
          }

          // Find or create the company as a lead
          let lead = company
            ? await prisma.lead.findFirst({
                where: { name: { equals: company, mode: "insensitive" } },
              })
            : null;

          if (!lead && company) {
            const notes = [
              industry && `Industry: ${industry}`,
              companySize && `Company size: ${companySize}`,
            ]
              .filter(Boolean)
              .join("\n");

            const mapped = {
              name: company,
              type: "OTHER" as const,
              source: "LINKEDIN_SALES_NAV" as const,
              sourceDetail: "LinkedIn Sales Navigator",
              stageId: defaultStage?.id ?? null,
              region: geography ?? null,
              notes: notes || null,
            };
            lead = await prisma.lead.create({ data: { ...mapped, score: scoreLead({}) } });
            await autoEnroll(lead.id);
            imported++;
          } else if (lead) {
            duplicates++;
          } else {
            failed++;
            continue;
          }

          // Create the contact if we have a name or LinkedIn profile
          if (lead && (firstName || lastName || linkedInProfile)) {
            const existingContact = email
              ? await prisma.contact.findFirst({
                  where: {
                    leadId: lead.id,
                    email: { equals: email, mode: "insensitive" },
                  },
                })
              : linkedInProfile
                ? await prisma.contact.findFirst({
                    where: { leadId: lead.id, linkedIn: linkedInProfile },
                  })
                : await prisma.contact.findFirst({
                    where: {
                      leadId: lead.id,
                      firstName: { equals: firstName || "Unknown", mode: "insensitive" },
                    },
                  });

            if (!existingContact) {
              await prisma.contact.create({
                data: {
                  leadId: lead.id,
                  firstName: firstName || "Unknown",
                  lastName: lastName || null,
                  jobTitle: title || null,
                  email: email || null,
                  phone: phone || null,
                  linkedIn: linkedInProfile || null,
                },
              });
            }
          }
        } else {
          // --- Account-list (companies) import ---
          const name =
            pick(row, "Account Name", "Company Name", "Company", "Name") ??
            pick(row, "accountname", "companyname", "company");
          if (!name) {
            failed++;
            continue;
          }

          const existing = await prisma.lead.findFirst({
            where: { name: { equals: name, mode: "insensitive" } },
          });
          if (existing) {
            duplicates++;
            continue;
          }

          const website = pick(row, "Website", "Company Website");
          const linkedinUrl =
            pick(row, "Account LinkedIn URL", "LinkedIn URL", "LinkedIn Company URL", "URL") ?? null;
          const geography = pick(row, "Headquarters Location", "Headquarters", "Location", "Geography");
          const industry = pick(row, "Industry");
          const employees = pick(row, "Number of Employees", "Employees", "Company Size");
          const description = pick(row, "Description", "Notes", "Summary");

          const notes = [
            industry && `Industry: ${industry}`,
            employees && `Employees: ${employees}`,
            description,
          ]
            .filter(Boolean)
            .join("\n");

          const mapped = {
            name,
            type: "OTHER" as const,
            source: "LINKEDIN_SALES_NAV" as const,
            sourceDetail: "LinkedIn Sales Navigator",
            linkedinUrl,
            website: website ?? null,
            region: geography ?? null,
            stageId: defaultStage?.id ?? null,
            notes: notes || null,
          };
          const lead = await prisma.lead.create({ data: { ...mapped, score: scoreLead(mapped) } });
          await autoEnroll(lead.id);
          imported++;
        }
      } catch (err) {
        failed++;
        if (errors.length < 10)
          errors.push(err instanceof Error ? err.message : "Unknown error");
      }
    }

    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        imported,
        duplicates,
        failed,
        errors: errors.length ? errors : undefined,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({ jobId: job.id, imported, duplicates, failed, errors, mode });
  } catch (e) {
    console.error("LinkedIn CSV import error", e);
    return NextResponse.json({ error: "LinkedIn CSV import failed" }, { status: 500 });
  }
}
