/**
 * POST /api/webhooks/zapier
 *
 * Receives a JSON payload from a Zapier Zap (via "Webhooks by Zapier" action)
 * and creates or updates a lead + contact in ScanVault.
 *
 * Authentication:
 *   Set the Authorization header in Zapier to: Bearer <ZAPIER_WEBHOOK_SECRET>
 *
 * Supported Zapier triggers:
 *   - LinkedIn Sales Navigator: New Saved Account  → creates/updates a lead (company)
 *   - LinkedIn Sales Navigator: New Saved Lead     → creates a lead (company) + contact (person)
 *   - Any other source: map fields to the schema below
 *
 * Field mapping (all optional — use whatever Zapier sends):
 *   Account/company:  name | company | account_name | accountName
 *   Person:           first_name | firstName, last_name | lastName, title | position | jobTitle
 *   Contact details:  email, phone, linkedin_url | linkedinUrl | profile_url
 *   Location:         location | geography | headquarters
 *   Extra:            industry, website, employee_count | companySize, notes | summary | description
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { scoreLead } from "@/lib/scoring";
import { autoEnroll } from "@/lib/cadence";

type Payload = Record<string, string | number | boolean | null | undefined>;

function str(p: Payload, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = p[k] ?? p[k.toLowerCase()] ?? p[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return null;
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret = process.env.ZAPIER_WEBHOOK_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    const provided = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ── Resolve field values ──────────────────────────────────────────────────
  const companyName = str(payload,
    "name", "company", "account_name", "accountName",
    "company_name", "companyName", "organisation", "organization"
  );
  const firstName   = str(payload, "first_name", "firstName", "given_name");
  const lastName    = str(payload, "last_name", "lastName", "family_name");
  const jobTitle    = str(payload, "title", "job_title", "jobTitle", "position");
  const email       = str(payload, "email", "email_address", "emailAddress");
  const phone       = str(payload, "phone", "phone_number", "phoneNumber");
  const linkedinUrl = str(payload,
    "linkedin_url", "linkedinUrl", "profile_url", "profileUrl",
    "linkedin_profile_url", "member_url", "url"
  );
  const website     = str(payload, "website", "website_url", "websiteUrl", "company_website");
  const location    = str(payload, "location", "geography", "headquarters", "city", "region");
  const industry    = str(payload, "industry");
  const employees   = str(payload, "employee_count", "employeeCount", "company_size", "companySize", "num_employees");
  const notes       = str(payload, "notes", "summary", "description", "bio");
  const source      = str(payload, "source");

  if (!companyName && !firstName) {
    return NextResponse.json({ error: "Payload must include at least a company name or person name" }, { status: 400 });
  }

  try {
    const defaultStage = await prisma.pipelineStage.findFirst({ where: { isDefault: true } });

    // ── Find or create the lead (company) ────────────────────────────────────
    const leadName = companyName ?? `${firstName} ${lastName ?? ""}`.trim();

    let lead = await prisma.lead.findFirst({
      where: { name: { equals: leadName, mode: "insensitive" } },
    });

    const builtNotes = [
      industry    && `Industry: ${industry}`,
      employees   && `Employees: ${employees}`,
      notes,
    ].filter(Boolean).join("\n") || null;

    const leadSource = (source === "manual" ? "MANUAL" : "LINKEDIN_SALES_NAV") as "MANUAL" | "LINKEDIN_SALES_NAV";

    if (lead) {
      // Update any newly-supplied fields on the existing lead
      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: {
          ...(website     && { website }),
          ...(linkedinUrl && !firstName && { linkedinUrl }),  // only set company LI if it's an account trigger
          ...(location    && { region: location }),
          ...(builtNotes  && !lead.notes && { notes: builtNotes }),
        },
      });
    } else {
      const mapped = {
        name: leadName,
        type: "OTHER" as const,
        source: leadSource,
        sourceDetail: `Zapier${source ? ` (${source})` : ""}`,
        website:      website ?? null,
        linkedinUrl:  (!firstName ? linkedinUrl : null) ?? null,
        region:       location ?? null,
        stageId:      defaultStage?.id ?? null,
        notes:        builtNotes,
      };
      lead = await prisma.lead.create({ data: { ...mapped, score: scoreLead({ website: website ?? null }) } });
      await autoEnroll(lead.id);
    }

    // ── Create or update the contact (person) ────────────────────────────────
    let contactCreated = false;
    if (firstName || (lastName && !companyName)) {
      const linkedInProfile = firstName ? linkedinUrl : null;

      const existingContact = email
        ? await prisma.contact.findFirst({ where: { leadId: lead.id, email: { equals: email, mode: "insensitive" } } })
        : linkedInProfile
          ? await prisma.contact.findFirst({ where: { leadId: lead.id, linkedIn: linkedInProfile } })
          : await prisma.contact.findFirst({
              where: {
                leadId: lead.id,
                firstName: { equals: firstName ?? "Unknown", mode: "insensitive" },
              },
            });

      if (!existingContact) {
        await prisma.contact.create({
          data: {
            leadId:    lead.id,
            firstName: firstName ?? "Unknown",
            lastName:  lastName ?? null,
            jobTitle:  jobTitle ?? null,
            email:     email ?? null,
            phone:     phone ?? null,
            linkedIn:  linkedInProfile ?? null,
          },
        });
        contactCreated = true;
      }
    }

    return NextResponse.json({
      ok: true,
      leadId:         lead.id,
      leadName:       lead.name,
      leadCreated:    !lead.updatedAt || lead.createdAt.getTime() === lead.updatedAt.getTime(),
      contactCreated,
    });
  } catch (e) {
    console.error("Zapier webhook error", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
