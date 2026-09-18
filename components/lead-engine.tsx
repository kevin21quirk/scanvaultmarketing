"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Radar,
  Building2,
  Workflow,
  Trophy,
  ChevronRight,
  Loader2,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

// The lead-acquisition workflow shown at the top of the dashboard.
// Each step is a real action: scan the CQC register, enrich via
// Companies House, push into sequences, then convert on the pipeline.

export function LeadEngineWorkflow({
  scannedToday,
  unenriched,
  inSequences,
  won,
}: {
  scannedToday: number;
  unenriched: number;
  inSequences: number;
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
            `Scan complete — ${data.imported} new leads pulled in (${data.duplicates} refreshed)`
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

  function runEnrich() {
    setRunning("enrich");
    setDone(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/enrich/companies-house", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batch: true, limit: 15 }),
        });
        const data = await res.json();
        if (res.ok) {
          toast.success(
            `Enriched ${data.enriched}/${data.processed} leads with Companies House data`
          );
          setDone("enrich");
          router.refresh();
        } else {
          toast.error(data.error ?? "Enrichment failed");
        }
      } catch {
        toast.error("Enrichment failed");
      } finally {
        setRunning(null);
      }
    });
  }

  const steps = [
    {
      key: "scan",
      icon: Radar,
      title: "1 · Scan",
      desc: "Pull care homes from the CQC register",
      stat: `${scannedToday} today`,
      action: runScan,
      actionLabel: "Run scan now",
      accent: "from-red-600 to-red-800",
    },
    {
      key: "enrich",
      icon: Building2,
      title: "2 · Enrich",
      desc: "Add directors & contacts via Companies House",
      stat: `${unenriched} awaiting`,
      action: runEnrich,
      actionLabel: "Enrich batch",
      accent: "from-amber-500 to-amber-700",
    },
    {
      key: "engage",
      icon: Workflow,
      title: "3 · Engage",
      desc: "Drip sequences, campaigns & outreach",
      stat: `${inSequences} in sequences`,
      href: "/sequences",
      actionLabel: "Open sequences",
      accent: "from-sky-500 to-sky-700",
    },
    {
      key: "convert",
      icon: Trophy,
      title: "4 · Convert",
      desc: "Move leads through the pipeline to won",
      stat: `${won} won`,
      href: "/pipeline",
      actionLabel: "View pipeline",
      accent: "from-emerald-500 to-emerald-700",
    },
  ];

  return (
    <div className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 p-5 relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-scanvault-red/10 rounded-full blur-3xl pointer-events-none" />
      <div className="flex items-center gap-2 mb-4 relative">
        <Zap className="h-4 w-4 text-amber-400" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-300">
          Lead Engine — how leads flow in
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 relative">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className="flex-1 rounded-xl border border-neutral-800 bg-neutral-950/80 p-4 hover:border-neutral-600 transition-colors">
              <div className="flex items-center justify-between">
                <div
                  className={`h-9 w-9 rounded-lg bg-gradient-to-br ${s.accent} flex items-center justify-center`}
                >
                  <s.icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  {s.stat}
                </span>
              </div>
              <p className="mt-3 text-sm font-bold text-white">{s.title}</p>
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
