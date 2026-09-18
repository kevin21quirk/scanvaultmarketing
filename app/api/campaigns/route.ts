import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { campaignSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const { leadIds, ...data } = campaignSchema.parse(body);
    const campaign = await prisma.campaign.create({
      data: {
        ...data,
        leads: {
          create: leadIds.map((leadId) => ({ leadId })),
        },
      },
      include: { _count: { select: { leads: true } } },
    });
    return NextResponse.json(campaign, { status: 201 });
  } catch (e) {
    console.error("Create campaign error", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
