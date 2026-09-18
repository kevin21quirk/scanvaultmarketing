import { Mail, Package, Phone, ClipboardCheck, Linkedin, Check } from "lucide-react";
import { formatDate } from "@/lib/utils";

// Visual cadence progress — shows where a lead sits in the outreach
// workflow (intro email → brochure → call → follow-up → triage) as a
// horizontal stepper. Pure server component.

type Step = {
  order?: number;
  delayDays?: number;
  type?: string;
  label?: string;
};

const ICONS: Record<string, React.ElementType> = {
  EMAIL: Mail,
  BROCHURE: Package,
  CALL: Phone,
  LINKEDIN: Linkedin,
  TASK: ClipboardCheck,
};

export function CadenceStepper({
  sequenceName,
  steps,
  currentStep,
  nextRunAt,
  status,
}: {
  sequenceName: string;
  steps: Step[];
  currentStep: number;
  nextRunAt: Date | null;
  status: string;
}) {
  const sorted = [...steps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const done = status === "COMPLETED";

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-scanvault-black">{sequenceName}</h3>
          <p className="text-xs text-muted-foreground">
            {done
              ? "Cadence complete — review and move to Nurture or convert"
              : status === "PAUSED"
                ? "Cadence paused"
                : nextRunAt
                  ? `Next step ${formatDate(nextRunAt)}`
                  : ""}
          </p>
        </div>
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
            done
              ? "bg-emerald-100 text-emerald-700"
              : status === "PAUSED"
                ? "bg-amber-100 text-amber-700"
                : "bg-scanvault-red/10 text-scanvault-red"
          }`}
        >
          {done ? "Done" : status === "PAUSED" ? "Paused" : `Step ${Math.min(currentStep + 1, sorted.length)} of ${sorted.length}`}
        </span>
      </div>

      <div className="flex items-center">
        {sorted.map((s, i) => {
          const Icon = ICONS[s.type ?? "TASK"] ?? ClipboardCheck;
          const isDone = done || i < currentStep;
          const isCurrent = !done && i === currentStep;
          return (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5 min-w-0">
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center border-2 transition-colors ${
                    isDone
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : isCurrent
                        ? "bg-scanvault-red border-scanvault-red text-white shadow-[0_0_0_4px_rgba(220,38,38,0.15)]"
                        : "bg-white border-neutral-300 text-neutral-400"
                  }`}
                >
                  {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span
                  className={`text-[10px] text-center leading-tight max-w-[80px] ${
                    isCurrent ? "font-bold text-scanvault-red" : isDone ? "text-emerald-700" : "text-muted-foreground"
                  }`}
                >
                  {s.label ?? s.type}
                </span>
                <span className="text-[9px] text-neutral-400">
                  {s.delayDays === 0 ? "Day 0" : `Day ${s.delayDays}`}
                </span>
              </div>
              {i < sorted.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-1 mb-8 rounded ${
                    i < currentStep || done ? "bg-emerald-400" : "bg-neutral-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
