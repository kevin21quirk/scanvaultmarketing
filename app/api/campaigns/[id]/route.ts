import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json();
    const data: Record<string, unknown> = { ...body };
    if (body.status === "ACTIVE" && !body.startedAt) data.startedAt = new Date();
    if (body.status === "COMPLETED") data.completedAt = new Date();
    const campaign = await prisma.campaign.update({ where: { id }, data });
    return NextResponse.json(campaign);
  } catch (e) {
    console.error("Update campaign error", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await prisma.campaign.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Delete campaign error", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
