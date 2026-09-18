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
  searchTerm?: string;
  overallRating?: string; // Outstanding | Good | Requires improvement | Inadequate
  page?: number;
  perPage?: number;
};

export async function searchLocations(
  params: CqcSearchParams
): Promise<{ locations: CqcLocation[]; total: number; totalPages: number }> {
  const url = new URL(`${BASE}/public/v1/locations`);
  if (params.careHome !== undefined) url.searchParams.set("careHome", params.careHome ? "Y" : "N");
  if (params.region) url.searchParams.set("region", params.region);
  if (params.localAuthority) url.searchParams.set("localAuthority", params.localAuthority);
  if (params.postalCode) url.searchParams.set("postalCode", params.postalCode);
  if (params.searchTerm) url.searchParams.set("searchTerm", params.searchTerm);
  if (params.overallRating) url.searchParams.set("overallRating", params.overallRating);
  url.searchParams.set("page", String(params.page ?? 1));
  url.searchParams.set("perPage", String(Math.min(params.perPage ?? 100, 500)));

  const res = await fetch(url.toString(), { headers: headers(), cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CQC API error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as CqcSearchResponse;
  return {
    locations: data.locations ?? [],
    total: data.total ?? 0,
    totalPages: data.totalPages ?? 1,
  };
}

export async function getLocation(locationId: string): Promise<CqcLocation> {
  const res = await fetch(`${BASE}/public/v1/locations/${locationId}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`CQC location fetch failed: ${res.status}`);
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
  const res = await fetch(`${BASE}/public/v1/providers/${providerId}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`CQC provider fetch failed: ${res.status}`);
  return res.json();
}

export async function searchProviders(params: {
  searchTerm?: string;
  region?: string;
  page?: number;
  perPage?: number;
}): Promise<{ providers: CqcProvider[]; total: number; totalPages: number }> {
  const url = new URL(`${BASE}/public/v1/providers`);
  if (params.searchTerm) url.searchParams.set("searchTerm", params.searchTerm);
  if (params.region) url.searchParams.set("region", params.region);
  url.searchParams.set("page", String(params.page ?? 1));
  url.searchParams.set("perPage", String(params.perPage ?? 100));
  const res = await fetch(url.toString(), { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`CQC provider search failed: ${res.status}`);
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
