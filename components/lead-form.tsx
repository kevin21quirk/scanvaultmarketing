"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { UK_REGIONS, LEAD_TYPES, CQC_RATINGS, CARE_TYPES, LEAD_SOURCES } from "@/lib/constants";
import { toast } from "sonner";

type LeadData = {
  id?: string;
  name?: string;
  akaName?: string | null;
  type?: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  town?: string | null;
  county?: string | null;
  postcode?: string | null;
  region?: string | null;
  country?: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  cqcLocationId?: string | null;
  cqcRating?: string | null;
  beds?: number | null;
  careTypes?: string[];
  providerName?: string | null;
  stageId?: string | null;
  source?: string;
  priority?: string;
  estimatedValue?: number | null;
  nextFollowUpAt?: string | Date | null;
  notes?: string | null;
};

export function LeadForm({
  lead,
  stages,
}: {
  lead?: LeadData;
  stages: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: lead?.name || "",
    akaName: lead?.akaName || "",
    type: lead?.type || "CARE_HOME",
    addressLine1: lead?.addressLine1 || "",
    town: lead?.town || "",
    county: lead?.county || "",
    postcode: lead?.postcode || "",
    region: lead?.region || "",
    phone: lead?.phone || "",
    email: lead?.email || "",
    website: lead?.website || "",
    cqcLocationId: lead?.cqcLocationId || "",
    cqcRating: lead?.cqcRating || "",
    beds: lead?.beds?.toString() || "",
    providerName: lead?.providerName || "",
    stageId: lead?.stageId || "",
    source: lead?.source || "MANUAL",
    priority: lead?.priority || "MEDIUM",
    estimatedValue: lead?.estimatedValue?.toString() || "",
    nextFollowUpAt: lead?.nextFollowUpAt
      ? new Date(lead.nextFollowUpAt).toISOString().slice(0, 10)
      : "",
    notes: lead?.notes || "",
  });
  const [careTypes, setCareTypes] = useState<string[]>(lead?.careTypes || []);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function toggleCareType(t: string) {
    setCareTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      email: form.email || null,
      beds: form.beds ? Number(form.beds) : null,
      estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : null,
      nextFollowUpAt: form.nextFollowUpAt || null,
      stageId: form.stageId || null,
      careTypes,
    };
    const res = lead?.id
      ? await fetch(`/api/leads/${lead.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      toast.success(lead?.id ? "Lead updated" : "Lead created");
      router.push(`/leads/${data.id || lead?.id}`);
      router.refresh();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Save failed");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Organisation</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Care home / organisation name *</Label>
            <Input required value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Also known as</Label>
            <Input value={form.akaName} onChange={(e) => set("akaName", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => set("type", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Provider / group</Label>
            <Input
              value={form.providerName}
              onChange={(e) => set("providerName", e.target.value)}
              placeholder="e.g. HC-One, Barchester"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Beds</Label>
            <Input
              type="number"
              min={0}
              value={form.beds}
              onChange={(e) => set("beds", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Location</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Address</Label>
            <Input
              value={form.addressLine1}
              onChange={(e) => set("addressLine1", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Town / city</Label>
            <Input value={form.town} onChange={(e) => set("town", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>County</Label>
            <Input value={form.county} onChange={(e) => set("county", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Postcode</Label>
            <Input value={form.postcode} onChange={(e) => set("postcode", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Region</Label>
            <Select value={form.region} onValueChange={(v) => set("region", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select region" />
              </SelectTrigger>
              <SelectContent>
                {UK_REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Contact Channels</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input value={form.website} onChange={(e) => set("website", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Care Sector Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>CQC location ID</Label>
              <Input
                value={form.cqcLocationId}
                onChange={(e) => set("cqcLocationId", e.target.value)}
                placeholder="1-XXXXXXXXX"
              />
            </div>
            <div className="space-y-1.5">
              <Label>CQC rating</Label>
              <Select
                value={form.cqcRating}
                onValueChange={(v) => set("cqcRating", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unknown" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unknown</SelectItem>
                  {CQC_RATINGS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Care types</Label>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {CARE_TYPES.map((t) => (
                <label key={t} className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={careTypes.includes(t)}
                    onCheckedChange={() => toggleCareType(t)}
                  />
                  {t}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">CRM</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Pipeline stage</Label>
            <Select value={form.stageId} onValueChange={(v) => set("stageId", v)}>
              <SelectTrigger>
                <SelectValue placeholder="No stage" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Source</Label>
            <Select value={form.source} onValueChange={(v) => set("source", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_SOURCES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Estimated value (£)</Label>
            <Input
              type="number"
              min={0}
              value={form.estimatedValue}
              onChange={(e) => set("estimatedValue", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Next follow-up</Label>
            <Input
              type="date"
              value={form.nextFollowUpAt}
              onChange={(e) => set("nextFollowUpAt", e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Notes</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : lead?.id ? "Save changes" : "Create lead"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
