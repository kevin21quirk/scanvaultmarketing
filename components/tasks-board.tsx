"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Plus, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

type Task = {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  priority: string;
  status: string;
  lead: { id: string; name: string } | null;
  assignedTo: { name: string } | null;
};

export function TasksBoard({
  tasks,
  users,
  leads,
  currentUserId,
}: {
  tasks: Task[];
  users: { id: string; name: string }[];
  leads: { id: string; name: string }[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState("open");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    dueAt: "",
    priority: "MEDIUM",
    leadId: "",
    assignedToId: "",
  });

  const groups = useMemo(() => {
    const now = new Date();
    const open = tasks.filter((t) => t.status === "OPEN");
    const overdue = open.filter((t) => t.dueAt && new Date(t.dueAt) < now);
    const today = open.filter((t) => {
      if (!t.dueAt) return false;
      const d = new Date(t.dueAt);
      return d.toDateString() === now.toDateString();
    });
    const upcoming = open.filter((t) => {
      if (!t.dueAt) return true;
      return new Date(t.dueAt) > now && new Date(t.dueAt).toDateString() !== now.toDateString();
    });
    const done = tasks.filter((t) => t.status === "DONE");
    return { overdue, today, upcoming, done };
  }, [tasks]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        dueAt: form.dueAt || null,
        priority: form.priority,
        leadId: form.leadId || null,
        assignedToId: form.assignedToId || currentUserId,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Task created");
      setOpen(false);
      setForm({ title: "", dueAt: "", priority: "MEDIUM", leadId: "", assignedToId: "" });
      router.refresh();
    } else toast.error("Failed");
  }

  async function toggle(id: string, done: boolean) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: done ? "DONE" : "OPEN" }),
    });
    if (res.ok) router.refresh();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Task deleted");
      router.refresh();
    }
  }

  function TaskRow({ t }: { t: Task }) {
    const done = t.status === "DONE";
    return (
      <div className="flex items-start gap-3 py-2.5 group">
        <Checkbox
          checked={done}
          onCheckedChange={(v) => toggle(t.id, !!v)}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${done ? "line-through text-muted-foreground" : "font-medium"}`}>
            {t.title}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            {t.dueAt && <span>{formatDate(t.dueAt)}</span>}
            {t.lead && (
              <Link href={`/leads/${t.lead.id}`} className="hover:text-scanvault-red">
                {t.lead.name}
              </Link>
            )}
            {t.assignedTo && <span>· {t.assignedTo.name}</span>}
          </div>
        </div>
        <Badge
          variant={t.priority === "URGENT" ? "destructive" : t.priority === "HIGH" ? "warning" : "muted"}
          className="text-[10px] shrink-0"
        >
          {t.priority}
        </Badge>
        <button
          onClick={() => remove(t.id)}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-scanvault-red"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const visible =
    tab === "all"
      ? tasks
      : tab === "done"
        ? groups.done
        : tab === "overdue"
          ? groups.overdue
          : tab === "today"
            ? groups.today
            : tasks.filter((t) => t.status === "OPEN");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="open">Open ({tasks.filter((t) => t.status === "OPEN").length})</TabsTrigger>
            <TabsTrigger value="overdue">
              Overdue ({groups.overdue.length})
            </TabsTrigger>
            <TabsTrigger value="today">Today ({groups.today.length})</TabsTrigger>
            <TabsTrigger value="done">Done ({groups.done.length})</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> New Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Task</DialogTitle>
            </DialogHeader>
            <form onSubmit={add} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Title *</Label>
                <Input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Due date</Label>
                  <Input
                    type="date"
                    value={form.dueAt}
                    onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(v) => setForm({ ...form, priority: v })}
                  >
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
              </div>
              <div className="space-y-1.5">
                <Label>Linked lead</Label>
                <Select
                  value={form.leadId}
                  onValueChange={(v) => setForm({ ...form, leadId: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {leads.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Assign to</Label>
                <Select
                  value={form.assignedToId}
                  onValueChange={(v) => setForm({ ...form, assignedToId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Me" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Creating…" : "Create task"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="divide-y p-4">
          {visible.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No tasks here.</p>
          )}
          {visible.map((t) => (
            <TaskRow key={t.id} t={t} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
