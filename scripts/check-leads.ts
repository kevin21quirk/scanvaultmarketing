import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.lead.count();
  const withProvider = await prisma.lead.count({
    where: { providerName: { not: null } },
  });
  const withCH = await prisma.lead.count({
    where: { companiesHouseNo: { not: null } },
  });
  const eligible = await prisma.lead.count({
    where: { companiesHouseNo: null, providerName: { not: null } },
  });
  const bySource = await prisma.lead.groupBy({
    by: ["source"],
    _count: { _all: true },
  });
  const jobs = await prisma.importJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      source: true,
      status: true,
      totalFound: true,
      imported: true,
      duplicates: true,
      failed: true,
      errors: true,
      createdAt: true,
    },
  });
  const sample = await prisma.lead.findMany({
    take: 5,
    select: { name: true, providerName: true, cqcLocationId: true },
  });

  console.log("total leads:", total);
  console.log("with providerName:", withProvider);
  console.log("already enriched (CH no.):", withCH);
  console.log("eligible for enrichment:", eligible);
  console.log("by source:", bySource);
  console.log("recent import jobs:", JSON.stringify(jobs, null, 2));
  console.log("sample leads:", sample);
}

main().finally(() => prisma.$disconnect());
