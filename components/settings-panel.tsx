"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { STAGE_COLORS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

type Stage = {
  id: string;
  name: string;
  order: number;
  color: string;
  isWon: boolean;
  isLost: boolean;
  isDefault: boolean;
  _count: { leads: number };
};

type Tag = { id: string; name: string; color: string; _count: { leads: number } };
type User = { id: string; name: string; email: string; role: string; createdAt: string };

export function SettingsPanel({
  stages,
  tags,
  users,
  isAdmin,
}: {
  stages: Stage[];
  tags: Tag[];
  users: User[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [newStage, setNewStage] = useState({ name: "", color: STAGE_COLORS[1] });
  const [newTag, setNewTag] = useState({ name: "", color: "#DC2626" });
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "" });

  async function addStage(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/stages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newStage),
    });
    if (res.ok) {
      toast.success("Stage added");
      setNewStage({ name: "", color: STAGE_COLORS[1] });
      router.refresh();
    } else toast.error("Failed — admin only");
  }

  async function deleteStage(id: string) {
    if (!confirm("Delete this stage? Leads in it will lose their stage.")) return;
    const res = await fetch(`/api/stages/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Stage deleted");
      router.refresh();
    } else toast.error("Failed");
  }

  async function moveStage(id: string, dir: -1 | 1) {
    const idx = stages.findIndex((s) => s.id === id);
    const swap = stages[idx + dir];
    if (!swap) return;
    await Promise.all([
      fetch(`/api/stages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: swap.order }),
      }),
      fetch(`/api/stages/${swap.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: stages[idx].order }),
      }),
    ]);
    router.refresh();
  }

  async function addTag(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTag),
    });
    if (res.ok) {
      toast.success("Tag added");
      setNewTag({ name: "", color: "#DC2626" });
      router.refresh();
    } else toast.error("Failed");
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    if (res.ok) {
      toast.success("User created");
      setNewUser({ name: "", email: "", password: "" });
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || "Failed — admin only");
    }
  }

  return (
    <Tabs defaultValue="pipeline">
      <TabsList>
        <TabsTrigger value="pipeline">Pipeline Stages</TabsTrigger>
        <TabsTrigger value="tags">Tags</TabsTrigger>
        <TabsTrigger value="users">Team</TabsTrigger>
        <TabsTrigger value="integrations">Integrations</TabsTrigger>
      </TabsList>

      <TabsContent value="pipeline" className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Workflow stages</CardTitle>
            <CardDescription>
              The pipeline your leads move through — reorder, recolour, add or remove.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {stages.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                <span className="h-3.5 w-3.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span className="flex-1 text-sm font-medium">{s.name}</span>
                {s.isDefault && <Badge variant="info" className="text-[10px]">default</Badge>}
                {s.isWon && <Badge variant="success" className="text-[10px]">won</Badge>}
                {s.isLost && <Badge variant="destructive" className="text-[10px]">lost</Badge>}
                <span className="text-xs text-muted-foreground">{s._count.leads} leads</span>
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => moveStage(s.id, -1)}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={i === stages.length - 1}
                    onClick={() => moveStage(s.id, 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-scanvault-red"
                      onClick={() => deleteStage(s.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {isAdmin && (
              <form onSubmit={addStage} className="flex items-center gap-2 pt-2">
                <Input
                  placeholder="New stage name"
                  value={newStage.name}
                  onChange={(e) => setNewStage({ ...newStage, name: e.target.value })}
                  required
                  className="max-w-xs"
                />
                <div className="flex gap-1">
                  {STAGE_COLORS.slice(0, 8).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewStage({ ...newStage, color: c })}
                      className={`h-6 w-6 rounded-full ${newStage.color === c ? "ring-2 ring-offset-2 ring-scanvault-black" : ""}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <Button type="submit" size="sm">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="tags" className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Lead tags</CardTitle>
            <CardDescription>Label and segment leads — e.g. &ldquo;Dementia specialist&rdquo;, &ldquo;Group&rdquo;, &ldquo;Priority&rdquo;.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white"
                  style={{ backgroundColor: t.color }}
                >
                  {t.name}
                  <span className="opacity-70">({t._count.leads})</span>
                </span>
              ))}
              {tags.length === 0 && <p className="text-sm text-muted-foreground">No tags yet.</p>}
            </div>
            <form onSubmit={addTag} className="flex items-center gap-2">
              <Input
                placeholder="New tag name"
                value={newTag.name}
                onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                required
                className="max-w-xs"
              />
              <input
                type="color"
                value={newTag.color}
                onChange={(e) => setNewTag({ ...newTag, color: e.target.value })}
                className="h-9 w-12 rounded border cursor-pointer"
              />
              <Button type="submit" size="sm">
                <Plus className="h-4 w-4" /> Add tag
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="users" className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Team members</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="divide-y">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 py-2.5">
                  <div className="h-8 w-8 rounded-full bg-scanvault-black text-white flex items-center justify-center text-xs font-bold">
                    {u.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>{u.role}</Badge>
                  <span className="text-xs text-muted-foreground">since {formatDate(u.createdAt)}</span>
                </div>
              ))}
            </div>
            {isAdmin && (
              <form onSubmit={addUser} className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t">
                <Input
                  placeholder="Name"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  required
                />
                <Input
                  type="email"
                  placeholder="Email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  required
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                  minLength={8}
                />
                <Button type="submit" size="sm" className="h-9">
                  <Plus className="h-4 w-4" /> Add user
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="integrations" className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Integrations &amp; API keys</CardTitle>
            <CardDescription>Configure in your <code>.env</code> / Vercel environment variables.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border p-3">
              <p className="font-medium">CQC API</p>
              <p className="text-xs text-muted-foreground">
                Set <code>CQC_API_KEY</code> — free partner key from the CQC developer portal for
                higher rate limits on the discovery engine.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">Companies House</p>
              <p className="text-xs text-muted-foreground">
                Set <code>COMPANIES_HOUSE_API_KEY</code> — enrich leads with company registration data.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">Outbound email (SMTP)</p>
              <p className="text-xs text-muted-foreground">
                Set <code>SMTP_HOST</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code>,{" "}
                <code>SMTP_FROM</code> to send campaign emails directly from the app.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">Database</p>
              <p className="text-xs text-muted-foreground">
                Neon Postgres via <code>DATABASE_URL</code> — use the pooled (-pooler) connection string.
              </p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
