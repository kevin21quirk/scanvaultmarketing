"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Radar,
  Mail,
  Package,
  Phone,
  Trophy,
  ChevronRight,
  Loader2,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

// The lead-acquisition workflow shown at the top of the dashboard —
// mirrors the ScanVault Outreach Cadence so what you see IS what runs:
// Scan → Intro email → Brochure → Call → Convert.

export function LeadEngineWorkflow({
  scannedToday,
  emailed,
  brochuresPending,
  callsDue,
  won,
}: {
  scannedToday: number;
  emailed: number;
  brochuresPending: number;
  callsDue: number;
  won: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function runScan() {
    setRunning("scan");
    setDone(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/discover/cqc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "import",
            params: { careHome: true },
            maxPages: 1,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          toast.success(
            `Scan complete — ${data.imported} new leads pulled in & enrolled in the cadence`
          );
          setDone("scan");
          router.refresh();
        } else {
          toast.error(data.error ?? "Scan failed");
        }
      } catch {
        toast.error("Scan failed — CQC API may be down");
      } finally {
        setRunning(null);
      }
    });
  }

  const steps = [
    {
      key: "scan",
      icon: Radar,
      title: "Scan",
      desc: "Care homes pulled from the CQC register — auto-enrolled in the cadence",
      stat: `${scannedToday} today`,
      action: runScan,
      actionLabel: "Run scan now",
      accent: "from-red-600 to-red-800",
      auto: "auto-enrols",
    },
    {
      key: "email",
      icon: Mail,
      title: "Email",
      desc: "Intro email sent on day 0 to every lead",
      stat: `${emailed} sent`,
      href: "/sequences",
      actionLabel: "View cadence",
      accent: "from-sky-500 to-sky-700",
      auto: "day 0 · auto",
    },
    {
      key: "brochure",
      icon: Package,
      title: "Brochure",
      desc: "Brochure pack posted on day 1 when there's an address",
      stat: `${brochuresPending} to post`,
      href: "/tasks",
      actionLabel: "Post queue",
      accent: "from-amber-500 to-amber-700",
      auto: "day 1 · auto",
    },
    {
      key: "call",
      icon: Phone,
      title: "Call",
      desc: "Follow-up call a week later, then final call day 21",
      stat: `${callsDue} calls due`,
      href: "/tasks",
      actionLabel: "Call queue",
      accent: "from-violet-500 to-violet-700",
      auto: "day 7 · auto",
    },
    {
      key: "convert",
      icon: Trophy,
      title: "Convert",
      desc: "Responded leads move through the pipeline to won",
      stat: `${won} won`,
      href: "/pipeline",
      actionLabel: "View pipeline",
      accent: "from-emerald-500 to-emerald-700",
      auto: "kanban",
    },
  ];

  return (
    <div className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 p-5 relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-scanvault-red/10 rounded-full blur-3xl pointer-events-none" />
      <div className="flex items-center justify-between mb-4 relative">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-300">
            Outreach cadence — every lead follows this automatically
          </h2>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
          runs daily · no manual work until a call lands
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 relative">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className="flex-1 rounded-xl border border-neutral-800 bg-neutral-950/80 p-4 hover:border-neutral-600 transition-colors">
              <div className="flex items-center justify-between">
                <div
                  className={`h-9 w-9 rounded-lg bg-gradient-to-br ${s.accent} flex items-center justify-center`}
                >
                  <s.icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-neutral-600">
                  {s.auto}
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <p className="text-sm font-bold text-white">{s.title}</p>
                <span className="text-[11px] font-semibold text-amber-400">
                  {s.stat}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5 leading-snug">
                {s.desc}
              </p>
              {s.href ? (
                <Link
                  href={s.href}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-scanvault-red hover:text-red-400"
                >
                  {s.actionLabel} <ChevronRight className="h-3 w-3" />
                </Link>
              ) : (
                <button
                  onClick={s.action}
                  disabled={pending}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-scanvault-red hover:text-red-400 disabled:opacity-50"
                >
                  {running === s.key ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : done === s.key ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  ) : null}
                  {s.actionLabel}
                </button>
              )}
            </div>
            {i < steps.length - 1 && (
              <ChevronRight className="h-4 w-4 text-neutral-700 shrink-0 hidden xl:block" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
