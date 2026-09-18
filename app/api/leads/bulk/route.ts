import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { ids, action, value } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No leads selected" }, { status: 400 });
    }

    switch (action) {
      case "setStage": {
        const stage = await prisma.pipelineStage.findUnique({ where: { id: value } });
        await prisma.lead.updateMany({
          where: { id: { in: ids } },
          data: {
            stageId: value,
            status: stage?.isWon ? "WON" : stage?.isLost ? "LOST" : "ACTIVE",
          },
        });
        break;
      }
      case "assign":
        await prisma.lead.updateMany({
          where: { id: { in: ids } },
          data: { assignedToId: value },
        });
        break;
      case "archive":
        await prisma.lead.updateMany({
          where: { id: { in: ids } },
          data: { status: "ARCHIVED" },
        });
        break;
      case "delete":
        await prisma.lead.deleteMany({ where: { id: { in: ids } } });
        break;
      case "setPriority":
        await prisma.lead.updateMany({
          where: { id: { in: ids } },
          data: { priority: value },
        });
        break;
      case "addTag": {
        for (const id of ids) {
          await prisma.leadTag.upsert({
            where: { leadId_tagId: { leadId: id, tagId: value } },
            create: { leadId: id, tagId: value },
            update: {},
          });
        }
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, count: ids.length });
  } catch (e) {
    console.error("Bulk action error", e);
    return NextResponse.json({ error: "Bulk action failed" }, { status: 500 });
  }
}
