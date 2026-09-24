import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Remove both the token and profile rows; ignore if they don't exist
  await Promise.allSettled([
    prisma.setting.delete({ where: { key: `li_token_${user.id}` } }),
    prisma.setting.delete({ where: { key: `li_profile_${user.id}` } }),
  ]);

  return NextResponse.json({ ok: true });
}
