import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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

  // Starter sequence
  const seq = await prisma.sequence.findFirst({ where: { name: "Care Home Intro Drip" } });
  if (!seq) {
    await prisma.sequence.create({
      data: {
        name: "Care Home Intro Drip",
        description: "Standard 4-touch outreach for newly imported care homes",
        status: "ACTIVE",
        steps: [
          { delayDays: 0, type: "EMAIL", subject: "Freeing up {{name}}'s records — quick idea" },
          { delayDays: 3, type: "CALL", note: "Intro call — ask for registered manager, mention CQC documentation" },
          { delayDays: 7, type: "EMAIL", subject: "{{name}} and CQC documentation" },
          { delayDays: 14, type: "TASK", note: "Final attempt — send breakup email or move to Nurture" },
        ],
      },
    });
    console.log("Starter sequence created");
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
