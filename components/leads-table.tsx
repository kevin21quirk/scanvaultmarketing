"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  Globe,
  MoreHorizontal,
  Trash2,
  ArrowRightLeft,
  Archive,
  Linkedin,
} from "lucide-react";
import { formatDate, leadAddress } from "@/lib/utils";
import { scoreLabel } from "@/lib/scoring";
import { toast } from "sonner";

type Lead = {
  id: string;
  name: string;
  type: string;
  town: string | null;
  county: string | null;
  postcode: string | null;
  addressLine1: string | null;
  region: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  linkedinUrl: string | null;
  cqcRating: string | null;
  beds: number | null;
  score: number;
  source: string;
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
  createdAt: string;
  stage: { id: string; name: string; color: string } | null;
  tags: { tag: { id: string; name: string; color: string } }[];
  _count: { contacts: number; activities: number };
};

type Stage = { id: string; name: string; color: string };
type UserOpt = { id: string; name: string };

export function LeadsTable({
  leads,
  stages,
  users,
  page,
  totalPages,
  total,
  sort,
  dir,
}: {
  leads: Lead[];
  stages: Stage[];
  users: UserOpt[];
  page: number;
  totalPages: number;
  total: number;
  sort: string;
  dir: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  function sortBy(col: string) {
    const next = new URLSearchParams(params.toString());
    if (sort === col) next.set("dir", dir === "asc" ? "desc" : "asc");
    else {
      next.set("sort", col);
      next.set("dir", "desc");
    }
    next.delete("page");
    router.push(`/leads?${next.toString()}`);
  }

  function gotoPage(p: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(p));
    router.push(`/leads?${next.toString()}`);
  }

  function toggleAll() {
    if (selected.size === leads.length) setSelected(new Set());
    else setSelected(new Set(leads.map((l) => l.id)));
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function bulkAction(action: string, value?: string) {
    startTransition(async () => {
      const res = await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], action, value }),
      });
      if (!res.ok) {
        toast.error("Bulk action failed");
        return;
      }
      toast.success(`Updated ${selected.size} lead(s)`);
      setSelected(new Set());
      router.refresh();
    });
  }

  async function deleteLead(id: string) {
    if (!confirm("Delete this lead? This cannot be undone.")) return;
    const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Lead deleted");
      router.refresh();
    } else toast.error("Delete failed");
  }

  const ratingColor = (r: string | null) =>
    r === "Outstanding"
      ? "text-green-700"
      : r === "Good"
        ? "text-green-600"
        : r === "Requires improvement"
          ? "text-amber-600"
          : r === "Inadequate"
            ? "text-red-600"
            : "text-gray-500";

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-white p-2 px-4 shadow-sm">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={pending}>
                <ArrowRightLeft className="h-4 w-4" /> Move to stage
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Pipeline stage</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {stages.map((s) => (
                <DropdownMenuItem key={s.id} onClick={() => bulkAction("setStage", s.id)}>
                  <span className="mr-2 h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={pending}>
                Assign to
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {users.map((u) => (
                <DropdownMenuItem key={u.id} onClick={() => bulkAction("assign", u.id)}>
                  {u.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => bulkAction("archive")}
          >
            <Archive className="h-4 w-4" /> Archive
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-scanvault-red"
            disabled={pending}
            onClick={() => {
              if (confirm(`Delete ${selected.size} lead(s)?`)) bulkAction("delete");
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      )}

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/80">
              <TableHead className="w-10">
                <Checkbox
                  checked={leads.length > 0 && selected.size === leads.length}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>
                <button className="flex items-center gap-1 font-medium" onClick={() => sortBy("name")}>
                  Name <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>
                <button className="flex items-center gap-1 font-medium" onClick={() => sortBy("score")}>
                  Score <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>CQC</TableHead>
              <TableHead>Beds</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>
                <button
                  className="flex items-center gap-1 font-medium"
                  onClick={() => sortBy("nextFollowUpAt")}
                >
                  Follow-up <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                  No leads match your filters.{" "}
                  <Link href="/discover" className="text-scanvault-red font-medium">
                    Import leads from CQC →
                  </Link>
                </TableCell>
              </TableRow>
            )}
            {leads.map((l) => {
              const s = scoreLabel(l.score);
              return (
                <TableRow key={l.id}>
                  <TableCell>
                    <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggle(l.id)} />
                  </TableCell>
                  <TableCell>
                    <Link href={`/leads/${l.id}`} className="font-medium text-scanvault-black hover:text-scanvault-red">
                      {l.name}
                    </Link>
                    <div className="flex gap-1 mt-0.5 flex-wrap">
                      {l.tags.map((t) => (
                        <span
                          key={t.tag.id}
                          className="text-[10px] px-1.5 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: t.tag.color }}
                        >
                          {t.tag.name}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[220px]">
                    <span className="line-clamp-2">{leadAddress(l) || "—"}</span>
                  </TableCell>
                  <TableCell>
                    {l.stage ? (
                      <Badge variant="secondary" className="whitespace-nowrap">
                        <span
                          className="mr-1.5 h-2 w-2 rounded-full inline-block"
                          style={{ backgroundColor: l.stage.color }}
                        />
                        {l.stage.name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className="inline-flex items-center justify-center h-7 w-9 rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: s.color }}
                      title={s.label}
                    >
                      {l.score}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium ${ratingColor(l.cqcRating)}`}>
                      {l.cqcRating || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{l.beds ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      {l.phone && (
                        <a href={`tel:${l.phone}`} title={l.phone}>
                          <Phone className="h-4 w-4 text-muted-foreground hover:text-scanvault-red" />
                        </a>
                      )}
                      {l.email && (
                        <a href={`mailto:${l.email}`} title={l.email}>
                          <Mail className="h-4 w-4 text-muted-foreground hover:text-scanvault-red" />
                        </a>
                      )}
                      {l.website && (
                        <a href={l.website} target="_blank" rel="noreferrer">
                          <Globe className="h-4 w-4 text-muted-foreground hover:text-scanvault-red" />
                        </a>
                      )}
                      {l.linkedinUrl && (
                        <a href={l.linkedinUrl} target="_blank" rel="noreferrer" title="View on LinkedIn">
                          <Linkedin className="h-4 w-4 text-[#0A66C2]/60 hover:text-[#0A66C2]" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {l.nextFollowUpAt ? (
                      <span
                        className={
                          new Date(l.nextFollowUpAt) < new Date()
                            ? "text-scanvault-red font-medium"
                            : "text-muted-foreground"
                        }
                      >
                        {formatDate(l.nextFollowUpAt)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/leads/${l.id}`}>View lead</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Move to</DropdownMenuLabel>
                        {stages.map((st) => (
                          <DropdownMenuItem
                            key={st.id}
                            onClick={() => {
                              setSelected(new Set([l.id]));
                              bulkAction("setStage", st.id);
                            }}
                          >
                            <span
                              className="mr-2 h-2 w-2 rounded-full"
                              style={{ backgroundColor: st.color }}
                            />
                            {st.name}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-scanvault-red"
                          onClick={() => deleteLead(l.id)}
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {page} of {totalPages} · {total.toLocaleString()} leads
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => gotoPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => gotoPage(page + 1)}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
