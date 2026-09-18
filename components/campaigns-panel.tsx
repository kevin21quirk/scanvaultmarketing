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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Megaphone, MoreHorizontal, Play, Pause, CheckCircle2, Archive } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

type Campaign = {
  id: string;
  name: string;
  type: string;
  status: string;
  createdAt: string;
  total: number;
  sent: number;
  replied: number;
  bounced: number;
};

export function CampaignsPanel({
  campaigns,
  templates,
}: {
  campaigns: Campaign[];
  templates: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "EMAIL",
    subject: "",
    bodyTemplate: "",
    templateId: "",
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        type: form.type,
        subject: form.subject || null,
        bodyTemplate: form.bodyTemplate || null,
        templateId: form.templateId || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Campaign created — add leads from the Leads page via bulk actions");
      setOpen(false);
      setForm({ name: "", type: "EMAIL", subject: "", bodyTemplate: "", templateId: "" });
      router.refresh();
    } else toast.error("Failed");
  }

  async function setStatus(id: string, status: string) {
    const res = await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success(`Campaign ${status.toLowerCase()}`);
      router.refresh();
    } else toast.error("Failed");
  }

  const statusVariant = (s: string) =>
    s === "ACTIVE" ? "success" : s === "PAUSED" ? "warning" : s === "COMPLETED" ? "info" : "muted";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>New Campaign</DialogTitle>
            </DialogHeader>
            <form onSubmit={create} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. March care home blitz"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMAIL">Email</SelectItem>
                      <SelectItem value="CALL_BLITZ">Call blitz</SelectItem>
                      <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
                      <SelectItem value="DIRECT_MAIL">Direct mail</SelectItem>
                      <SelectItem value="MIXED">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Template (optional)</Label>
                <Select
                  value={form.templateId}
                  onValueChange={(v) => setForm({ ...form, templateId: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Free up your office — digitise care records"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Body</Label>
                <Textarea
                  rows={6}
                  value={form.bodyTemplate}
                  onChange={(e) => setForm({ ...form, bodyTemplate: e.target.value })}
                  placeholder="Hi {{firstName}}, ..."
                />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Creating…" : "Create campaign"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {campaigns.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Megaphone className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              No campaigns yet. Create one, then select leads and add them via bulk actions.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {campaigns.map((c) => {
          const progress = c.total > 0 ? Math.round((c.sent / c.total) * 100) : 0;
          return (
            <Card key={c.id}>
              <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">{c.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {c.type.replace(/_/g, " ")} · created {formatDate(c.createdAt)}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {c.status !== "ACTIVE" && (
                      <DropdownMenuItem onClick={() => setStatus(c.id, "ACTIVE")}>
                        <Play className="h-4 w-4" /> Activate
                      </DropdownMenuItem>
                    )}
                    {c.status === "ACTIVE" && (
                      <DropdownMenuItem onClick={() => setStatus(c.id, "PAUSED")}>
                        <Pause className="h-4 w-4" /> Pause
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setStatus(c.id, "COMPLETED")}>
                      <CheckCircle2 className="h-4 w-4" /> Mark complete
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatus(c.id, "ARCHIVED")}>
                      <Archive className="h-4 w-4" /> Archive
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant={statusVariant(c.status) as never}>{c.status}</Badge>
                  <span className="text-xs text-muted-foreground">{c.total} leads</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full bg-scanvault-red transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>{c.sent} sent</span>
                  <span>{c.replied} replied</span>
                  <span>{c.bounced} bounced</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
