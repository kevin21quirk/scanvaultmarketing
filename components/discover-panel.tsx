"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Papa from "papaparse";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Radar,
  Search,
  Download,
  Loader2,
  FileUp,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Phone,
  BedDouble,
  Star,
  Linkedin,
  Link2,
  Building2,
  User,
} from "lucide-react";
import { UK_REGIONS, CQC_RATINGS } from "@/lib/constants";
import { toast } from "sonner";

type CqcLocation = {
  locationId: string;
  locationName: string;
  providerName?: string;
  postalAddressTownCity?: string;
  postalAddressCounty?: string;
  postalCode?: string;
  region?: string;
  mainPhoneNumber?: string;
  numberOfBeds?: number;
  currentRatings?: { overall?: { rating?: string } };
};

export function DiscoverPanel() {
  const router = useRouter();
  const [filters, setFilters] = useState({
    searchTerm: "",
    region: "",
    localAuthority: "",
    postalCode: "",
    overallRating: "",
    careHome: true,
  });
  const [preview, setPreview] = useState<{ locations: CqcLocation[]; total: number } | null>(null);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [maxPages, setMaxPages] = useState("10");
  const [result, setResult] = useState<{
    imported: number;
    duplicates: number;
    failed: number;
    total: number;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const linkedinFileRef = useRef<HTMLInputElement>(null);
  const [linkedinImporting, setLinkedinImporting] = useState(false);

  // LinkedIn URL quick-add
  const [liUrl, setLiUrl] = useState("");
  const [liParsed, setLiParsed] = useState<{
    type: "company" | "person" | null;
    slug: string;
    name: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    company: string;
  }>({ type: null, slug: "", name: "", firstName: "", lastName: "", jobTitle: "", company: "" });
  const [liCreating, setLiCreating] = useState(false);

  function parseLinkedInUrl(url: string) {
    const companyMatch = url.match(/linkedin\.com\/company\/([^/?#]+)/i);
    const personMatch = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
    if (companyMatch) {
      const slug = companyMatch[1].replace(/\/$/, "");
      const name = slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      setLiParsed((p) => ({ ...p, type: "company", slug, name }));
    } else if (personMatch) {
      const slug = personMatch[1].replace(/\/$/, "");
      setLiParsed((p) => ({ ...p, type: "person", slug, name: "" }));
    } else {
      setLiParsed((p) => ({ ...p, type: null }));
    }
  }

  async function createFromLinkedIn() {
    setLiCreating(true);
    try {
      const leadName =
        liParsed.type === "company"
          ? liParsed.name || liParsed.slug
          : liParsed.company || `${liParsed.firstName} ${liParsed.lastName}`.trim() || liParsed.slug;

      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: leadName,
          source: "LINKEDIN_SALES_NAV",
          type: "OTHER",
          linkedinUrl: liUrl,
        }),
      });
      const lead = await res.json();

      // For a person URL, also create the contact record
      if (res.ok && liParsed.type === "person" && liParsed.firstName) {
        await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadId: lead.id,
            firstName: liParsed.firstName,
            lastName: liParsed.lastName || null,
            jobTitle: liParsed.jobTitle || null,
            linkedIn: liUrl,
            isPrimary: true,
          }),
        });
      }

      if (res.ok) {
        router.push(`/leads/${lead.id}`);
      } else {
        toast.error(lead.error || "Failed to create lead");
        setLiCreating(false);
      }
    } catch {
      toast.error("Something went wrong");
      setLiCreating(false);
    }
  }

  const set = (k: string, v: string | boolean) => setFilters((f) => ({ ...f, [k]: v }));

  function buildParams() {
    return {
      careHome: filters.careHome,
      searchTerm: filters.searchTerm || undefined,
      region: filters.region || undefined,
      localAuthority: filters.localAuthority || undefined,
      postalCode: filters.postalCode || undefined,
      overallRating: filters.overallRating || undefined,
    };
  }

  async function search() {
    setSearching(true);
    setResult(null);
    try {
      const res = await fetch("/api/discover/cqc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "search", params: { ...buildParams(), page: 1 } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setPreview(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "CQC search failed");
    } finally {
      setSearching(false);
    }
  }

  async function importAll() {
    setImporting(true);
    setResult(null);
    try {
      const res = await fetch("/api/discover/cqc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "import",
          params: buildParams(),
          maxPages: Number(maxPages) || 10,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setResult(data);
      toast.success(`Imported ${data.imported} leads`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function onCsv(file: File) {
    setCsvImporting(true);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parsed) => {
        try {
          const res = await fetch("/api/discover/csv", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: parsed.data }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Import failed");
          toast.success(`CSV: ${data.imported} imported, ${data.duplicates} dupes`);
          router.refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "CSV import failed");
        } finally {
          setCsvImporting(false);
          if (fileRef.current) fileRef.current.value = "";
        }
      },
      error: () => {
        toast.error("Could not parse CSV");
        setCsvImporting(false);
      },
    });
  }

  async function onLinkedinCsv(file: File) {
    setLinkedinImporting(true);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parsed) => {
        try {
          const res = await fetch("/api/discover/linkedin-csv", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: parsed.data }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Import failed");
          toast.success(
            `LinkedIn ${data.mode}: ${data.imported} imported, ${data.duplicates} already existed`
          );
          router.refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "LinkedIn CSV import failed");
        } finally {
          setLinkedinImporting(false);
          if (linkedinFileRef.current) linkedinFileRef.current.value = "";
        }
      },
      error: () => {
        toast.error("Could not parse CSV");
        setLinkedinImporting(false);
      },
    });
  }

  return (
    <Tabs defaultValue="cqc">
      <TabsList>
        <TabsTrigger value="cqc">
          <Radar className="h-4 w-4 mr-1.5" /> CQC Register
        </TabsTrigger>
        <TabsTrigger value="linkedin-url">
          <Link2 className="h-4 w-4 mr-1.5" /> LinkedIn URL
        </TabsTrigger>
        <TabsTrigger value="csv">
          <FileUp className="h-4 w-4 mr-1.5" /> CSV Import
        </TabsTrigger>
        <TabsTrigger value="linkedin">
          <Linkedin className="h-4 w-4 mr-1.5" /> LinkedIn CSV
        </TabsTrigger>
      </TabsList>

      <TabsContent value="cqc">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Scan the CQC register</CardTitle>
            <CardDescription>
              The Care Quality Commission lists every registered care home in England — filter, preview,
              then import straight into your pipeline.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Provider / group name or CQC ID</Label>
                <Input
                  value={filters.searchTerm}
                  onChange={(e) => set("searchTerm", e.target.value)}
                  placeholder="e.g. Barchester  or  1-10000644"
                />
                <p className="text-[10px] text-muted-foreground">
                  Enter a group name to find all their homes, or paste the CQC provider ID
                  (from the URL on cqc.org.uk) for instant results.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Region</Label>
                <Select
                  value={filters.region}
                  onValueChange={(v) => set("region", v === "all" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All regions" />
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
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Local authority</Label>
                <Input
                  value={filters.localAuthority}
                  onChange={(e) => set("localAuthority", e.target.value)}
                  placeholder="e.g. Kent, Manchester"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">CQC rating</Label>
                <Select
                  value={filters.overallRating}
                  onValueChange={(v) => set("overallRating", v === "all" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any rating" />
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
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Location type</Label>
                <Select
                  value={filters.careHome ? "Y" : "all"}
                  onValueChange={(v) => set("careHome", v === "Y")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Y">Care homes only</SelectItem>
                    <SelectItem value="all">All care locations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={search} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Preview results
              </Button>
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Pages to import</Label>
                <Select value={maxPages} onValueChange={setMaxPages}>
                  <SelectTrigger className="w-24 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 (100)</SelectItem>
                    <SelectItem value="5">5 (500)</SelectItem>
                    <SelectItem value="10">10 (1k)</SelectItem>
                    <SelectItem value="25">25 (2.5k)</SelectItem>
                    <SelectItem value="50">50 (5k)</SelectItem>
                    <SelectItem value="100">100 (10k)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={importAll} disabled={importing}>
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {importing ? "Importing…" : "Import matching leads"}
              </Button>
            </div>

            {result && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-green-800">
                    Import complete — {result.imported} new leads added
                  </p>
                  <p className="text-green-700">
                    {result.duplicates} already existed (refreshed) · {result.failed} failed ·{" "}
                    {result.total} total on register
                  </p>
                </div>
              </div>
            )}

            {preview && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {preview.total.toLocaleString()} locations match — showing first{" "}
                  {preview.locations.length}:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-y-auto scrollbar-thin">
                  {preview.locations.map((loc) => (
                    <div key={loc.locationId} className="rounded-lg border p-3 text-sm bg-white">
                      <p className="font-medium truncate">{loc.locationName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {loc.providerName || "Independent"}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {[loc.postalAddressTownCity, loc.postalCode].filter(Boolean).join(", ")}
                        </span>
                        {loc.mainPhoneNumber && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {loc.mainPhoneNumber}
                          </span>
                        )}
                        {loc.numberOfBeds != null && (
                          <span className="inline-flex items-center gap-1">
                            <BedDouble className="h-3 w-3" />
                            {loc.numberOfBeds}
                          </span>
                        )}
                        {loc.currentRatings?.overall?.rating && (
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            {loc.currentRatings.overall.rating}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Tip: target homes rated <strong>&ldquo;Requires improvement&rdquo;</strong> or{" "}
                <strong>&ldquo;Inadequate&rdquo;</strong> — poor CQC ratings usually mean documentation
                and records-management pain, which is exactly what ScanVault solves. Set a CQC API key in{" "}
                <code>.env</code> (<code>CQC_API_KEY</code>) for higher rate limits.
              </p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── LinkedIn URL quick-add ─────────────────────────────────────── */}
      <TabsContent value="linkedin-url" className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Linkedin className="h-4 w-4 text-[#0A66C2]" /> Add lead from LinkedIn URL
            </CardTitle>
            <CardDescription>
              Copy a company or person URL from LinkedIn Sales Navigator (or regular LinkedIn)
              and paste it below. ScanVault will create the lead and you can enrich it from
              Companies House &amp; CQC on the lead detail page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>LinkedIn URL</Label>
              <Input
                placeholder="https://www.linkedin.com/company/sunrise-care-homes  or  /in/johndoe"
                value={liUrl}
                onChange={(e) => {
                  setLiUrl(e.target.value);
                  parseLinkedInUrl(e.target.value);
                }}
              />
              {liUrl && !liParsed.type && (
                <p className="text-xs text-amber-600">
                  Paste a linkedin.com/company/… or linkedin.com/in/… URL.
                </p>
              )}
            </div>

            {liParsed.type === "company" && (
              <div className="space-y-3 rounded-lg border bg-blue-50 border-blue-100 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
                  <Building2 className="h-4 w-4" /> Company / Care Home
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Company name (edit if needed)</Label>
                  <Input
                    value={liParsed.name}
                    onChange={(e) => setLiParsed((p) => ({ ...p, name: e.target.value }))}
                    className="bg-white"
                  />
                </div>
                <p className="text-xs text-blue-700">
                  After creating, open the lead and use the <strong>Companies House</strong> and <strong>CQC</strong> enrich buttons to fill in address, phone, beds, and rating automatically.
                </p>
              </div>
            )}

            {liParsed.type === "person" && (
              <div className="space-y-3 rounded-lg border bg-blue-50 border-blue-100 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
                  <User className="h-4 w-4" /> Person — their company becomes the lead
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">First name *</Label>
                    <Input
                      required
                      value={liParsed.firstName}
                      onChange={(e) => setLiParsed((p) => ({ ...p, firstName: e.target.value }))}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Last name</Label>
                    <Input
                      value={liParsed.lastName}
                      onChange={(e) => setLiParsed((p) => ({ ...p, lastName: e.target.value }))}
                      className="bg-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Job title</Label>
                    <Input
                      value={liParsed.jobTitle}
                      onChange={(e) => setLiParsed((p) => ({ ...p, jobTitle: e.target.value }))}
                      placeholder="e.g. Registered Manager"
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Their company / care home *</Label>
                    <Input
                      required
                      value={liParsed.company}
                      onChange={(e) => setLiParsed((p) => ({ ...p, company: e.target.value }))}
                      placeholder="e.g. Sunrise Care Home"
                      className="bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            <Button
              disabled={
                !liParsed.type ||
                liCreating ||
                (liParsed.type === "company" && !liParsed.name) ||
                (liParsed.type === "person" && !liParsed.firstName)
              }
              onClick={createFromLinkedIn}
              className="w-full"
            >
              {liCreating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Creating lead…</>
              ) : (
                "Add to ScanVault →"
              )}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="csv">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Import from CSV</CardTitle>
            <CardDescription>
              Upload a spreadsheet of care homes. Column names are auto-matched (name, address, town,
              postcode, phone, email, beds, provider, cqc id…).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onCsv(f);
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={csvImporting}
              className="w-full rounded-xl border-2 border-dashed border-gray-300 hover:border-scanvault-red transition-colors p-10 text-center"
            >
              {csvImporting ? (
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-scanvault-red" />
              ) : (
                <FileUp className="h-8 w-8 mx-auto text-muted-foreground" />
              )}
              <p className="mt-2 text-sm font-medium">
                {csvImporting ? "Importing…" : "Click to upload a CSV file"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Up to 5,000 rows · duplicates skipped automatically
              </p>
            </button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="linkedin" className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Linkedin className="h-4 w-4 text-[#0A66C2]" /> Import from LinkedIn Sales Navigator
            </CardTitle>
            <CardDescription>
              Export a lead list or account list from Sales Navigator and upload it here. Contacts are
              created automatically for lead-list exports; company/account exports create leads directly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={linkedinFileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onLinkedinCsv(f);
              }}
            />
            <button
              onClick={() => linkedinFileRef.current?.click()}
              disabled={linkedinImporting}
              className="w-full rounded-xl border-2 border-dashed border-[#0A66C2]/40 hover:border-[#0A66C2] transition-colors p-10 text-center"
            >
              {linkedinImporting ? (
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#0A66C2]" />
              ) : (
                <Linkedin className="h-8 w-8 mx-auto text-[#0A66C2]" />
              )}
              <p className="mt-2 text-sm font-medium">
                {linkedinImporting ? "Importing…" : "Click to upload a Sales Navigator CSV"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Lead lists &amp; account lists supported · up to 5,000 rows · duplicates skipped
              </p>
            </button>

            <div className="space-y-3">
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 space-y-2 text-sm text-blue-800">
                <p className="font-semibold">Option A — LinkedIn Connections (free, works for everyone)</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>
                    Go to{" "}
                    <a href="https://www.linkedin.com/mypreferences/d/categories/data" target="_blank" rel="noreferrer" className="underline">
                      linkedin.com → Settings → Data Privacy → Get a copy of your data
                    </a>
                  </li>
                  <li>Tick <strong>Connections</strong>, click <strong>Request archive</strong> and wait for the email.</li>
                  <li>Download and unzip — upload the <code>Connections.csv</code> file here.</li>
                </ol>
                <p className="text-xs text-blue-700">Creates one lead per company and one contact per connection.</p>
              </div>

              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 space-y-2 text-sm text-blue-800">
                <p className="font-semibold">Option B — Sales Navigator List Export <span className="font-normal opacity-70">(Advanced / Advanced Plus plan only)</span></p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>In Sales Navigator, open a saved <strong>Lead list</strong> or <strong>Account list</strong>.</li>
                  <li>Select all rows, then click the <strong>&hellip;</strong> menu → <strong>Export to CSV</strong>.</li>
                  <li>Upload the downloaded file here — column names are auto-matched.</li>
                </ol>
                <p className="text-xs text-amber-700 mt-1">
                  ⚠ The export button is only visible on Advanced/Advanced Plus plans. If you don&apos;t see it, use Option A above.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
