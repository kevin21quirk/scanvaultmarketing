import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  PhoneCall,
  CalendarClock,
  TrendingUp,
  PoundSterling,
  ArrowRight,
  Flame,
  Radar,
  Activity as ActivityIcon,
  AlertTriangle,
  Building2,
  Target,
  Zap,
  Clock,
} from "lucide-react";
import { formatRelative, formatDate, formatCurrency, leadAddress } from "@/lib/utils";
import { LeadRadar } from "@/components/lead-radar";
import { LeadEngineWorkflow } from "@/components/lead-engine";
import { scoreLabel } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<string, string> = {
  CQC: "CQC Register",
  CSV: "CSV Import",
  COMPANIES_HOUSE: "Companies House",
  MANUAL: "Manual Entry",
  WEB_SEARCH: "Web Search",
};

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalLeads,
    newThisWeek,
    newToday,
    contactedThisWeek,
    overdueFollowUps,
    pipelineValue,
    leadsByRegion,
    recentActivities,
    upcomingFollowUps,
    hotLeads,
    leadsBySource,
    wonCount,
    activeCount,
    unenrichedCount,
    noContactCount,
    weakRatingCount,
    ratingChanges,
    lastImport,
    emailsSent,
    brochuresPending,
    callsDue,
  ] = await Promise.all([
    prisma.lead.count({ where: { status: { not: "ARCHIVED" } } }),
    prisma.lead.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.lead.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.activity.count({ where: { occurredAt: { gte: weekAgo } } }),
    prisma.lead.count({
      where: { nextFollowUpAt: { lt: now }, status: { in: ["NEW", "ACTIVE"] } },
    }),
    prisma.lead.aggregate({
      _sum: { estimatedValue: true },
      where: { status: { in: ["NEW", "ACTIVE"] } },
    }),
    prisma.lead.groupBy({
      by: ["region"],
      _count: { _all: true },
      where: { status: { not: "ARCHIVED" }, region: { not: null } },
      orderBy: { _count: { region: "desc" } },
      take: 12,
    }),
    prisma.activity.findMany({
      orderBy: { occurredAt: "desc" },
      take: 6,
      include: { lead: { select: { id: true, name: true } }, user: { select: { name: true } } },
    }),
    prisma.lead.findMany({
      where: { nextFollowUpAt: { not: null }, status: { in: ["NEW", "ACTIVE"] } },
      orderBy: { nextFollowUpAt: "asc" },
      take: 6,
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
    prisma.lead.count({
      where: { companiesHouseNo: null, status: { not: "ARCHIVED" } },
    }),
    prisma.lead.count({
      where: { status: { not: "ARCHIVED" }, contacts: { none: {} } },
    }),
    prisma.lead.count({
      where: {
        status: { not: "ARCHIVED" },
        cqcRating: { in: ["Inadequate", "Requires improvement"] },
      },
    }),
    prisma.activity.count({
      where: { subject: { contains: "CQC rating" } },
    }),
    prisma.importJob.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, imported: true, status: true, source: true },
    }),
    prisma.activity.count({ where: { type: "EMAIL" } }),
    prisma.task.count({
      where: { status: "OPEN", title: { contains: "brochure", mode: "insensitive" } },
    }),
    prisma.task.count({
      where: { status: "OPEN", title: { contains: "call", mode: "insensitive" } },
    }),
  ]);

  const conversionRate =
    wonCount + activeCount > 0
      ? Math.round((wonCount / (wonCount + activeCount)) * 100)
      : 0;

  const radarSources = leadsBySource.map((s) => ({
    label: SOURCE_LABELS[s.source] ?? s.source,
    count: s._count._all,
  }));
  const radarNodes = leadsByRegion.map((r) => ({
    label: r.region || "Unknown",
    count: r._count._all,
  }));

  // Rule-based "engine intelligence" — the insights panel.
  const insights: { icon: typeof Target; text: string; tone: string }[] = [];
  if (weakRatingCount > 0)
    insights.push({
      icon: Target,
      text: `${weakRatingCount} leads rated Inadequate / Requires Improvement — prime targets under compliance pressure.`,
      tone: "text-amber-400",
    });
  if (ratingChanges > 0)
    insights.push({
      icon: AlertTriangle,
      text: `${ratingChanges} CQC rating changes detected — check tasks for downgrade follow-ups.`,
      tone: "text-scanvault-red",
    });
  if (noContactCount > 0)
    insights.push({
      icon: Building2,
      text: `${noContactCount} leads have no contacts — run Companies House enrichment to find decision makers.`,
      tone: "text-sky-400",
    });
  if (unenrichedCount > 0)
    insights.push({
      icon: Zap,
      text: `${unenrichedCount} leads not yet enriched — batch enrichment adds directors & company data.`,
      tone: "text-neutral-400",
    });
  if (overdueFollowUps > 0)
    insights.push({
      icon: Clock,
      text: `${overdueFollowUps} follow-ups overdue — leads are going cold.`,
      tone: "text-scanvault-red",
    });
  if (insights.length === 0)
    insights.push({
      icon: TrendingUp,
      text: "Engine is healthy — all leads enriched with contacts and follow-ups on track.",
      tone: "text-emerald-400",
    });

  const kpis = [
    { label: "Leads in engine", value: totalLeads, icon: Radar, sub: `+${newThisWeek} this week` },
    { label: "Touches (7d)", value: contactedThisWeek, icon: PhoneCall, sub: "calls, emails, meetings" },
    { label: "Overdue follow-ups", value: overdueFollowUps, icon: CalendarClock, sub: "need attention", alert: overdueFollowUps > 0 },
    { label: "Pipeline value", value: formatCurrency(pipelineValue._sum.estimatedValue), icon: PoundSterling, sub: `${conversionRate}% win rate` },
  ];

  return (
    // Full-bleed dark "command centre" — overrides the light app bg for this page.
    <div className="-m-4 sm:-m-6 lg:-m-8 min-h-full bg-scanvault-black text-white p-4 sm:p-6 lg:p-8 space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Lead Engine</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
          </div>
          <p className="text-sm text-neutral-500">
            Welcome back, {user.name} — {newToday} new leads pulled in today.
          </p>
        </div>
        <Link
          href="/discover"
          className="inline-flex items-center gap-2 rounded-lg bg-scanvault-red px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
        >
          <Radar className="h-4 w-4" /> Full discovery console
        </Link>
      </div>

      {/* the cadence — the ONE workflow every lead follows */}
      <LeadEngineWorkflow
        scannedToday={newToday}
        emailed={emailsSent}
        brochuresPending={brochuresPending}
        callsDue={callsDue}
        won={wonCount}
      />

      {/* hero: radial graph + intelligence panel */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 relative overflow-hidden">
          <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-scanvault-red/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center justify-between mb-2 relative">
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400">
              Acquisition network
            </h2>
            {lastImport && (
              <span className="text-xs text-neutral-600">
                Last sync: {formatRelative(lastImport.createdAt)} ·{" "}
                {lastImport.imported} imported
              </span>
            )}
          </div>
          <LeadRadar
            total={totalLeads}
            sources={radarSources}
            nodes={radarNodes}
          />
        </div>

        {/* intelligence panel — styled like the reference's right rail */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400">
              Engine Intelligence
            </h2>
            <ActivityIcon className="h-4 w-4 text-scanvault-red" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {kpis.map((k) => (
              <div
                key={k.label}
                className={`rounded-xl border p-3 ${
                  k.alert
                    ? "border-scanvault-red/60 bg-scanvault-red/10"
                    : "border-neutral-800 bg-neutral-900/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    {k.label}
                  </p>
                  <k.icon
                    className={`h-3.5 w-3.5 ${k.alert ? "text-scanvault-red" : "text-neutral-600"}`}
                  />
                </div>
                <p
                  className={`mt-1.5 text-xl font-bold ${k.alert ? "text-scanvault-red" : "text-white"}`}
                >
                  {k.value}
                </p>
                <p className="text-[10px] text-neutral-600">{k.sub}</p>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-400" /> Engine insights
            </h3>
            <div className="space-y-2.5">
              {insights.map((ins, i) => (
                <div
                  key={i}
                  className="flex gap-2.5 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3"
                >
                  <ins.icon className={`h-4 w-4 shrink-0 mt-0.5 ${ins.tone}`} />
                  <p className="text-xs text-neutral-300 leading-relaxed">
                    {ins.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* bottom strip: hot leads / follow-ups / activity — dark cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DarkPanel title="Hottest Leads" icon={Flame}>
          {hotLeads.length === 0 && (
            <p className="text-sm text-neutral-600">
              No leads yet — hit "Run scan now" above.
            </p>
          )}
          {hotLeads.map((l) => {
            const s = scoreLabel(l.score);
            return (
              <Link
                key={l.id}
                href={`/leads/${l.id}`}
                className="flex items-center justify-between gap-2 group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate text-neutral-200 group-hover:text-scanvault-red">
                    {l.name}
                  </p>
                  <p className="text-xs text-neutral-600 truncate">
                    {leadAddress(l) || "—"}
                  </p>
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
        </DarkPanel>

        <DarkPanel title="Follow-ups Due" icon={CalendarClock}>
          {upcomingFollowUps.length === 0 && (
            <p className="text-sm text-neutral-600">No follow-ups scheduled.</p>
          )}
          {upcomingFollowUps.map((l) => {
            const overdue = l.nextFollowUpAt && l.nextFollowUpAt < now;
            return (
              <Link
                key={l.id}
                href={`/leads/${l.id}`}
                className="flex items-center justify-between gap-2 group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate text-neutral-200 group-hover:text-scanvault-red">
                    {l.name}
                  </p>
                  <p className="text-xs text-neutral-600 truncate">
                    {l.town || l.postcode || "—"}
                  </p>
                </div>
                <Badge
                  variant={overdue ? "destructive" : "secondary"}
                  className="shrink-0"
                >
                  {formatDate(l.nextFollowUpAt)}
                </Badge>
              </Link>
            );
          })}
          <Link
            href="/leads?sort=nextFollowUpAt"
            className="inline-flex items-center gap-1 text-xs text-scanvault-red font-medium"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </DarkPanel>

        <DarkPanel title="Recent Activity" icon={TrendingUp}>
          {recentActivities.length === 0 && (
            <p className="text-sm text-neutral-600">No activity logged yet.</p>
          )}
          {recentActivities.map((a) => (
            <div key={a.id} className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/leads/${a.leadId}`}
                  className="font-medium truncate text-neutral-200 hover:text-scanvault-red"
                >
                  {a.lead.name}
                </Link>
                <span className="text-xs text-neutral-600 shrink-0">
                  {formatRelative(a.occurredAt)}
                </span>
              </div>
              <p className="text-xs text-neutral-600 truncate">
                {a.type.toLowerCase()} {a.subject ? `· ${a.subject}` : ""}{" "}
                {a.user ? `· ${a.user.name}` : ""}
              </p>
            </div>
          ))}
        </DarkPanel>
      </div>
    </div>
  );
}

function DarkPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5">
      <h3 className="text-sm font-bold text-neutral-300 flex items-center gap-2 mb-4">
        <Icon className="h-4 w-4 text-scanvault-red" /> {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
