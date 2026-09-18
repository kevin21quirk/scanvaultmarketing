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
import { Plus, FileText, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

type Template = {
  id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
};

export function TemplatesPanel({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", category: "general", subject: "", body: "" });

  function startEdit(t: Template) {
    setEditing(t);
    setForm({ name: t.name, category: t.category, subject: t.subject, body: t.body });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = editing
      ? await fetch(`/api/templates/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
      : await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
    setSaving(false);
    if (res.ok) {
      toast.success(editing ? "Template updated" : "Template created");
      setOpen(false);
      setEditing(null);
      setForm({ name: "", category: "general", subject: "", body: "" });
      router.refresh();
    } else toast.error("Failed");
  }

  async function remove(id: string) {
    if (!confirm("Delete this template?")) return;
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Deleted");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) {
              setEditing(null);
              setForm({ name: "", category: "general", subject: "", body: "" });
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Template" : "New Template"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Intro — CQC follow-up"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Subject *</Label>
                <Input
                  required
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Freeing up {{name}}'s records"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Body *</Label>
                <Textarea
                  required
                  rows={10}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder={"Hi {{firstName}},\n\nI noticed {{name}} in {{town}} ..."}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Merge fields: {"{{name}}"}, {"{{firstName}}"}, {"{{town}}"}, {"{{providerName}}"},{" "}
                  {"{{cqcRating}}"}
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Create template"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {templates.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No templates yet — create your first outreach script.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((t) => (
          <Card key={t.id} className="group">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">{t.name}</CardTitle>
                  <Badge variant="muted" className="mt-1 text-[10px]">
                    {t.category}
                  </Badge>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(t)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-scanvault-red"
                    onClick={() => remove(t.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium truncate">{t.subject}</p>
              <p className="text-xs text-muted-foreground line-clamp-3 mt-1 whitespace-pre-wrap">
                {t.body}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
