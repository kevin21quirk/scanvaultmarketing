import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { cookies } from "next/headers";

// Derive the app origin from the live request — always matches what the browser/LinkedIn sees.
function originFromRequest(req: NextRequest) {
  // x-forwarded-proto / host are set by Vercel's edge (and most proxies)
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const appUrl = originFromRequest(req);

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(`${appUrl}/settings?linkedin=not_configured`);
  }

  const state = crypto.randomUUID();
  const redirectUri = `${appUrl}/api/auth/linkedin/callback`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: "openid profile email",
  });

  const store = await cookies();
  store.set("li_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return NextResponse.redirect(
    `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
  );
}
