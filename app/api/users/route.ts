import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  try {
    const { name, email, password } = await req.json();
    if (!name || !email || !password || password.length < 8) {
      return NextResponse.json(
        { error: "Name, email and 8+ char password required" },
        { status: 400 }
      );
    }
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await prisma.user.create({
      data: { name, email, passwordHash, role: "USER" },
      select: { id: true, name: true, email: true, role: true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("Create user error", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
