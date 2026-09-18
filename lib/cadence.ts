import { prisma } from "@/lib/db";

// The canonical ScanVault outreach cadence — the ONE workflow every
// lead follows. Steps are also seeded into the default Sequence so
// they're editable in the UI; this type mirrors that shape.

export type CadenceStep = {
  order: number;
  delayDays: number;
  type: "EMAIL" | "BROCHURE" | "CALL" | "LINKEDIN" | "TASK";
  label: string;
  subject?: string;
  templateName?: string; // resolved to templateId at seed time
  note?: string;
};

export const CADENCE: CadenceStep[] = [
  {
    order: 0,
    delayDays: 0,
    type: "EMAIL",
    label: "Intro email",
    templateName: "Intro — care home outreach",
  },
  {
    order: 1,
    delayDays: 1,
    type: "BROCHURE",
    label: "Post brochure pack",
    note: "Print & post ScanVault brochure to the home's address (skipped automatically if no postal address on file)",
  },
  {
    order: 2,
    delayDays: 7,
    type: "CALL",
    label: "Follow-up call",
    note: "Ring the home — reference the email and brochure. Ask for the registered manager.",
  },
  {
    order: 3,
    delayDays: 14,
    type: "EMAIL",
    label: "Follow-up email",
    templateName: "Follow-up — CQC rating angle",
  },
  {
    order: 4,
    delayDays: 21,
    type: "CALL",
    label: "Final call",
    note: "Last attempt — if no interest, log outcome and move to Nurture",
  },
  {
    order: 5,
    delayDays: 28,
    type: "TASK",
    label: "Review & triage",
    note: "Review the lead — book a meeting, move to Nurture, or archive.",
  },
];

/** Find the default ACTIVE cadence sequence. */
export async function getDefaultSequence() {
  return prisma.sequence.findFirst({
    where: { isDefault: true, status: "ACTIVE" },
  });
}

/**
 * Enrol a lead into the default cadence if not already enrolled.
 * Safe to call on every lead creation — no-ops when already enrolled
 * or no default sequence exists.
 */
export async function autoEnroll(leadId: string): Promise<boolean> {
  const seq = await getDefaultSequence();
  if (!seq) return false;

  const existing = await prisma.sequenceEnrollment.findUnique({
    where: { sequenceId_leadId: { sequenceId: seq.id, leadId } },
  });
  if (existing) return false;

  const steps = (seq.steps as { delayDays?: number }[]) ?? [];
  const firstDelay = steps[0]?.delayDays ?? 0;

  await prisma.sequenceEnrollment.create({
    data: {
      sequenceId: seq.id,
      leadId,
      nextRunAt: new Date(Date.now() + firstDelay * 24 * 60 * 60 * 1000),
    },
  });
  return true;
}

/**
 * Sweep: enrol every active lead that isn't in the default cadence.
 * Used by the cron runner and the "catch up" button — makes the
 * cadence truly universal even for leads created before it existed.
 */
export async function enrollAllMissing(): Promise<number> {
  const seq = await getDefaultSequence();
  if (!seq) return 0;

  const enrolled = await prisma.sequenceEnrollment.findMany({
    where: { sequenceId: seq.id },
    select: { leadId: true },
  });
  const enrolledIds = new Set(enrolled.map((e) => e.leadId));

  const steps = (seq.steps as { delayDays?: number }[]) ?? [];
  const firstDelay = steps[0]?.delayDays ?? 0;
  const nextRun = new Date(Date.now() + firstDelay * 24 * 60 * 60 * 1000);

  const candidates = await prisma.lead.findMany({
    where: {
      status: { in: ["NEW", "ACTIVE"] },
      doNotContact: false,
      unsubscribed: false,
    },
    select: { id: true },
  });

  let added = 0;
  for (const lead of candidates) {
    if (enrolledIds.has(lead.id)) continue;
    try {
      await prisma.sequenceEnrollment.create({
        data: { sequenceId: seq.id, leadId: lead.id, nextRunAt: nextRun },
      });
      added++;
    } catch {
      // unique violation — already enrolled concurrently
    }
  }
  return added;
}
