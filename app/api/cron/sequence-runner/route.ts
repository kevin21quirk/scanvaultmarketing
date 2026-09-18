import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail, mergeFields } from "@/lib/email";
import { enrollAllMissing } from "@/lib/cadence";

// GET /api/cron/sequence-runner — Vercel Cron endpoint (runs daily).
// Executes the ScanVault outreach cadence for every enrolled lead:
//   EMAIL    — sends via SMTP (or logs the send when SMTP is absent)
//   BROCHURE — creates a "post brochure" task when the lead has an
//              address, otherwise records that it was skipped
//   CALL / LINKEDIN / TASK — creates tasks for the team
// First touch auto-moves the lead's pipeline stage to "Contacted".
// Also sweeps in any lead not yet enrolled in the default cadence.
// Respects doNotContact / unsubscribed flags throughout.

export const maxDuration = 300;

type Step = {
  order?: number;
  delayDays?: number;
  type?: string;
  label?: string;
  subject?: string;
  templateId?: string;
  note?: string;
};

async function advanceToContacted(leadId: string) {
  const contacted = await prisma.pipelineStage.findFirst({
    where: { name: "Contacted" },
  });
  if (!contacted) return;
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { stage: true },
  });
  if (!lead || lead.stage?.isWon || lead.stage?.isLost) return;
  // Only auto-advance while still at the entry/default stage or unstaged.
  if (!lead.stageId || lead.stage?.isDefault || lead.stage?.name === "Researching") {
    await prisma.lead.update({
      where: { id: leadId },
      data: { stageId: contacted.id },
    });
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const batchSize = Math.min(Number(url.searchParams.get("batch")) || 50, 200);

  // Sweep: make sure every eligible lead is enrolled in the cadence.
  const newlyEnrolled = await enrollAllMissing();

  const now = new Date();
  const due = await prisma.sequenceEnrollment.findMany({
    where: { status: "ACTIVE", nextRunAt: { lte: now } },
    take: batchSize,
    orderBy: { nextRunAt: "asc" },
    include: {
      sequence: true,
      lead: {
        include: {
          contacts: { orderBy: { isPrimary: "desc" }, take: 1 },
          assignedTo: { select: { id: true } },
        },
      },
    },
  });

  let executed = 0;
  let emailsSent = 0;
  let brochures = 0;
  let tasksCreated = 0;
  let completed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const enrollment of due) {
    try {
      const lead = enrollment.lead;
      const steps = ((enrollment.sequence.steps as Step[]) ?? []).sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      );
      const step = steps[enrollment.currentStep];

      // Suppression: DNC / unsubscribed / archived leads leave the cadence.
      if (lead.doNotContact || lead.unsubscribed || lead.status === "ARCHIVED") {
        await prisma.sequenceEnrollment.update({
          where: { id: enrollment.id },
          data: { status: "PAUSED", nextRunAt: null },
        });
        skipped++;
        continue;
      }

      if (!step) {
        await prisma.sequenceEnrollment.update({
          where: { id: enrollment.id },
          data: { status: "COMPLETED", completedAt: now, nextRunAt: null },
        });
        completed++;
        continue;
      }

      const contact = lead.contacts[0] ?? null;
      const vars = {
        name: lead.name,
        firstName: contact?.firstName ?? "",
        town: lead.town ?? "",
        providerName: lead.providerName ?? "",
        cqcRating: lead.cqcRating ?? "",
      };
      const ownerId = lead.assignedToId ?? null;
      const type = (step.type ?? "TASK").toUpperCase();
      const stepLabel = step.label ?? type;

      if (type === "EMAIL") {
        const to = contact?.email ?? lead.email;
        let subject = step.subject ?? "";
        let body = step.note ?? "";

        if (step.templateId) {
          const tpl = await prisma.emailTemplate.findUnique({
            where: { id: step.templateId },
          });
          if (tpl) {
            subject = tpl.subject;
            body = tpl.body;
          }
        }

        subject = mergeFields(subject, vars);
        body = mergeFields(body, vars);

        if (to) {
          const result = await sendEmail({ to, subject, text: body });
          await prisma.activity.create({
            data: {
              type: "EMAIL",
              direction: "OUTBOUND",
              leadId: lead.id,
              contactId: contact?.id ?? null,
              userId: ownerId,
              subject: `[${enrollment.sequence.name}] ${subject}`,
              body: result.sent ? body : `QUEUED (SMTP not configured): ${body}`,
            },
          });
          if (result.sent) emailsSent++;
          await advanceToContacted(lead.id);
        } else {
          // No email — create a task to find one.
          await prisma.task.create({
            data: {
              title: `Find email for ${lead.name} (${stepLabel})`,
              priority: "MEDIUM",
              leadId: lead.id,
              assignedToId: ownerId,
              dueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
            },
          });
          tasksCreated++;
        }

        await prisma.lead.update({
          where: { id: lead.id },
          data: { lastContactedAt: now },
        });
      } else if (type === "BROCHURE") {
        const hasAddress = !!(lead.addressLine1 && lead.postcode);
        if (hasAddress) {
          await prisma.task.create({
            data: {
              title: `[Cadence] Post brochure pack — ${lead.name}`,
              description: `${step.note ?? "Post ScanVault brochure"}\n\n${lead.addressLine1}${lead.addressLine2 ? `, ${lead.addressLine2}` : ""}, ${lead.town ?? ""} ${lead.postcode}`,
              priority: "MEDIUM",
              leadId: lead.id,
              contactId: contact?.id ?? null,
              assignedToId: ownerId,
              dueAt: now,
            },
          });
          brochures++;
          tasksCreated++;
          await advanceToContacted(lead.id);
        } else {
          await prisma.activity.create({
            data: {
              type: "NOTE",
              leadId: lead.id,
              userId: ownerId,
              subject: `[Cadence] Brochure skipped — no postal address`,
              body: `${lead.name} has no address on file; the brochure step was skipped automatically.`,
            },
          });
        }
      } else {
        // CALL / TASK / LINKEDIN — create a task for the owner.
        const labels: Record<string, string> = {
          CALL: "Call",
          TASK: "Task",
          LINKEDIN: "LinkedIn touch",
        };
        await prisma.task.create({
          data: {
            title: `[${enrollment.sequence.name}] ${stepLabel} — ${lead.name}`,
            description: step.note ?? undefined,
            priority: type === "CALL" ? "HIGH" : "MEDIUM",
            leadId: lead.id,
            contactId: contact?.id ?? null,
            assignedToId: ownerId,
            dueAt: now,
          },
        });
        tasksCreated++;
        if (type === "CALL") await advanceToContacted(lead.id);
      }

      // Advance the enrollment.
      const nextIndex = enrollment.currentStep + 1;
      const nextStep = steps[nextIndex];
      if (nextStep) {
        await prisma.sequenceEnrollment.update({
          where: { id: enrollment.id },
          data: {
            currentStep: nextIndex,
            nextRunAt: new Date(
              now.getTime() + (nextStep.delayDays ?? 1) * 24 * 60 * 60 * 1000
            ),
          },
        });
      } else {
        await prisma.sequenceEnrollment.update({
          where: { id: enrollment.id },
          data: { status: "COMPLETED", completedAt: now, nextRunAt: null },
        });
        completed++;
      }

      executed++;
    } catch (e) {
      if (errors.length < 10) {
        errors.push(
          `enrollment ${enrollment.id}: ${e instanceof Error ? e.message : "error"}`
        );
      }
    }
  }

  return NextResponse.json({
    newlyEnrolled,
    due: due.length,
    executed,
    emailsSent,
    brochures,
    tasksCreated,
    completed,
    skipped,
    errors,
  });
}
