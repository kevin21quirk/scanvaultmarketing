import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

function getAppUrl() {
  const raw =
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export async function GET(req: NextRequest) {
  const appUrl = getAppUrl();
  const user = await getSession();
  if (!user) return NextResponse.redirect(`${appUrl}/login`);

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const store = await cookies();
  const savedState = store.get("li_oauth_state")?.value;
  store.delete("li_oauth_state");

  if (error || !code || !state || state !== savedState) {
    return NextResponse.redirect(`${appUrl}/settings?linkedin=error`);
  }

  try {
    const redirectUri = `${appUrl}/api/auth/linkedin/callback`;

    // Exchange the auth code for an access token
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }),
    });

    if (!tokenRes.ok) {
      console.error("LinkedIn token exchange failed", await tokenRes.text());
      throw new Error("Token exchange failed");
    }

    const tokenData = (await tokenRes.json()) as { access_token: string; expires_in?: number };
    const accessToken = tokenData.access_token;

    // Fetch the user's LinkedIn profile via the OpenID userinfo endpoint
    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileRes.ok) throw new Error("LinkedIn profile fetch failed");

    const profile = (await profileRes.json()) as {
      sub?: string;
      name?: string;
      given_name?: string;
      family_name?: string;
      email?: string;
      picture?: string;
    };

    const displayName =
      profile.name || [profile.given_name, profile.family_name].filter(Boolean).join(" ") || "LinkedIn User";

    // Persist the token and profile in the generic Settings key-value store
    await Promise.all([
      prisma.setting.upsert({
        where: { key: `li_token_${user.id}` },
        create: { key: `li_token_${user.id}`, value: accessToken },
        update: { value: accessToken },
      }),
      prisma.setting.upsert({
        where: { key: `li_profile_${user.id}` },
        create: {
          key: `li_profile_${user.id}`,
          value: {
            name: displayName,
            email: profile.email ?? null,
            picture: profile.picture ?? null,
            sub: profile.sub ?? null,
          },
        },
        update: {
          value: {
            name: displayName,
            email: profile.email ?? null,
            picture: profile.picture ?? null,
            sub: profile.sub ?? null,
          },
        },
      }),
    ]);

    return NextResponse.redirect(`${appUrl}/settings?linkedin=connected`);
  } catch (e) {
    console.error("LinkedIn OAuth callback error", e);
    return NextResponse.redirect(`${appUrl}/settings?linkedin=error`);
  }
}
