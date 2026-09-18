"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Phone,
  Mail,
  Users,
  StickyNote,
  MessageSquare,
  Send,
  Linkedin,
  ArrowDownLeft,
  ArrowUpRight,
  History,
} from "lucide-react";
import { ACTIVITY_OUTCOMES } from "@/lib/constants";
import { formatRelative } from "@/lib/utils";
import { toast } from "sonner";

const TYPE_ICONS: Record<string, React.ElementType> = {
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Users,
  NOTE: StickyNote,
  SMS: MessageSquare,
  LETTER: Send,
  LINKEDIN: Linkedin,
  STAGE_CHANGE: History,
  IMPORT: History,
  WEBSITE_VISIT: Send,
  TASK_COMPLETED: History,
};

type Activity = {
  id: string;
  type: string;
  direction: string;
  outcome: string;
  subject: string | null;
  body: string | null;
  durationMin: number | null;
  occurredAt: string;
  user: { name: string } | null;
  contact: { firstName: string; lastName: string | null } | null;
};

export function ActivityPanel({
  leadId,
  contacts,
  activities,
}: {
  leadId: string;
  contacts: { id: string; name: string }[];
  activities: Activity[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: "CALL",
    direction: "OUTBOUND",
    outcome: "NONE",
    contactId: "",
    subject: "",
    body: "",
    durationMin: "",
    followUpAt: "",
  });

  async function log(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId,
        type: form.type,
        direction: form.direction,
        outcome: form.outcome,
        contactId: form.contactId || null,
        subject: form.subject || null,
        body: form.body || null,
        durationMin: form.durationMin ? Number(form.durationMin) : null,
        followUpAt: form.followUpAt || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Activity logged");
      setForm({
        type: "CALL",
        direction: "OUTBOUND",
        outcome: "NONE",
        contactId: "",
        subject: "",
        body: "",
        durationMin: "",
        followUpAt: "",
      });
      router.refresh();
    } else toast.error("Failed to log activity");
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Activity &amp; Outreach</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Log form */}
        <form onSubmit={log} className="rounded-lg border bg-gray-50 p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="bg-white h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CALL">Call</SelectItem>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="MEETING">Meeting</SelectItem>
                  <SelectItem value="SMS">SMS</SelectItem>
                  <SelectItem value="LETTER">Letter</SelectItem>
                  <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
                  <SelectItem value="NOTE">Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Direction</Label>
              <Select
                value={form.direction}
                onValueChange={(v) => setForm({ ...form, direction: v })}
              >
                <SelectTrigger className="bg-white h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OUTBOUND">Outbound</SelectItem>
                  <SelectItem value="INBOUND">Inbound</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Outcome</Label>
              <Select value={form.outcome} onValueChange={(v) => setForm({ ...form, outcome: v })}>
                <SelectTrigger className="bg-white h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_OUTCOMES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contact</Label>
              <Select
                value={form.contactId}
                onValueChange={(v) => setForm({ ...form, contactId: v === "none" ? "" : v })}
              >
                <SelectTrigger className="bg-white h-8 text-xs">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Subject</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="e.g. Intro call — spoke to manager"
                className="bg-white h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Duration (min)</Label>
              <Input
                type="number"
                min={0}
                value={form.durationMin}
                onChange={(e) => setForm({ ...form, durationMin: e.target.value })}
                className="bg-white h-8 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={2}
              placeholder="What was discussed? Next steps?"
              className="bg-white text-xs"
            />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Schedule follow-up</Label>
              <Input
                type="date"
                value={form.followUpAt}
                onChange={(e) => setForm({ ...form, followUpAt: e.target.value })}
                className="bg-white h-8 text-xs w-40"
              />
            </div>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Logging…" : "Log activity"}
            </Button>
          </div>
        </form>

        {/* Timeline */}
        <div className="space-y-4">
          {activities.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No activity yet — log your first touchpoint above.
            </p>
          )}
          {activities.map((a) => {
            const Icon = TYPE_ICONS[a.type] || History;
            return (
              <div key={a.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="h-8 w-8 rounded-full bg-gray-100 border flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-scanvault-black" />
                  </div>
                  <div className="flex-1 w-px bg-border mt-1" />
                </div>
                <div className="flex-1 pb-4 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {a.direction === "INBOUND" ? (
                        <ArrowDownLeft className="inline h-3 w-3 text-green-600 mr-1" />
                      ) : (
                        <ArrowUpRight className="inline h-3 w-3 text-scanvault-red mr-1" />
                      )}
                      {a.type.replace(/_/g, " ").toLowerCase()}
                    </span>
                    {a.outcome !== "NONE" && (
                      <Badge variant="muted" className="text-[10px]">
                        {a.outcome.replace(/_/g, " ").toLowerCase()}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatRelative(a.occurredAt)}
                    </span>
                  </div>
                  {a.subject && <p className="text-sm mt-0.5">{a.subject}</p>}
                  {a.body && (
                    <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">
                      {a.body}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {a.contact ? `with ${a.contact.firstName} ${a.contact.lastName || ""} · ` : ""}
                    {a.durationMin ? `${a.durationMin}min · ` : ""}
                    {a.user?.name || "system"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
