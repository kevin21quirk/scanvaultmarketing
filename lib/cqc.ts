// CQC (Care Quality Commission) public API client.
// Docs: https://api-portal.service.nhs.uk/documentation?api=cqc-api-v1
// Free partner key required for higher rate limits; public access works without.

const BASE = process.env.CQC_API_BASE || "https://api.service.cqc.org.uk";

export type CqcLocation = {
  locationId: string;
  locationName: string;
  alsoKnownAs?: string;
  providerId?: string;
  providerName?: string;
  postalAddressLine1?: string;
  postalAddressLine2?: string;
  postalAddressTownCity?: string;
  postalAddressCounty?: string;
  postalCode?: string;
  region?: string;
  localAuthority?: string;
  mainPhoneNumber?: string;
  webAddress?: string;
  numberOfBeds?: number;
  careHome?: "Y" | "N";
  dormancy?: "Y" | "N";
  currentRatings?: {
    overall?: { rating?: string; reportDate?: string };
  };
  regulatedActivities?: Array<{ name: string; code: string }>;
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
  postalCode?: string;
  /** Provider/group name search — routes through /providers endpoint */
  searchTerm?: string;
  /** NOTE: overallRating is no longer supported by the new CQC API */
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
  // The /locations endpoint no longer accepts a searchTerm parameter.
  // For text searches (e.g. "Barchester"), we search /providers instead,
  // then fetch the locations that belong to matched providers.
  if (params.searchTerm) {
    return searchLocationsByProviderName(params.searchTerm, params.careHome, params.page ?? 1, params.perPage ?? 25);
  }

  // ── Geographic search ───────────────────────────────────────────────────
  // Only send parameters the new API actually accepts.
  const url = new URL(`${BASE}/public/v1/locations`);
  if (params.careHome !== undefined) url.searchParams.set("careHome", params.careHome ? "Y" : "N");
  if (params.region) url.searchParams.set("region", params.region);
  if (params.localAuthority) url.searchParams.set("localAuthority", params.localAuthority);
  if (params.postalCode) url.searchParams.set("postalCode", params.postalCode);
  // NOTE: overallRating is not accepted by the new API — filter client-side below
  url.searchParams.set("page", String(params.page ?? 1));
  url.searchParams.set("perPage", String(Math.min(params.perPage ?? 100, 500)));

  const res = await fetchUrl(url.toString());
  const data = (await res.json()) as CqcSearchResponse;

  let locations = data.locations ?? [];
  // Client-side rating filter since the API no longer supports it server-side
  if (params.overallRating) {
    locations = locations.filter(
      (l) => l.currentRatings?.overall?.rating === params.overallRating
    );
  }

  return {
    locations,
    total: data.total ?? 0,
    totalPages: data.totalPages ?? 1,
  };
}

/** Fetch all locations belonging to a specific CQC provider ID (e.g. "1-10000644"). */
export async function getProviderLocations(providerId: string): Promise<CqcLocation[]> {
  const url = new URL(`${BASE}/public/v1/providers/${providerId}/locations`);
  url.searchParams.set("perPage", "500");
  const res = await fetchUrl(url.toString());
  const data = (await res.json()) as { locations?: CqcLocation[] };
  return data.locations ?? [];
}

/**
 * Search providers by name then return all their care-home locations.
 * If the term looks like a CQC provider ID (e.g. "1-10000644") uses direct lookup.
 */
async function searchLocationsByProviderName(
  name: string,
  careHomeOnly: boolean | undefined,
  page: number,
  perPage: number
): Promise<{ locations: CqcLocation[]; total: number; totalPages: number }> {

  // ── Direct provider ID lookup (e.g. "1-10000644") — instant ────────────
  const trimmed = name.trim();
  if (/^\d+-\d+$/.test(trimmed)) {
    const locations = await getProviderLocations(trimmed);
    const filtered = careHomeOnly ? locations.filter((l) => l.careHome === "Y") : locations;
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
  const BATCH = 8; // concurrent requests per round

  // First request to get total count
  const firstUrl = new URL(`${BASE}/public/v1/providers`);
  firstUrl.searchParams.set("page", "1");
  firstUrl.searchParams.set("perPage", String(PER_PAGE));
  const firstRes = await fetchUrl(firstUrl.toString());
  const firstData = (await firstRes.json()) as CqcSearchResponse;
  const totalProviderPages = Math.ceil((firstData.total ?? 0) / PER_PAGE);

  const allProviders: CqcProvider[] = [...((firstData.providers ?? []) as CqcProvider[])];

  // Fetch remaining pages in parallel batches
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

  // Filter providers by name
  const matched = allProviders.filter((pr) =>
    pr.providerName?.toLowerCase().includes(nameLower)
  );

  if (matched.length === 0) {
    return { locations: [], total: 0, totalPages: 0 };
  }

  // Fetch locations for matched providers (cap at 5 to stay within timeout)
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

  const filtered = careHomeOnly
    ? allLocations.filter((l) => l.careHome === "Y")
    : allLocations;

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
  const careTypes = [
    ...(loc.gacServiceTypes?.map((t) => t.name) ?? []),
    ...(loc.specialisms?.map((s) => s.name) ?? []),
  ];
  return {
    name: loc.locationName || "Unnamed location",
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
    website: loc.webAddress || null,
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
    providerName: loc.providerName || null,
    localAuthority: loc.localAuthority || null,
    source: "CQC" as const,
    sourceDetail: "CQC register",
  };
}
