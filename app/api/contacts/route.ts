import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { contactSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const data = contactSchema.parse(body);
    if (data.isPrimary) {
      await prisma.contact.updateMany({
        where: { leadId: data.leadId },
        data: { isPrimary: false },
      });
    }
    const contact = await prisma.contact.create({
      data: { ...data, email: data.email || null },
    });
    return NextResponse.json(contact, { status: 201 });
  } catch (e) {
    console.error("Create contact error", e);
    return NextResponse.json({ error: "Failed to add contact" }, { status: 500 });
  }
}
