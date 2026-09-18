import { prisma } from "@/lib/db";
import { AnalyticsCharts } from "@/components/analytics-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [
    leads,
    activities,
    stages,
    bySource,
    byRegion,
    byType,
    byRating,
    activityByType,
    won,
    lost,
  ] = await Promise.all([
    prisma.lead.findMany({
      where: { createdAt: { gte: ninetyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.activity.findMany({
      where: { occurredAt: { gte: ninetyDaysAgo } },
      select: { occurredAt: true, type: true },
      orderBy: { occurredAt: "asc" },
    }),
    prisma.pipelineStage.findMany({ orderBy: { order: "asc" } }),
    prisma.lead.groupBy({ by: ["source"], _count: true, where: { status: { not: "ARCHIVED" } } }),
    prisma.lead.groupBy({
      by: ["region"],
      _count: true,
      where: { status: { not: "ARCHIVED" }, region: { not: null } },
      orderBy: { _count: { region: "desc" } },
      take: 12,
    }),
    prisma.lead.groupBy({ by: ["type"], _count: true, where: { status: { not: "ARCHIVED" } } }),
    prisma.lead.groupBy({
      by: ["cqcRating"],
      _count: true,
      where: { status: { not: "ARCHIVED" }, cqcRating: { not: null } },
    }),
    prisma.activity.groupBy({ by: ["type"], _count: true }),
    prisma.lead.count({ where: { status: "WON" } }),
    prisma.lead.count({ where: { status: "LOST" } }),
  ]);

  const stageCounts = await prisma.lead.groupBy({
    by: ["stageId"],
    _count: true,
    where: { status: { in: ["NEW", "ACTIVE"] } },
  });
  const stageMap = new Map(stageCounts.map((s) => [s.stageId, s._count]));

  // Bucket leads + activities by week
  function bucketByWeek(dates: Date[]) {
    const map = new Map<string, number>();
    for (const d of dates) {
      const dt = new Date(d);
      const day = dt.getDay();
      const monday = new Date(dt);
      monday.setDate(dt.getDate() - ((day + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, count]) => ({ week, count }));
  }

  const leadTrend = bucketByWeek(leads.map((l) => l.createdAt));
  const activityTrend = bucketByWeek(activities.map((a) => a.occurredAt));

  const funnel = stages.map((s) => ({
    name: s.name,
    count: stageMap.get(s.id) || 0,
    color: s.color,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-scanvault-black">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Lead engine performance — acquisition trends, pipeline health and outreach activity.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{won}</p>
            <p className="text-xs text-muted-foreground mt-1">Won</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-scanvault-red">{lost}</p>
            <p className="text-xs text-muted-foreground mt-1">Lost</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold">{activities.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Touches (90d)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold">{leads.length}</p>
            <p className="text-xs text-muted-foreground mt-1">New leads (90d)</p>
          </CardContent>
        </Card>
      </div>

      <AnalyticsCharts
        leadTrend={leadTrend}
        activityTrend={activityTrend}
        funnel={funnel}
        bySource={bySource.map((s) => ({ name: s.source, count: s._count }))}
        byRegion={byRegion.map((r) => ({ name: r.region || "?", count: r._count }))}
        byType={byType.map((t) => ({ name: t.type.replace(/_/g, " "), count: t._count }))}
        byRating={byRating.map((r) => ({ name: r.cqcRating || "?", count: r._count }))}
        activityByType={activityByType.map((a) => ({ name: a.type, count: a._count }))}
      />
    </div>
  );
}
