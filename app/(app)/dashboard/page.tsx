import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  PhoneCall,
  CalendarClock,
  TrendingUp,
  PoundSterling,
  ArrowRight,
  Flame,
  Radar,
} from "lucide-react";
import { formatRelative, formatDate, formatCurrency, leadAddress } from "@/lib/utils";
import { DashboardCharts } from "@/components/dashboard-charts";
import { scoreLabel } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalLeads,
    newThisWeek,
    contactedThisWeek,
    overdueFollowUps,
    pipelineValue,
    stages,
    leadsByStage,
    leadsByRegion,
    recentActivities,
    upcomingFollowUps,
    hotLeads,
    leadsBySource,
    wonCount,
    activeCount,
  ] = await Promise.all([
    prisma.lead.count({ where: { status: { not: "ARCHIVED" } } }),
    prisma.lead.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.activity.count({ where: { occurredAt: { gte: weekAgo } } }),
    prisma.lead.count({
      where: { nextFollowUpAt: { lt: now }, status: { in: ["NEW", "ACTIVE"] } },
    }),
    prisma.lead.aggregate({
      _sum: { estimatedValue: true },
      where: { status: { in: ["NEW", "ACTIVE"] } },
    }),
    prisma.pipelineStage.findMany({ orderBy: { order: "asc" } }),
    prisma.lead.groupBy({
      by: ["stageId"],
      _count: { _all: true },
      where: { status: { in: ["NEW", "ACTIVE"] } },
    }),
    prisma.lead.groupBy({
      by: ["region"],
      _count: { _all: true },
      where: { status: { not: "ARCHIVED" }, region: { not: null } },
      orderBy: { _count: { region: "desc" } },
      take: 10,
    }),
    prisma.activity.findMany({
      orderBy: { occurredAt: "desc" },
      take: 8,
      include: { lead: { select: { id: true, name: true } }, user: { select: { name: true } } },
    }),
    prisma.lead.findMany({
      where: { nextFollowUpAt: { not: null }, status: { in: ["NEW", "ACTIVE"] } },
      orderBy: { nextFollowUpAt: "asc" },
      take: 8,
      include: { stage: true },
    }),
    prisma.lead.findMany({
      where: { status: { in: ["NEW", "ACTIVE"] } },
      orderBy: { score: "desc" },
      take: 6,
    }),
    prisma.lead.groupBy({
      by: ["source"],
      _count: { _all: true },
      where: { status: { not: "ARCHIVED" } },
    }),
    prisma.lead.count({ where: { status: "WON" } }),
    prisma.lead.count({ where: { status: "ACTIVE" } }),
  ]);

  const stageCounts = new Map(leadsByStage.map((s) => [s.stageId, s._count._all]));
  const funnel = stages.map((s) => ({
    name: s.name,
    count: stageCounts.get(s.id) ?? 0,
    color: s.color,
  }));
  const regionData = leadsByRegion.map((r) => ({
    name: r.region || "Unknown",
    count: r._count._all,
  }));
  const sourceData = leadsBySource.map((s) => ({
    name: s.source,
    count: s._count._all,
  }));

  const conversionRate =
    wonCount + activeCount > 0 ? Math.round((wonCount / (wonCount + activeCount)) * 100) : 0;

  const kpis = [
    { label: "Total Leads", value: totalLeads, icon: Users, sub: `+${newThisWeek} this week` },
    { label: "Touches (7d)", value: contactedThisWeek, icon: PhoneCall, sub: "calls, emails, meetings" },
    { label: "Overdue Follow-ups", value: overdueFollowUps, icon: CalendarClock, sub: "need attention", alert: overdueFollowUps > 0 },
    { label: "Pipeline Value", value: formatCurrency(pipelineValue._sum.estimatedValue), icon: PoundSterling, sub: `${conversionRate}% win rate` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-scanvault-black">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {user.name} — here&apos;s the state of the lead engine.
          </p>
        </div>
        <Link
          href="/discover"
          className="inline-flex items-center gap-2 rounded-md bg-scanvault-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          <Radar className="h-4 w-4" /> Find new leads
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className={k.alert ? "border-scanvault-red" : undefined}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">{k.label}</p>
                <k.icon className={`h-4 w-4 ${k.alert ? "text-scanvault-red" : "text-muted-foreground"}`} />
              </div>
              <p className={`mt-2 text-2xl font-bold ${k.alert ? "text-scanvault-red" : "text-scanvault-black"}`}>
                {k.value}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <DashboardCharts funnel={funnel} regions={regionData} sources={sourceData} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming follow-ups */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-scanvault-red" /> Follow-ups Due
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingFollowUps.length === 0 && (
              <p className="text-sm text-muted-foreground">No follow-ups scheduled.</p>
            )}
            {upcomingFollowUps.map((l) => {
              const overdue = l.nextFollowUpAt && l.nextFollowUpAt < now;
              return (
                <Link key={l.id} href={`/leads/${l.id}`} className="flex items-center justify-between gap-2 group">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-scanvault-red">{l.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{l.town || l.postcode || "—"}</p>
                  </div>
                  <Badge variant={overdue ? "destructive" : "secondary"} className="shrink-0">
                    {formatDate(l.nextFollowUpAt)}
                  </Badge>
                </Link>
              );
            })}
            <Link href="/leads?sort=nextFollowUpAt" className="inline-flex items-center gap-1 text-xs text-scanvault-red font-medium">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        {/* Hot leads */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="h-4 w-4 text-scanvault-red" /> Hottest Leads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {hotLeads.length === 0 && (
              <p className="text-sm text-muted-foreground">No leads yet — run a discovery import.</p>
            )}
            {hotLeads.map((l) => {
              const s = scoreLabel(l.score);
              return (
                <Link key={l.id} href={`/leads/${l.id}`} className="flex items-center justify-between gap-2 group">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-scanvault-red">{l.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{leadAddress(l) || "—"}</p>
                  </div>
                  <span
                    className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: s.color }}
                  >
                    {l.score}
                  </span>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-scanvault-red" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivities.length === 0 && (
              <p className="text-sm text-muted-foreground">No activity logged yet.</p>
            )}
            {recentActivities.map((a) => (
              <div key={a.id} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/leads/${a.leadId}`} className="font-medium truncate hover:text-scanvault-red">
                    {a.lead.name}
                  </Link>
                  <span className="text-xs text-muted-foreground shrink-0">{formatRelative(a.occurredAt)}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {a.type.toLowerCase()} {a.subject ? `· ${a.subject}` : ""} {a.user ? `· ${a.user.name}` : ""}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
