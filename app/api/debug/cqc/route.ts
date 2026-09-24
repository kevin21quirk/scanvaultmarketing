// Temporary diagnostic endpoint — visit /api/debug/cqc while logged in
// to see exactly what the CQC API returns. Remove before going to production.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const BASE = process.env.CQC_API_BASE || "https://api.service.cqc.org.uk";
  const key = process.env.CQC_API_KEY;

  const headers: HeadersInit = key
    ? { "Ocp-Apim-Subscription-Key": key, Accept: "application/json" }
    : { Accept: "application/json" };

  const results: Record<string, unknown> = {};

  // Test 1: providers list
  try {
    const r1 = await fetch(`${BASE}/public/v1/providers?page=1&perPage=3`, { headers });
    const t1 = await r1.text();
    results.providers = { status: r1.status, body: t1.slice(0, 1000) };
  } catch (e) {
    results.providers = { error: String(e) };
  }

  // Test 2: locations list
  try {
    const r2 = await fetch(`${BASE}/public/v1/locations?careHome=Y&perPage=3&page=1`, { headers });
    const t2 = await r2.text();
    results.locations = { status: r2.status, body: t2.slice(0, 1000) };
  } catch (e) {
    results.locations = { error: String(e) };
  }

  // Test 3: provider locations for Barchester (1-102642955)
  try {
    const r3 = await fetch(`${BASE}/public/v1/providers/1-102642955/locations?perPage=3`, { headers });
    const t3 = await r3.text();
    results.providerLocations = { status: r3.status, body: t3.slice(0, 1000) };
  } catch (e) {
    results.providerLocations = { error: String(e) };
  }

  results.apiKeySet = !!key;
  return NextResponse.json(results, { status: 200 });
}
