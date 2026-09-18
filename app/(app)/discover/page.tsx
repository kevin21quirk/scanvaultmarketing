import { prisma } from "@/lib/db";
import { DiscoverPanel } from "@/components/discover-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const jobs = await prisma.importJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
    include: { createdBy: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-scanvault-black">Discover Leads</h1>
        <p className="text-sm text-muted-foreground">
          Pull care homes straight into your pipeline from the CQC register, or upload your own lists.
        </p>
      </div>

      <DiscoverPanel />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Import History</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 && (
            <p className="text-sm text-muted-foreground">No imports yet — run your first CQC scan above.</p>
          )}
          <div className="space-y-2">
            {jobs.map((j) => (
              <div
                key={j.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm"
              >
                <Badge variant={j.status === "COMPLETED" ? "success" : j.status === "FAILED" ? "destructive" : "info"}>
                  {j.source}
                </Badge>
                <span className="font-medium">
                  {j.imported} imported
                </span>
                <span className="text-muted-foreground">
                  {j.duplicates} dupes · {j.failed} failed · {j.totalFound} found
                </span>
                <span className="text-muted-foreground ml-auto text-xs">
                  {j.createdBy?.name} · {formatDateTime(j.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
