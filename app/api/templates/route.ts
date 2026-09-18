import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { templateSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const data = templateSchema.parse(body);
    const tpl = await prisma.emailTemplate.create({ data });
    return NextResponse.json(tpl, { status: 201 });
  } catch (e) {
    console.error("Create template error", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
