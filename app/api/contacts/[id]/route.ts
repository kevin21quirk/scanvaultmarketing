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
    if (body.isPrimary) {
      const contact = await prisma.contact.findUnique({ where: { id } });
      if (contact) {
        await prisma.contact.updateMany({
          where: { leadId: contact.leadId },
          data: { isPrimary: false },
        });
      }
    }
    const contact = await prisma.contact.update({ where: { id }, data: body });
    return NextResponse.json(contact);
  } catch (e) {
    console.error("Update contact error", e);
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
    await prisma.contact.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Delete contact error", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
