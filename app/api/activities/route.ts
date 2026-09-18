import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  leadId: z.string().min(1),
  contactId: z.string().optional().nullable(),
  type: z.enum(["CALL", "EMAIL", "MEETING", "NOTE", "SMS", "LETTER", "LINKEDIN"]),
  direction: z.enum(["INBOUND", "OUTBOUND"]).default("OUTBOUND"),
  outcome: z
    .enum(["NONE", "NO_ANSWER", "LEFT_VOICEMAIL", "SPOKE_TO_CONTACT", "MEETING_BOOKED", "INTERESTED", "NOT_INTERESTED", "CALL_BACK", "DO_NOT_CONTACT"])
    .default("NONE"),
  subject: z.string().optional().nullable(),
  body: z.string().optional().nullable(),
  durationMin: z.coerce.number().int().optional().nullable(),
  occurredAt: z.coerce.date().optional().nullable(),
  followUpAt: z.coerce.date().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { followUpAt, ...data } = schema.parse(body);

    const activity = await prisma.activity.create({
      data: {
        leadId: data.leadId,
        contactId: data.contactId || null,
        type: data.type,
        direction: data.direction,
        outcome: data.outcome,
        subject: data.subject || null,
        body: data.body || null,
        durationMin: data.durationMin ?? null,
        occurredAt: data.occurredAt ?? new Date(),
        userId: user.id,
      },
    });

    // Update lead's last-contacted / next-follow-up timestamps
    const leadUpdate: Record<string, unknown> = {
      lastContactedAt: data.occurredAt || new Date(),
    };
    if (followUpAt) leadUpdate.nextFollowUpAt = followUpAt;
    if (data.outcome === "DO_NOT_CONTACT") leadUpdate.doNotContact = true;
    await prisma.lead.update({ where: { id: data.leadId }, data: leadUpdate });

    return NextResponse.json(activity, { status: 201 });
  } catch (e) {
    console.error("Log activity error", e);
    return NextResponse.json({ error: "Failed to log activity" }, { status: 500 });
  }
}
