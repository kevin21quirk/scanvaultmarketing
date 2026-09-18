import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { LeadsTable } from "@/components/leads-table";
import { LeadsFilters } from "@/components/leads-filters";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Upload } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = (sp.q as string) || "";
  const stageId = (sp.stage as string) || "";
  const region = (sp.region as string) || "";
  const source = (sp.source as string) || "";
  const status = (sp.status as string) || "";
  const rating = (sp.rating as string) || "";
  const type = (sp.type as string) || "";
  const scoreMin = Number(sp.scoreMin) || 0;
  const page = Math.max(1, Number(sp.page) || 1);
  const sort = (sp.sort as string) || "createdAt";
  const dir = sp.dir === "asc" ? "asc" : "desc";

  const where: Prisma.LeadWhereInput = {};
  if (status) {
    where.status = status as Prisma.LeadWhereInput["status"];
  } else {
    where.status = { not: "ARCHIVED" };
  }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { akaName: { contains: q, mode: "insensitive" } },
      { town: { contains: q, mode: "insensitive" } },
      { county: { contains: q, mode: "insensitive" } },
      { postcode: { contains: q, mode: "insensitive" } },
      { providerName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }
  if (stageId) where.stageId = stageId;
  if (region) where.region = region;
  if (source) where.source = source as Prisma.LeadWhereInput["source"];
  if (rating) where.cqcRating = rating;
  if (type) where.type = type as Prisma.LeadWhereInput["type"];
  if (scoreMin) where.score = { gte: scoreMin };

  const orderBy: Prisma.LeadOrderByWithRelationInput =
    sort === "name"
      ? { name: dir }
      : sort === "score"
        ? { score: dir }
        : sort === "nextFollowUpAt"
          ? { nextFollowUpAt: { sort: dir, nulls: "last" } }
          : sort === "lastContactedAt"
            ? { lastContactedAt: { sort: dir, nulls: "last" } }
            : { createdAt: dir };

  const [leads, total, stages, users] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        stage: true,
        tags: { include: { tag: true } },
        _count: { select: { contacts: true, activities: true } },
      },
    }),
    prisma.lead.count({ where }),
    prisma.pipelineStage.findMany({ orderBy: { order: "asc" } }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-scanvault-black">Leads</h1>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString()} lead{total === 1 ? "" : "s"} in the database
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/discover">
              <Upload className="h-4 w-4" /> Import
            </Link>
          </Button>
          <Button asChild>
            <Link href="/leads/new">
              <Plus className="h-4 w-4" /> Add Lead
            </Link>
          </Button>
        </div>
      </div>

      <LeadsFilters stages={stages} />

      <LeadsTable
        leads={JSON.parse(JSON.stringify(leads))}
        stages={stages}
        users={users}
        page={page}
        totalPages={totalPages}
        total={total}
        sort={sort}
        dir={dir}
      />
    </div>
  );
}
