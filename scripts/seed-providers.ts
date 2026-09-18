import { PrismaClient } from "@prisma/client";

// Seeds the CRM with real, well-known UK care-home provider groups.
// These are real registered companies — Companies House enrichment
// will return genuine officer data for them. Run: npx tsx scripts/seed-providers.ts
// Useful while the CQC API is unavailable, and as a starter book of
// national accounts.

const prisma = new PrismaClient();

const PROVIDERS: {
  name: string;
  providerName: string;
  town: string;
  region: string;
  website?: string;
  careTypes?: string[];
  beds?: number;
}[] = [
  { name: "HC-One (national group)", providerName: "HC-One Limited", town: "Darlington", region: "North East", website: "https://www.hc-one.co.uk", careTypes: ["Residential", "Nursing", "Dementia"], beds: 20000 },
  { name: "Barchester Healthcare", providerName: "Barchester Healthcare Limited", town: "London", region: "London", website: "https://www.barchester.com", careTypes: ["Residential", "Nursing", "Dementia"], beds: 13000 },
  { name: "Care UK", providerName: "Care UK Community Partnerships Ltd", town: "Colchester", region: "East of England", website: "https://www.careuk.com", careTypes: ["Residential", "Nursing"], beds: 8000 },
  { name: "Four Seasons Health Care", providerName: "Four Seasons Health Care Limited", town: "Wilmslow", region: "North West", website: "https://www.fshc.co.uk", careTypes: ["Nursing", "Dementia"], beds: 6000 },
  { name: "Maria Mallaband Care Group", providerName: "Maria Mallaband Care Group Limited", town: "Leeds", region: "Yorkshire and The Humber", website: "https://www.mmcgcarehomes.co.uk", careTypes: ["Residential", "Dementia"], beds: 4500 },
  { name: "Anchor Hanover", providerName: "Anchor Hanover Group", town: "London", region: "London", website: "https://www.anchorhanover.org.uk", careTypes: ["Residential", "Retirement"], beds: 5500 },
  { name: "Bupa Care Homes", providerName: "Bupa Care Homes (CFCHomes) Limited", town: "London", region: "London", website: "https://www.bupa.co.uk/care-services", careTypes: ["Nursing", "Residential"], beds: 6000 },
  { name: "Sanctuary Care", providerName: "Sanctuary Care Limited", town: "Worcester", region: "West Midlands", website: "https://www.sanctuary-care.co.uk", careTypes: ["Residential", "Nursing", "Dementia"], beds: 4500 },
  { name: "Avery Healthcare", providerName: "Avery Healthcare Group Limited", town: "Leicester", region: "East Midlands", website: "https://www.averyhealthcare.co.uk", careTypes: ["Residential", "Dementia"], beds: 4000 },
  { name: "Runwood Homes", providerName: "Runwood Homes Limited", town: "Dunmow", region: "East of England", website: "https://www.runwoodhomes.co.uk", careTypes: ["Residential", "Dementia"], beds: 5500 },
  { name: "Minster Care Group", providerName: "Minster Care Group Limited", town: "London", region: "London", website: "https://www.minstercaregroup.co.uk", careTypes: ["Residential", "Nursing"], beds: 3500 },
  { name: "Caring Homes Group", providerName: "Caring Homes Healthcare Group Limited", town: "Colchester", region: "East of England", website: "https://www.caringhomes.org", careTypes: ["Residential", "Nursing", "Dementia"], beds: 4000 },
  { name: "Hallmark Care Homes", providerName: "Hallmark Care Homes Holdings Limited", town: "Billericay", region: "East of England", website: "https://www.hallmarkcarehomes.co.uk", careTypes: ["Residential", "Dementia"], beds: 1500 },
  { name: "Sunrise Senior Living UK", providerName: "Sunrise Senior Living Limited", town: "Beaconsfield", region: "South East", website: "https://www.sunrise-care.co.uk", careTypes: ["Residential", "Dementia"], beds: 2500 },
  { name: "Signature Senior Lifestyle", providerName: "Signature Senior Lifestyle Limited", town: "London", region: "London", website: "https://www.signaturesl.co.uk", careTypes: ["Residential", "Dementia"], beds: 2000 },
  { name: "MHA (Methodist Homes)", providerName: "Methodist Homes", town: "Derby", region: "East Midlands", website: "https://www.mha.org.uk", careTypes: ["Residential", "Dementia"], beds: 4500 },
  { name: "Cornwall Care", providerName: "Cornwall Care Limited", town: "Truro", region: "South West", website: "https://www.cornwallcare.org", careTypes: ["Residential", "Nursing"], beds: 800 },
  { name: "Brunelcare", providerName: "Brunelcare", town: "Bristol", region: "South West", website: "https://www.brunelcare.org.uk", careTypes: ["Residential", "Nursing"], beds: 600 },
  { name: "OSJCT (Orders of St John Care Trust)", providerName: "The Orders of St John Care Trust", town: "Lincoln", region: "East Midlands", website: "https://www.osjct.co.uk", careTypes: ["Residential", "Nursing"], beds: 4000 },
  { name: "Excelcare Holdings", providerName: "Excelcare Holdings Limited", town: "London", region: "London", website: "https://www.excelcareholdings.com", careTypes: ["Residential", "Dementia"], beds: 1500 },
];

async function main() {
  const defaultStage = await prisma.pipelineStage.findFirst({
    where: { isDefault: true },
  });
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });

  let created = 0;
  let skipped = 0;
  for (const p of PROVIDERS) {
    const existing = await prisma.lead.findFirst({
      where: { providerName: p.providerName },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.lead.create({
      data: {
        name: p.name,
        type: "CARE_HOME",
        town: p.town,
        region: p.region,
        country: "England",
        website: p.website ?? null,
        providerName: p.providerName,
        beds: p.beds ?? null,
        careTypes: p.careTypes ?? [],
        source: "MANUAL",
        sourceDetail: "Provider seed list",
        stageId: defaultStage?.id ?? null,
        assignedToId: admin?.id ?? null,
        notes:
          "National/regional care-home group — seed entry. Enrich via Companies House to pull directors, then find individual homes via the CQC register.",
      },
    });
    created++;
  }
  console.log(`Seeded ${created} provider leads (${skipped} already existed).`);
}

main().finally(() => prisma.$disconnect());
