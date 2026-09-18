import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sequenceSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const data = sequenceSchema.parse(body);
    const seq = await prisma.sequence.create({
      data: { ...data, status: "ACTIVE" },
    });
    return NextResponse.json(seq, { status: 201 });
  } catch (e) {
    console.error("Create sequence error", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
