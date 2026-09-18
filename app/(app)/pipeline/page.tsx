import { prisma } from "@/lib/db";
import { KanbanBoard } from "@/components/kanban-board";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const [stages, leads] = await Promise.all([
    prisma.pipelineStage.findMany({ orderBy: { order: "asc" } }),
    prisma.lead.findMany({
      where: { status: { in: ["NEW", "ACTIVE"] } },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { contacts: true, activities: true } } },
    }),
  ]);

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div>
        <h1 className="text-2xl font-bold text-scanvault-black">Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          Drag cards between stages to move leads through the workflow.
        </p>
      </div>
      <KanbanBoard stages={stages} initialLeads={JSON.parse(JSON.stringify(leads))} />
    </div>
  );
}
