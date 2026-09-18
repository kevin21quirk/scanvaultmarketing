import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TasksBoard } from "@/components/tasks-board";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const [tasks, users, leads] = await Promise.all([
    prisma.task.findMany({
      orderBy: [{ status: "asc" }, { dueAt: { sort: "asc", nulls: "last" } }],
      include: {
        lead: { select: { id: true, name: true } },
        assignedTo: { select: { name: true } },
      },
      take: 300,
    }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.lead.findMany({
      where: { status: { in: ["NEW", "ACTIVE"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 1000,
    }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-scanvault-black">Tasks</h1>
        <p className="text-sm text-muted-foreground">
          Follow-ups and to-dos across the whole pipeline.
        </p>
      </div>
      <TasksBoard
        tasks={JSON.parse(JSON.stringify(tasks))}
        users={users}
        leads={leads}
        currentUserId={user.id}
      />
    </div>
  );
}
