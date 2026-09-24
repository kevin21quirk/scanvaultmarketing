"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Mail, Phone, Linkedin, Trash2, Star, ExternalLink } from "lucide-react";
import { initials } from "@/lib/utils";
import { toast } from "sonner";

type Contact = {
  id: string;
  firstName: string;
  lastName: string | null;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  linkedIn: string | null;
  isPrimary: boolean;
};

export function ContactsPanel({ leadId, contacts }: { leadId: string; contacts: Contact[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    jobTitle: "",
    email: "",
    phone: "",
    isPrimary: false,
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, leadId }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Contact added");
      setOpen(false);
      setForm({ firstName: "", lastName: "", jobTitle: "", email: "", phone: "", isPrimary: false });
      router.refresh();
    } else toast.error("Failed to add contact");
  }

  async function remove(id: string) {
    if (!confirm("Remove this contact?")) return;
    const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Contact removed");
      router.refresh();
    } else toast.error("Failed");
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Contacts ({contacts.length})</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Contact</DialogTitle>
            </DialogHeader>
            <form onSubmit={add} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>First name *</Label>
                  <Input
                    required
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Last name</Label>
                  <Input
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Job title</Label>
                <Input
                  value={form.jobTitle}
                  onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                  placeholder="e.g. Registered Manager"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isPrimary}
                  onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })}
                  className="rounded"
                />
                Primary contact
              </label>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Saving…" : "Add contact"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-3">
        {contacts.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No contacts yet — add the registered manager or decision maker.
          </p>
        )}
        {contacts.map((c) => (
          <div key={c.id} className="flex items-start gap-3 group">
            <Avatar className="h-9 w-9 mt-0.5">
              <AvatarFallback>{initials(`${c.firstName} ${c.lastName || ""}`)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">
                  {c.firstName} {c.lastName}
                </p>
                {c.isPrimary && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
              </div>
              {c.jobTitle && <p className="text-xs text-muted-foreground">{c.jobTitle}</p>}
              <div className="flex gap-2 mt-1 flex-wrap">
                {c.email && (
                  <a href={`mailto:${c.email}`} title={c.email}>
                    <Mail className="h-3.5 w-3.5 text-muted-foreground hover:text-scanvault-red" />
                  </a>
                )}
                {(c.phone || c.mobile) && (
                  <a href={`tel:${c.phone || c.mobile}`} title={c.phone || c.mobile || ""}>
                    <Phone className="h-3.5 w-3.5 text-muted-foreground hover:text-scanvault-red" />
                  </a>
                )}
                {c.linkedIn ? (
                  <a href={c.linkedIn} target="_blank" rel="noreferrer" title="LinkedIn profile">
                    <Linkedin className="h-3.5 w-3.5 text-[#0A66C2]" />
                  </a>
                ) : (
                  <a
                    href={`https://www.linkedin.com/sales/search/people?keywords=${encodeURIComponent(`${c.firstName} ${c.lastName || ""}`.trim())}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Search in Sales Navigator"
                    className="inline-flex items-center gap-0.5 text-[10px] text-[#0A66C2]/70 hover:text-[#0A66C2]"
                  >
                    <Linkedin className="h-3 w-3" />
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>
            </div>
            <button
              onClick={() => remove(c.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-scanvault-red"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
