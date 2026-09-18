"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Stage = { id: string; name: string; color: string };

export function LeadStageSelect({
  leadId,
  stages,
  currentStageId,
}: {
  leadId: string;
  stages: Stage[];
  currentStageId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function change(stageId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/leads/${leadId}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId }),
      });
      if (res.ok) {
        toast.success("Stage updated");
        router.refresh();
      } else toast.error("Failed to update stage");
    });
  }

  return (
    <Select value={currentStageId || ""} onValueChange={change} disabled={pending}>
      <SelectTrigger className="w-[190px] bg-white">
        <SelectValue placeholder="Set stage…" />
      </SelectTrigger>
      <SelectContent>
        {stages.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
