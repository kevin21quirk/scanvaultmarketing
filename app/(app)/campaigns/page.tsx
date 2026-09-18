import { prisma } from "@/lib/db";
import { CampaignsPanel } from "@/components/campaigns-panel";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const [campaigns, templates] = await Promise.all([
    prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { leads: true } },
        leads: {
          select: { status: true },
        },
      },
    }),
    prisma.emailTemplate.findMany({ orderBy: { name: "asc" } }),
  ]);

  const data = campaigns.map((c) => {
    const counts = c.leads.reduce<Record<string, number>>((acc, l) => {
      acc[l.status] = (acc[l.status] || 0) + 1;
      return acc;
    }, {});
    return {
      id: c.id,
      name: c.name,
      type: c.type,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      total: c._count.leads,
      sent: counts.SENT || 0,
      replied: counts.REPLIED || 0,
      bounced: counts.BOUNCED || 0,
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-scanvault-black">Campaigns</h1>
        <p className="text-sm text-muted-foreground">
          Targeted outreach pushes — email blasts, call campaigns, mail drops.
        </p>
      </div>
      <CampaignsPanel campaigns={data} templates={templates} />
    </div>
  );
}
