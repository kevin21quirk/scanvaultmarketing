import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { name, color } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
    const tag = await prisma.tag.create({
      data: { name: name.trim(), color: color || "#DC2626" },
    });
    return NextResponse.json(tag, { status: 201 });
  } catch (e) {
    console.error("Create tag error", e);
    return NextResponse.json({ error: "Failed — tag may already exist" }, { status: 500 });
  }
}
