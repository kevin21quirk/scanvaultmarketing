"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

type Task = {
  id: string;
  title: string;
  dueAt: string | null;
  priority: string;
  status: string;
  assignedTo: { name: string } | null;
};

export function TasksPanel({
  leadId,
  tasks,
  users,
}: {
  leadId: string;
  tasks: Task[];
  users: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", dueAt: "", priority: "MEDIUM", assignedToId: "" });

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
        leadId,
        assignedToId: form.assignedToId || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Task added");
      setOpen(false);
      setForm({ title: "", dueAt: "", priority: "MEDIUM", assignedToId: "" });
      router.refresh();
    } else toast.error("Failed");
  }

  async function toggleTask(id: string, done: boolean) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: done ? "DONE" : "OPEN" }),
    });
    if (res.ok) router.refresh();
    else toast.error("Failed");
  }

  const priorityColor = (p: string) =>
    p === "URGENT"
      ? "text-red-600"
      : p === "HIGH"
        ? "text-amber-600"
        : p === "LOW"
          ? "text-gray-400"
          : "text-gray-600";

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Tasks ({tasks.filter((t) => t.status === "OPEN").length} open)</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4" /> Add
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
                  placeholder="e.g. Call back re: records audit"
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
                <Label>Assign to</Label>
                <Select
                  value={form.assignedToId}
                  onValueChange={(v) => setForm({ ...form, assignedToId: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Saving…" : "Add task"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.length === 0 && (
          <p className="text-sm text-muted-foreground">No tasks for this lead.</p>
        )}
        {tasks.map((t) => {
          const done = t.status === "DONE";
          const overdue = !done && t.dueAt && new Date(t.dueAt) < new Date();
          return (
            <div key={t.id} className="flex items-center gap-2.5">
              <Checkbox checked={done} onCheckedChange={(v) => toggleTask(t.id, !!v)} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${done ? "line-through text-muted-foreground" : ""}`}>
                  {t.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.dueAt ? formatDate(t.dueAt) : "No due date"}
                  {t.assignedTo ? ` · ${t.assignedTo.name}` : ""}
                </p>
              </div>
              <span className={`text-[10px] font-bold uppercase ${priorityColor(t.priority)}`}>
                {t.priority}
              </span>
              {overdue && <span className="text-[10px] font-bold text-scanvault-red">OVERDUE</span>}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
