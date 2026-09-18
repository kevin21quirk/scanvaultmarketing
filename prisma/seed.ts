import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CADENCE } from "../lib/cadence";

const prisma = new PrismaClient();

const STAGES = [
  { name: "New Lead", order: 0, color: "#6B7280", isDefault: true },
  { name: "Researching", order: 1, color: "#3B82F6" },
  { name: "Contacted", order: 2, color: "#8B5CF6" },
  { name: "Engaged", order: 3, color: "#F59E0B" },
  { name: "Meeting Booked", order: 4, color: "#10B981" },
  { name: "Proposal Sent", order: 5, color: "#06B6D4" },
  { name: "Negotiation", order: 6, color: "#F97316" },
  { name: "Won", order: 7, color: "#22C55E", isWon: true },
  { name: "Lost", order: 8, color: "#EF4444", isLost: true },
  { name: "Nurture", order: 9, color: "#64748B" },
];

const TEMPLATES = [
  {
    name: "Intro — care home outreach",
    category: "intro",
    subject: "Freeing up {{name}}'s records — quick idea",
    body: `Hi {{firstName}},

I work with ScanVault Limited — we help UK care homes digitise their paper records (care plans, HR files, financial docs, compliance archives) into secure, searchable digital systems.

Care providers we work with typically see:
• Faster CQC inspection prep — every document retrievable in seconds
• Reclaimed office space currently eaten by filing cabinets
• GDPR-compliant retention with automatic audit trails

Would a short 15-minute call be useful to see if it's a fit for {{name}}?

Best regards,
ScanVault Limited
+44 7359 969266
Total Information Management`,
  },
  {
    name: "Follow-up — CQC rating angle",
    category: "follow-up",
    subject: "{{name}} and CQC documentation",
    body: `Hi {{firstName}},

Following up on my earlier note — I noticed {{name}}'s latest CQC rating and thought it worth reaching out.

A common theme in inspection feedback is documentation: care plans that can't be found quickly, audits on paper, records spread across offices. ScanVault digitises and organises the lot — searchable, secure, and inspection-ready.

Happy to share a 2-page overview of how it works for homes in {{town}}. Worth a look?

Best regards,
ScanVault Limited`,
  },
  {
    name: "Breakup — last attempt",
    category: "breakup",
    subject: "Closing the loop — {{name}}",
    body: `Hi {{firstName}},

I've reached out a couple of times about digitising {{name}}'s paper records and haven't heard back — totally understand how busy things get running a care home.

I'll stop nudging, but if archiving, CQC prep or GDPR retention ever lands on your desk, we're here: ScanVault Limited, +44 7359 969266.

All the best,
ScanVault Limited`,
  },
];

async function main() {
  console.log("Seeding ScanVault Marketing CRM…");

  // Admin user
  const passwordHash = await bcrypt.hash("ScanVault2024!", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@scanvault.co.uk" },
    update: {},
    create: {
      email: "admin@scanvault.co.uk",
      name: "ScanVault Admin",
      passwordHash,
      role: "ADMIN",
    },
  });
  console.log(`Admin user: ${admin.email}`);

  // Pipeline stages
  for (const s of STAGES) {
    const existing = await prisma.pipelineStage.findFirst({ where: { name: s.name } });
    if (!existing) {
      await prisma.pipelineStage.create({ data: s });
    }
  }
  console.log(`${STAGES.length} pipeline stages ready`);

  // Email templates
  for (const t of TEMPLATES) {
    const existing = await prisma.emailTemplate.findFirst({ where: { name: t.name } });
    if (!existing) {
      await prisma.emailTemplate.create({ data: t });
    }
  }
  console.log(`${TEMPLATES.length} email templates ready`);

  // The canonical outreach cadence — every lead is auto-enrolled.
  // Resolve template names to IDs so the runner can render them.
  const tplByName = new Map(
    (await prisma.emailTemplate.findMany()).map((t) => [t.name, t.id])
  );
  const cadenceSteps = CADENCE.map((s) => ({
    order: s.order,
    delayDays: s.delayDays,
    type: s.type,
    label: s.label,
    subject: s.subject,
    templateId: s.templateName ? tplByName.get(s.templateName) : undefined,
    note: s.note,
  }));

  const seq = await prisma.sequence.findFirst({ where: { name: "ScanVault Outreach Cadence" } });
  if (!seq) {
    await prisma.sequence.create({
      data: {
        name: "ScanVault Outreach Cadence",
        description:
          "The standard workflow every lead follows: intro email → brochure post → follow-up call → follow-up email → final call → triage.",
        status: "ACTIVE",
        isDefault: true,
        steps: cadenceSteps,
      },
    });
    console.log("Default outreach cadence created");
  } else if (!seq.isDefault) {
    await prisma.sequence.update({
      where: { id: seq.id },
      data: { isDefault: true, status: "ACTIVE", steps: cadenceSteps },
    });
    console.log("Outreach cadence set as default");
  }

  // Starter tags
  const tags = [
    { name: "Hot prospect", color: "#DC2626" },
    { name: "CQC improvement", color: "#F59E0B" },
    { name: "Group account", color: "#8B5CF6" },
    { name: "Dementia specialist", color: "#06B6D4" },
  ];
  for (const t of tags) {
    await prisma.tag.upsert({ where: { name: t.name }, update: {}, create: t });
  }
  console.log(`${tags.length} tags ready`);

  console.log("Done. Login: admin@scanvault.co.uk / ScanVault2024!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
