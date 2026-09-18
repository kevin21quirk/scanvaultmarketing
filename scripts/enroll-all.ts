import { enrollAllMissing, getDefaultSequence } from "../lib/cadence";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const seq = await getDefaultSequence();
  if (!seq) {
    console.log("No default ACTIVE sequence found — run npm run db:seed first");
    return;
  }
  console.log(`Default cadence: ${seq.name}`);
  const n = await enrollAllMissing();
  console.log(`Enrolled ${n} leads into the cadence`);
  const total = await prisma.sequenceEnrollment.count({
    where: { sequenceId: seq.id },
  });
  console.log(`Total enrollments: ${total}`);
}

main().finally(() => prisma.$disconnect());
