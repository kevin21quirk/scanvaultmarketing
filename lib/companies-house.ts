// Companies House public API client.
// Docs: https://developer.company-information.service.gov.uk/
// Free API key required (COMPANIES_HOUSE_API_KEY). Auth is HTTP Basic
// with the key as username and an empty password.

const BASE = "https://api.company-information.service.gov.uk";

export type ChCompany = {
  company_number: string;
  title: string;
  company_status?: string;
  company_type?: string;
  date_of_creation?: string;
  registered_office_address?: {
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    region?: string;
    postal_code?: string;
  };
  sic_codes?: string[];
};

export type ChOfficer = {
  name: string;
  officer_role: string;
  appointed_on?: string;
  resigned_on?: string;
  nationality?: string;
};

function authHeader(): HeadersInit {
  const key = process.env.COMPANIES_HOUSE_API_KEY;
  if (!key) throw new Error("COMPANIES_HOUSE_API_KEY not configured");
  return {
    Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
    Accept: "application/json",
  };
}

export async function searchCompanies(
  query: string,
  itemsPerPage = 5
): Promise<ChCompany[]> {
  const url = new URL(`${BASE}/search/companies`);
  url.searchParams.set("q", query);
  url.searchParams.set("items_per_page", String(itemsPerPage));
  const res = await fetch(url.toString(), {
    headers: authHeader(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Companies House search failed: ${res.status}`);
  const data = await res.json();
  return data.items ?? [];
}

export async function getOfficers(companyNumber: string): Promise<ChOfficer[]> {
  const res = await fetch(
    `${BASE}/company/${companyNumber}/officers?items_per_page=35`,
    { headers: authHeader(), cache: "no-store" }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.items ?? [];
}

export async function getCompanyProfile(
  companyNumber: string
): Promise<ChCompany | null> {
  const res = await fetch(`${BASE}/company/${companyNumber}`, {
    headers: authHeader(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

/** Pick the best CH match for a provider/location name. */
export function bestCompanyMatch(
  name: string,
  candidates: ChCompany[]
): ChCompany | null {
  if (!candidates.length) return null;
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  const target = norm(name);

  // Prefer active companies; exact normalised match first.
  const active = candidates.filter(
    (c) => !c.company_status || c.company_status === "active"
  );
  const pool = active.length ? active : candidates;
  return (
    pool.find((c) => norm(c.title) === target) ??
    pool.find(
      (c) => norm(c.title).includes(target) || target.includes(norm(c.title))
    ) ??
    pool[0]
  );
}
