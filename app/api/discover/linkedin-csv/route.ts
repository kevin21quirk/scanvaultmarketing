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

// Detect import format:
//  "connections" = LinkedIn My Network export (First Name, Last Name, URL, Company, Position)
//  "lead"        = Sales Navigator Lead List export (adds Title, Geography, Company Size…)
//  "account"     = Sales Navigator Account List export (Account Name, Industry…)
function detectType(rows: CsvRow[]): "connections" | "lead" | "account" {
  const first = rows[0] ?? {};
  const keys = Object.keys(first).map((k) => k.toLowerCase().trim());
  // LinkedIn Connections export has a "connected on" column
  if (keys.some((k) => k.includes("connected on"))) return "connections";
  if (keys.some((k) => k.includes("first name") || k === "firstname")) return "lead";
  if (keys.some((k) => k.includes("account name") || k.includes("company name"))) return "account";
  // Fallback: if there's a "company" column alongside "title" or "position", treat as lead list
  if (
    (keys.some((k) => k.includes("title")) || keys.some((k) => k.includes("position"))) &&
    keys.some((k) => k.includes("company"))
  )
    return "lead";
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
    // Strip LinkedIn's note rows at the top (they start with "Notes:" or are blank)
    const dataRows = rows.filter((r) => {
      const vals = Object.values(r).join("").trim();
      return vals.length > 0 && !vals.startsWith("Notes:");
    });

    const job = await prisma.importJob.create({
      data: {
        source: "LINKEDIN_SALES_NAV",
        status: "RUNNING",
        totalFound: dataRows.length,
        createdById: user.id,
      },
    });

    const defaultStage = await prisma.pipelineStage.findFirst({ where: { isDefault: true } });
    let imported = 0;
    let duplicates = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of dataRows.slice(0, 5000)) {
      try {
        if (mode === "connections") {
          // --- LinkedIn My Network connections export ---
          // Columns: First Name, Last Name, URL, Email Address, Company, Position, Connected On
          const firstName = pick(row, "First Name", "firstname") ?? "";
          const lastName = pick(row, "Last Name", "lastname") ?? "";
          const company = pick(row, "Company");
          const title = pick(row, "Position", "Title", "Job Title");
          const email = pick(row, "Email Address", "Email");
          const linkedInProfile = pick(row, "URL", "Profile URL") ?? null;

          if (!company && !firstName) { failed++; continue; }

          let lead = company
            ? await prisma.lead.findFirst({ where: { name: { equals: company, mode: "insensitive" } } })
            : null;

          if (!lead && company) {
            const mapped = {
              name: company,
              type: "OTHER" as const,
              source: "LINKEDIN_SALES_NAV" as const,
              sourceDetail: "LinkedIn Connections export",
              stageId: defaultStage?.id ?? null,
            };
            lead = await prisma.lead.create({ data: { ...mapped, score: scoreLead({}) } });
            await autoEnroll(lead.id);
            imported++;
          } else if (lead) {
            duplicates++;
          } else { failed++; continue; }

          if (lead && (firstName || linkedInProfile)) {
            const existing = email
              ? await prisma.contact.findFirst({ where: { leadId: lead.id, email: { equals: email, mode: "insensitive" } } })
              : linkedInProfile
                ? await prisma.contact.findFirst({ where: { leadId: lead.id, linkedIn: linkedInProfile } })
                : await prisma.contact.findFirst({ where: { leadId: lead.id, firstName: { equals: firstName || "Unknown", mode: "insensitive" } } });

            if (!existing) {
              await prisma.contact.create({
                data: {
                  leadId: lead.id,
                  firstName: firstName || "Unknown",
                  lastName: lastName || null,
                  jobTitle: title || null,
                  email: email || null,
                  linkedIn: linkedInProfile || null,
                },
              });
            }
          }
        } else if (mode === "lead") {
          // --- Lead-list (people) import ---
          const firstName = pick(row, "First Name", "firstname") ?? "";
          const lastName = pick(row, "Last Name", "lastname") ?? "";
          const company = pick(row, "Company", "Company Name", "Account Name", "Account");
          const title = pick(row, "Title", "Job Title", "Position");
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

    const modeLabel = mode === "connections" ? "connections" : mode === "lead" ? "lead list" : "account list";
    return NextResponse.json({ jobId: job.id, imported, duplicates, failed, errors, mode: modeLabel });
  } catch (e) {
    console.error("LinkedIn CSV import error", e);
    return NextResponse.json({ error: "LinkedIn CSV import failed" }, { status: 500 });
  }
}
