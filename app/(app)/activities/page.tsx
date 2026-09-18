import { prisma } from "@/lib/db";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { ACTIVITY_TYPES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const type = (sp.type as string) || "";
  const q = (sp.q as string) || "";

  const activities = await prisma.activity.findMany({
    where: {
      ...(type ? { type: type as never } : {}),
      ...(q
        ? {
            OR: [
              { subject: { contains: q, mode: "insensitive" } },
              { body: { contains: q, mode: "insensitive" } },
              { lead: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      lead: { select: { id: true, name: true } },
      user: { select: { name: true } },
      contact: { select: { firstName: true, lastName: true } },
    },
    orderBy: { occurredAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-scanvault-black">Activity Log</h1>
        <p className="text-sm text-muted-foreground">
          Every touchpoint across every lead — calls, emails, meetings and more.
        </p>
      </div>

      <form method="GET" className="flex flex-wrap gap-2">
        <Input name="q" defaultValue={q} placeholder="Search activities…" className="w-64 bg-white" />
        <Input type="hidden" name="type" value={type} />
        <div className="flex gap-1.5 flex-wrap">
          <Button
            variant={!type ? "default" : "outline"}
            size="sm"
            asChild
          >
            <Link href={`/activities${q ? `?q=${q}` : ""}`}>All</Link>
          </Button>
          {ACTIVITY_TYPES.map((t) => (
            <Button
              key={t.value}
              variant={type === t.value ? "default" : "outline"}
              size="sm"
              asChild
            >
              <Link href={`/activities?type=${t.value}${q ? `&q=${q}` : ""}`}>{t.label}</Link>
            </Button>
          ))}
        </div>
      </form>

      <Card>
        <CardContent className="p-0">
          {activities.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">No activities found.</p>
          )}
          <div className="divide-y">
            {activities.map((a) => (
              <div key={a.id} className="flex items-start gap-4 p-4">
                <Badge variant="secondary" className="mt-0.5 shrink-0 w-20 justify-center">
                  {a.type}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <Link href={`/leads/${a.lead.id}`} className="font-medium hover:text-scanvault-red">
                      {a.lead.name}
                    </Link>
                    {a.subject && <span className="text-muted-foreground"> — {a.subject}</span>}
                  </p>
                  {a.body && (
                    <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{a.body}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {a.direction === "INBOUND" ? "Inbound" : "Outbound"}
                    {a.contact ? ` · ${a.contact.firstName} ${a.contact.lastName || ""}` : ""}
                    {a.outcome !== "NONE" ? ` · ${a.outcome.replace(/_/g, " ").toLowerCase()}` : ""}
                    {a.user ? ` · ${a.user.name}` : ""}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDateTime(a.occurredAt)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
