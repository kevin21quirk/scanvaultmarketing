"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { UK_REGIONS, CQC_RATINGS, LEAD_SOURCES, LEAD_TYPES } from "@/lib/constants";
import { useState, useEffect } from "react";

type Stage = { id: string; name: string };

export function LeadsFilters({ stages }: { stages: Stage[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");

  useEffect(() => {
    setQ(params.get("q") || "");
  }, [params]);

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`/leads?${next.toString()}`);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    update("q", q);
  }

  function clearAll() {
    router.push("/leads");
  }

  const hasFilters = ["q", "stage", "region", "source", "status", "rating", "type", "scoreMin"].some(
    (k) => params.get(k)
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form onSubmit={submitSearch} className="relative flex-1 min-w-[220px] max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, town, postcode, provider…"
          className="pl-9 bg-white"
        />
      </form>

      <Select value={params.get("stage") || ""} onValueChange={(v) => update("stage", v === "all" ? "" : v)}>
        <SelectTrigger className="w-[150px] bg-white">
          <SelectValue placeholder="Stage" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All stages</SelectItem>
          {stages.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={params.get("region") || ""} onValueChange={(v) => update("region", v === "all" ? "" : v)}>
        <SelectTrigger className="w-[160px] bg-white">
          <SelectValue placeholder="Region" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All regions</SelectItem>
          {UK_REGIONS.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={params.get("rating") || ""} onValueChange={(v) => update("rating", v === "all" ? "" : v)}>
        <SelectTrigger className="w-[170px] bg-white">
          <SelectValue placeholder="CQC rating" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any rating</SelectItem>
          {CQC_RATINGS.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={params.get("source") || ""} onValueChange={(v) => update("source", v === "all" ? "" : v)}>
        <SelectTrigger className="w-[150px] bg-white">
          <SelectValue placeholder="Source" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All sources</SelectItem>
          {LEAD_SOURCES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={params.get("type") || ""} onValueChange={(v) => update("type", v === "all" ? "" : v)}>
        <SelectTrigger className="w-[160px] bg-white">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {LEAD_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={params.get("scoreMin") || ""} onValueChange={(v) => update("scoreMin", v === "all" ? "" : v)}>
        <SelectTrigger className="w-[130px] bg-white">
          <SelectValue placeholder="Score" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any score</SelectItem>
          <SelectItem value="70">Hot (70+)</SelectItem>
          <SelectItem value="45">Warm (45+)</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          <X className="h-4 w-4" /> Clear
        </Button>
      )}
    </div>
  );
}
