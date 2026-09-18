import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail, mergeFields } from "@/lib/email";

// GET /api/cron/sequence-runner — Vercel Cron endpoint (runs daily).
// Executes due sequence steps: EMAIL sends via SMTP (or logs when SMTP is
// not configured), CALL/TASK/LINKEDIN create tasks for the team.
// Respects doNotContact / unsubscribed flags and marks enrollments
// COMPLETED when they run out of steps.

export const maxDuration = 300;

type Step = {
  order?: number;
  delayDays?: number;
  type?: string;
  subject?: string;
  templateId?: string;
  note?: string;
};

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const batchSize = Math.min(Number(url.searchParams.get("batch")) || 50, 200);

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

      // Suppression: DNC or unsubscribed leads leave the sequence.
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
              subject: `[Sequence] ${subject}`,
              body: result.sent
                ? body
                : `QUEUED (SMTP not configured): ${body}`,
            },
          });
          if (result.sent) emailsSent++;
        } else {
          // No email address — create a task to find one instead.
          await prisma.task.create({
            data: {
              title: `Find email for ${lead.name} (sequence email step)`,
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
      } else {
        // CALL / TASK / LINKEDIN — create a task for the owner.
        const labels: Record<string, string> = {
          CALL: "Call",
          TASK: "Task",
          LINKEDIN: "LinkedIn touch",
        };
        await prisma.task.create({
          data: {
            title: `[Sequence: ${enrollment.sequence.name}] ${labels[type] ?? "Step"} — ${lead.name}`,
            description: step.note ?? undefined,
            priority: type === "CALL" ? "HIGH" : "MEDIUM",
            leadId: lead.id,
            contactId: contact?.id ?? null,
            assignedToId: ownerId,
            dueAt: now,
          },
        });
        tasksCreated++;
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
    due: due.length,
    executed,
    emailsSent,
    tasksCreated,
    completed,
    skipped,
    errors,
  });
}
