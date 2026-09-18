import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { leadSchema } from "@/lib/validation";
import { scoreLead } from "@/lib/scoring";

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data = leadSchema.parse(body);

    const score = scoreLead(data);
    let stageId = data.stageId;
    if (!stageId) {
      const def = await prisma.pipelineStage.findFirst({ where: { isDefault: true } });
      stageId = def?.id ?? null;
    }

    const lead = await prisma.lead.create({
      data: {
        ...data,
        email: data.email || null,
        stageId,
        score,
      },
    });
    return NextResponse.json(lead, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.name === "ZodError") {
      return NextResponse.json({ error: "Invalid data", details: e }, { status: 400 });
    }
    console.error("Create lead error", e);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }
}
