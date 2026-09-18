import { NextRequest, NextResponse } from "next/server";
import { createSession, verifyLogin } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    const user = await verifyLogin(email, password);
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    await createSession(user);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Login error", e);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
