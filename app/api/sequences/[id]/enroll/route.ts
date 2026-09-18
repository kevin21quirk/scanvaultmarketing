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
    const { leadIds } = (await req.json()) as { leadIds: string[] };
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: "No leads provided" }, { status: 400 });
    }

    const sequence = await prisma.sequence.findUnique({ where: { id } });
    if (!sequence) return NextResponse.json({ error: "Sequence not found" }, { status: 404 });

    const steps = (sequence.steps as { delayDays?: number }[]) || [];
    const firstDelay = steps[0]?.delayDays ?? 0;
    const nextRun = new Date(Date.now() + firstDelay * 24 * 60 * 60 * 1000);

    let enrolled = 0;
    for (const leadId of leadIds) {
      try {
        await prisma.sequenceEnrollment.create({
          data: {
            sequenceId: id,
            leadId,
            nextRunAt: nextRun,
          },
        });
        enrolled++;
      } catch {
        // already enrolled — skip
      }
    }

    return NextResponse.json({ ok: true, enrolled });
  } catch (e) {
    console.error("Enroll error", e);
    return NextResponse.json({ error: "Enrollment failed" }, { status: 500 });
  }
}
