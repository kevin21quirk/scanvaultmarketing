import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { leadSchema } from "@/lib/validation";
import { scoreLead } from "@/lib/scoring";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const body = await req.json();
    const data = leadSchema.partial().parse(body);

    const update: Record<string, unknown> = { ...data };
    if (data.email === "") update.email = null;

    // Rescore when relevant fields change
    const rescoring = ["beds", "cqcRating", "phone", "email", "website", "careTypes"].some(
      (k) => k in data
    );
    if (rescoring) {
      const current = await prisma.lead.findUnique({ where: { id } });
      if (current) {
        update.score = scoreLead({ ...current, ...data });
      }
    }

    const lead = await prisma.lead.update({ where: { id }, data: update });
    return NextResponse.json(lead);
  } catch (e) {
    console.error("Update lead error", e);
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500 });
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
    await prisma.lead.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Delete lead error", e);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
