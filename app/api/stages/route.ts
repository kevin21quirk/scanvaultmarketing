import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { name, color } = await req.json();
    const max = await prisma.pipelineStage.aggregate({ _max: { order: true } });
    const stage = await prisma.pipelineStage.create({
      data: { name, color: color || "#6B7280", order: (max._max.order ?? 0) + 1 },
    });
    return NextResponse.json(stage, { status: 201 });
  } catch (e) {
    console.error("Create stage error", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
