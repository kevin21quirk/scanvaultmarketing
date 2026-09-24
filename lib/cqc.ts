// CQC (Care Quality Commission) public API client.
// Docs: https://api-portal.service.nhs.uk/documentation?api=cqc-api-v1
// Free partner key required for higher rate limits; public access works without.

const BASE = process.env.CQC_API_BASE || "https://api.service.cqc.org.uk";

export type CqcLocation = {
  locationId: string;
  /** list endpoint returns locationName; detail endpoint returns name */
  locationName?: string;
  name?: string;
  alsoKnownAs?: string;
  providerId?: string;
  providerName?: string;
  brandName?: string;
  postalAddressLine1?: string;
  postalAddressLine2?: string;
  postalAddressTownCity?: string;
  postalAddressCounty?: string;
  postalCode?: string;
  region?: string;
  localAuthority?: string;
  mainPhoneNumber?: string;
  /** detail endpoint returns website; old API used webAddress */
  website?: string;
  webAddress?: string;
  numberOfBeds?: number;
  careHome?: "Y" | "N";
  dormancy?: "Y" | "N";
  currentRatings?: {
    overall?: { rating?: string; reportDate?: string };
  };
  regulatedActivities?: Array<{
    name: string;
    code: string;
    contacts?: Array<{
      personTitle?: string;
      personGivenName?: string;
      personFamilyName?: string;
      personRoles?: string[];
    }>;
  }>;
  gacServiceTypes?: Array<{ name: string; description?: string }>;
  specialisms?: Array<{ name: string }>;
};

type CqcSearchResponse = {
  total: number;
  totalPages: number;
  page: number;
  perPage: number;
  locations?: CqcLocation[];
  providers?: Array<{ providerId: string; providerName: string }>;
};

function headers(): HeadersInit {
  const key = process.env.CQC_API_KEY;
  return key
    ? { "Ocp-Apim-Subscription-Key": key, Accept: "application/json" }
    : { Accept: "application/json" };
}

export type CqcSearchParams = {
  careHome?: boolean;
  region?: string;
  localAuthority?: string;
  /** NOTE: postalCode is not supported by the new CQC API — kept for UI compat, ignored */
  postalCode?: string;
  /** Provider/group name search — routes through /providers endpoint */
  searchTerm?: string;
  /** Overall rating filter — passed server-side (valid param on /locations) */
  overallRating?: string;
  page?: number;
  perPage?: number;
};

async function fetchUrl(url: string): Promise<Response> {
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403 || res.status === 502) {
      throw new Error(
        "CQC API key required. Sign up free at api-portal.service.cqc.org.uk, subscribe to the Syndication API, and add your key as CQC_API_KEY in your environment variables."
      );
    }
    const text = await res.text();
    throw new Error(`CQC API error ${res.status}: ${text.slice(0, 300)}`);
  }
  return res;
}

export async function searchLocations(
  params: CqcSearchParams
): Promise<{ locations: CqcLocation[]; total: number; totalPages: number }> {

  // ── Provider name search ────────────────────────────────────────────────
  // The /locations endpoint has no name/text search. For text searches
  // (e.g. "Barchester"), scan /providers client-side and fetch their locations.
  if (params.searchTerm) {
    return searchLocationsByProviderName(params.searchTerm, params.careHome, params.overallRating, params.page ?? 1, params.perPage ?? 25);
  }

  // ── Geographic / rating search ──────────────────────────────────────────
  // Valid params on /locations: careHome, region, localAuthority, overallRating,
  // constituency, regulatedActivity, gacServiceTypeDescription, page, perPage, partnerCode.
  // postalCode is NOT supported — removed.
  const url = new URL(`${BASE}/public/v1/locations`);
  if (params.careHome !== undefined) url.searchParams.set("careHome", params.careHome ? "Y" : "N");
  if (params.region) url.searchParams.set("region", params.region);
  if (params.localAuthority) url.searchParams.set("localAuthority", params.localAuthority);
  if (params.overallRating) url.searchParams.set("overallRating", params.overallRating);
  url.searchParams.set("page", String(params.page ?? 1));
  url.searchParams.set("perPage", String(Math.min(params.perPage ?? 100, 500)));

  const res = await fetchUrl(url.toString());
  const data = (await res.json()) as CqcSearchResponse;

  return {
    locations: data.locations ?? [],
    total: data.total ?? 0,
    totalPages: data.totalPages ?? 1,
  };
}

/**
 * Fetch all locations for a CQC provider ID (e.g. "1-102642955").
 * The endpoint returns {"locations":[{"organisationId":"1-xxx"}]} — IDs only.
 * We fetch the full detail record for each so the import gets real data.
 */
export async function getProviderLocations(providerId: string): Promise<CqcLocation[]> {
  const res = await fetchUrl(`${BASE}/public/v1/providers/${providerId}/locations`);
  const data = (await res.json()) as {
    locations?: Array<{ organisationId?: string; locationId?: string }>;
  };

  const ids = (data.locations ?? [])
    .map((l) => l.organisationId ?? l.locationId)
    .filter(Boolean) as string[];

  const locs: CqcLocation[] = [];
  // Fetch details in parallel batches of 10 to stay within timeout
  const BATCH = 10;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = await Promise.allSettled(
      ids.slice(i, i + BATCH).map((id) => getLocation(id))
    );
    for (const r of batch) {
      if (r.status === "fulfilled") locs.push(r.value);
    }
  }
  return locs;
}

/**
 * Search providers by name then return all their care-home locations.
 * If the term looks like a CQC provider ID (e.g. "1-10000644") uses direct lookup.
 */
async function searchLocationsByProviderName(
  name: string,
  careHomeOnly: boolean | undefined,
  overallRating: string | undefined,
  page: number,
  perPage: number
): Promise<{ locations: CqcLocation[]; total: number; totalPages: number }> {

  function applyFilters(locs: CqcLocation[]) {
    let result = locs;
    if (careHomeOnly) result = result.filter((l) => l.careHome === "Y");
    if (overallRating) result = result.filter((l) => l.currentRatings?.overall?.rating === overallRating);
    return result;
  }

  // ── Direct provider ID lookup (e.g. "1-102642955") — instant ────────────
  const trimmed = name.trim();
  if (/^\d+-\d+$/.test(trimmed)) {
    const locations = await getProviderLocations(trimmed);
    const filtered = applyFilters(locations);
    const start = (page - 1) * perPage;
    return {
      locations: filtered.slice(start, start + perPage),
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / perPage),
    };
  }

  // ── Name search: fetch all providers in parallel batches ────────────────
  const nameLower = name.toLowerCase();
  const PER_PAGE = 500;
  const BATCH = 8;

  const firstUrl = new URL(`${BASE}/public/v1/providers`);
  firstUrl.searchParams.set("page", "1");
  firstUrl.searchParams.set("perPage", String(PER_PAGE));
  const firstRes = await fetchUrl(firstUrl.toString());
  const firstData = (await firstRes.json()) as CqcSearchResponse;
  const totalProviderPages =
    firstData.totalPages ?? Math.ceil((firstData.total ?? 0) / PER_PAGE) ?? 60;

  const allProviders: CqcProvider[] = [...((firstData.providers ?? []) as CqcProvider[])];

  for (let start = 2; start <= totalProviderPages; start += BATCH) {
    const batchPages = Array.from(
      { length: Math.min(BATCH, totalProviderPages - start + 1) },
      (_, i) => start + i
    );
    const results = await Promise.all(
      batchPages.map(async (p) => {
        const url = new URL(`${BASE}/public/v1/providers`);
        url.searchParams.set("page", String(p));
        url.searchParams.set("perPage", String(PER_PAGE));
        const res = await fetchUrl(url.toString());
        const data = (await res.json()) as CqcSearchResponse;
        return (data.providers ?? []) as CqcProvider[];
      })
    );
    allProviders.push(...results.flat());
  }

  const matched = allProviders.filter((pr) =>
    (pr.providerName ?? "").toLowerCase().includes(nameLower)
  );

  if (matched.length === 0) {
    return { locations: [], total: 0, totalPages: 0 };
  }

  const allLocations: CqcLocation[] = [];
  await Promise.all(
    matched.slice(0, 5).map(async (pr) => {
      try {
        const locs = await getProviderLocations(pr.providerId);
        allLocations.push(...locs);
      } catch {
        // skip
      }
    })
  );

  const filtered = applyFilters(allLocations);
  const start = (page - 1) * perPage;
  return {
    locations: filtered.slice(start, start + perPage),
    total: filtered.length,
    totalPages: Math.ceil(filtered.length / perPage),
  };
}

export async function getLocation(locationId: string): Promise<CqcLocation> {
  const res = await fetchUrl(`${BASE}/public/v1/locations/${locationId}`);
  return res.json();
}

export type CqcProvider = {
  providerId: string;
  providerName: string;
  postalAddressLine1?: string;
  postalAddressTownCity?: string;
  postalAddressCounty?: string;
  postalCode?: string;
  region?: string;
  mainPhoneNumber?: string;
  webAddress?: string;
  companiesHouseNumber?: string;
};

export async function getProvider(providerId: string): Promise<CqcProvider> {
  const res = await fetchUrl(`${BASE}/public/v1/providers/${providerId}`);
  return res.json();
}

export async function searchProviders(params: {
  region?: string;
  page?: number;
  perPage?: number;
}): Promise<{ providers: CqcProvider[]; total: number; totalPages: number }> {
  const url = new URL(`${BASE}/public/v1/providers`);
  if (params.region) url.searchParams.set("region", params.region);
  url.searchParams.set("page", String(params.page ?? 1));
  url.searchParams.set("perPage", String(params.perPage ?? 100));
  const res = await fetchUrl(url.toString());
  const data = (await res.json()) as CqcSearchResponse;
  return {
    providers: (data.providers ?? []) as CqcProvider[],
    total: data.total ?? 0,
    totalPages: data.totalPages ?? 1,
  };
}

/** Map a CQC location to our Lead create shape. */
export function cqcLocationToLead(loc: CqcLocation) {
  const gacTypes = loc.gacServiceTypes?.map((t) => t.name) ?? [];
  const specialisms = loc.specialisms?.map((s) => s.name) ?? [];
  const regulatedActivities = loc.regulatedActivities?.map((a) => a.name) ?? [];
  const careTypes = gacTypes.length ? [...gacTypes, ...specialisms] : regulatedActivities;
  // Detail endpoint uses `name`; list endpoint uses `locationName`
  const locationName = loc.locationName ?? loc.name ?? "Unnamed location";
  // Detail endpoint uses `website`; old API used `webAddress`
  const website = loc.website ?? loc.webAddress ?? null;
  // brandName is set on detail records (e.g. "BRAND Barchester Healthcare")
  const providerName =
    loc.providerName ??
    (loc.brandName ? loc.brandName.replace(/^BRAND\s+/i, "") : null);

  // Extract registered manager from regulated activities contacts
  const registeredManager = loc.regulatedActivities
    ?.flatMap((a) => a.contacts ?? [])
    .find((c) => c.personRoles?.includes("Registered Manager"));

  return {
    name: locationName,
    akaName: loc.alsoKnownAs || null,
    type: "CARE_HOME" as const,
    addressLine1: loc.postalAddressLine1 || null,
    addressLine2: loc.postalAddressLine2 || null,
    town: loc.postalAddressTownCity || null,
    county: loc.postalAddressCounty || null,
    postcode: loc.postalCode || null,
    region: loc.region || null,
    country: "England",
    phone: loc.mainPhoneNumber || null,
    website: website ? (website.startsWith("http") ? website : `https://${website}`) : null,
    cqcLocationId: loc.locationId,
    cqcProviderId: loc.providerId || null,
    cqcProviderUrl: loc.providerId
      ? `https://www.cqc.org.uk/provider/${loc.providerId}`
      : null,
    cqcRating: loc.currentRatings?.overall?.rating || null,
    cqcRatedAt: loc.currentRatings?.overall?.reportDate
      ? new Date(loc.currentRatings.overall.reportDate)
      : null,
    beds: loc.numberOfBeds ?? null,
    careTypes,
    providerName,
    localAuthority: loc.localAuthority || null,
    source: "CQC" as const,
    sourceDetail: "CQC register",
    // Include registered manager name in notes so outreach can be personalised
    notes: registeredManager
      ? `Registered Manager: ${registeredManager.personTitle ?? ""} ${registeredManager.personGivenName ?? ""} ${registeredManager.personFamilyName ?? ""}`.trim()
      : undefined,
  };
}
