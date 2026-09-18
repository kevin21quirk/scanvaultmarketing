"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Workflow, Trash2, Mail, Phone, CheckSquare, Linkedin } from "lucide-react";
import { toast } from "sonner";

type Step = { delayDays: number; type: string; subject?: string; note?: string };

type Sequence = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  steps: Step[];
  enrolled: number;
  active: number;
  replied: number;
};

const STEP_ICONS: Record<string, React.ElementType> = {
  EMAIL: Mail,
  CALL: Phone,
  TASK: CheckSquare,
  LINKEDIN: Linkedin,
};

export function SequencesPanel({
  sequences,
  templates,
}: {
  sequences: Sequence[];
  templates: { id: string; name: string; subject: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<Step[]>([
    { delayDays: 0, type: "EMAIL", subject: "" },
    { delayDays: 3, type: "CALL", note: "" },
    { delayDays: 7, type: "EMAIL", subject: "" },
  ]);

  function updateStep(i: number, patch: Partial<Step>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/sequences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: description || null, steps }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Sequence created — enroll leads from any lead page");
      setOpen(false);
      setName("");
      setDescription("");
      router.refresh();
    } else toast.error("Failed");
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> New Sequence
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>New Sequence</DialogTitle>
            </DialogHeader>
            <form onSubmit={create} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Care home intro drip"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Steps</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSteps([...steps, { delayDays: 7, type: "EMAIL", subject: "" }])
                    }
                  >
                    <Plus className="h-4 w-4" /> Add step
                  </Button>
                </div>
                {steps.map((step, i) => {
                  const Icon = STEP_ICONS[step.type] || Mail;
                  return (
                    <div key={i} className="flex items-center gap-2 rounded-lg border p-2.5">
                      <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Day</span>
                        <Input
                          type="number"
                          min={0}
                          className="w-16 h-8 text-xs"
                          value={step.delayDays}
                          onChange={(e) =>
                            updateStep(i, { delayDays: Number(e.target.value) })
                          }
                        />
                      </div>
                      <Select
                        value={step.type}
                        onValueChange={(v) => updateStep(i, { type: v })}
                      >
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EMAIL">Email</SelectItem>
                          <SelectItem value="CALL">Call</SelectItem>
                          <SelectItem value="TASK">Task</SelectItem>
                          <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        className="flex-1 h-8 text-xs"
                        placeholder={step.type === "EMAIL" ? "Subject line" : "Note / script"}
                        value={step.subject || step.note || ""}
                        onChange={(e) =>
                          updateStep(
                            i,
                            step.type === "EMAIL"
                              ? { subject: e.target.value }
                              : { note: e.target.value }
                          )
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setSteps(steps.filter((_, idx) => idx !== i))}
                        className="text-muted-foreground hover:text-scanvault-red"
                        disabled={steps.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Creating…" : "Create sequence"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {sequences.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Workflow className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              No sequences yet. Build a drip workflow and enroll leads to automate follow-ups.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sequences.map((s) => (
          <Card key={s.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{s.name}</CardTitle>
                  {s.description && (
                    <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                  )}
                </div>
                <Badge variant={s.status === "ACTIVE" ? "success" : "muted"}>{s.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {s.steps.map((step, i) => {
                  const Icon = STEP_ICONS[step.type] || Mail;
                  return (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-[10px] font-medium"
                    >
                      <Icon className="h-3 w-3" />
                      D{step.delayDays} {step.type}
                    </span>
                  );
                })}
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>
                  <strong className="text-foreground">{s.enrolled}</strong> enrolled
                </span>
                <span>
                  <strong className="text-foreground">{s.active}</strong> active
                </span>
                <span>
                  <strong className="text-foreground">{s.replied}</strong> replied
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
