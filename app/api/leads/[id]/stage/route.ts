import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const { stageId } = await req.json();
    const stage = stageId
      ? await prisma.pipelineStage.findUnique({ where: { id: stageId } })
      : null;

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        stageId: stageId || null,
        status: stage?.isWon ? "WON" : stage?.isLost ? "LOST" : "ACTIVE",
      },
      include: { stage: true },
    });

    await prisma.activity.create({
      data: {
        leadId: id,
        userId: user.id,
        type: "STAGE_CHANGE",
        subject: `Moved to ${stage?.name || "no stage"}`,
        direction: "OUTBOUND",
      },
    });

    return NextResponse.json(lead);
  } catch (e) {
    console.error("Stage change error", e);
    return NextResponse.json({ error: "Failed to change stage" }, { status: 500 });
  }
}
