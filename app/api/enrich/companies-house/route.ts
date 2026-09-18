import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  searchCompanies,
  getOfficers,
  bestCompanyMatch,
} from "@/lib/companies-house";

// POST /api/enrich/companies-house
// Body: { leadId } to enrich one lead, or { batch: true, limit } to sweep
// leads that have no companiesHouseNo yet.
// Finds the provider's CH record, stores the company number, and adds
// active officers as contacts on the lead.

function splitName(full: string): { firstName: string; lastName: string } {
  // CH returns "SURNAME, Forename Middle" or "Forename Surname"
  if (full.includes(",")) {
    const [last, rest] = full.split(",", 2);
    const first = rest.trim().split(" ")[0] || "";
    return {
      firstName: first.charAt(0) + first.slice(1).toLowerCase(),
      lastName:
        last.trim().charAt(0).toUpperCase() +
        last.trim().slice(1).toLowerCase(),
    };
  }
  const parts = full.trim().split(" ");
  return {
    firstName: parts[0] ?? full,
    lastName: parts.slice(1).join(" ") || undefined,
  } as { firstName: string; lastName: string };
}

async function enrichLead(leadId: string, userId: string | null) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { leadId, status: "not_found" };
  if (lead.companiesHouseNo) return { leadId, status: "already_enriched" };

  const query = lead.providerName || lead.name;
  const candidates = await searchCompanies(query, 5);
  const match = bestCompanyMatch(query, candidates);
  if (!match) return { leadId, status: "no_match" };

  const officers = (await getOfficers(match.company_number)).filter(
    (o) => !o.resigned_on
  );

  // Don't duplicate existing contacts by name.
  const existing = await prisma.contact.findMany({
    where: { leadId },
    select: { firstName: true, lastName: true },
  });
  const existingNames = new Set(
    existing.map((c) => `${c.firstName} ${c.lastName ?? ""}`.toLowerCase())
  );

  let contactsAdded = 0;
  for (const officer of officers.slice(0, 8)) {
    const { firstName, lastName } = splitName(officer.name);
    if (existingNames.has(`${firstName} ${lastName}`.toLowerCase())) continue;
    await prisma.contact.create({
      data: {
        leadId,
        firstName,
        lastName: lastName ?? null,
        jobTitle:
          officer.officer_role.charAt(0).toUpperCase() +
          officer.officer_role.slice(1).replace(/_/g, " "),
        notes: `Companies House: ${match.title} (${match.company_number}), appointed ${officer.appointed_on ?? "unknown"}`,
      },
    });
    contactsAdded++;
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: { companiesHouseNo: match.company_number },
  });

  await prisma.activity.create({
    data: {
      type: "NOTE",
      leadId,
      userId,
      subject: `Enriched via Companies House: ${match.title}`,
      body: `Matched to ${match.title} (${match.company_number}), status: ${match.company_status ?? "unknown"}. ${contactsAdded} officer(s) added as contacts.`,
    },
  });

  return {
    leadId,
    status: "enriched",
    company: match.title,
    companyNumber: match.company_number,
    contactsAdded,
  };
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.COMPANIES_HOUSE_API_KEY) {
    return NextResponse.json(
      { error: "COMPANIES_HOUSE_API_KEY not configured" },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();

    if (body.leadId) {
      const result = await enrichLead(body.leadId, user.id);
      return NextResponse.json(result);
    }

    if (body.batch) {
      const limit = Math.min(Number(body.limit) || 25, 100);
      const leads = await prisma.lead.findMany({
        where: {
          companiesHouseNo: null,
          status: { not: "ARCHIVED" },
        },
        take: limit,
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

      const alreadyEnriched = await prisma.lead.count({
        where: { companiesHouseNo: { not: null } },
      });

      const results = [];
      for (const lead of leads) {
        try {
          results.push(await enrichLead(lead.id, user.id));
        } catch (err) {
          results.push({
            leadId: lead.id,
            status: "error",
            error: err instanceof Error ? err.message : "error",
          });
        }
        // Be polite to the free CH rate limit (~600 req/5min).
        await new Promise((r) => setTimeout(r, 300));
      }

      return NextResponse.json({
        processed: leads.length,
        enriched: results.filter((r) => r.status === "enriched").length,
        alreadyEnriched,
        results,
      });
    }

    return NextResponse.json(
      { error: "Provide leadId or batch: true" },
      { status: 400 }
    );
  } catch (e) {
    console.error("CH enrich error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Enrichment failed" },
      { status: 500 }
    );
  }
}
