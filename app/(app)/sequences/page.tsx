import { prisma } from "@/lib/db";
import { SequencesPanel } from "@/components/sequences-panel";

export const dynamic = "force-dynamic";

export default async function SequencesPage() {
  const [sequences, templates] = await Promise.all([
    prisma.sequence.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { enrollments: true } },
        enrollments: {
          select: { status: true },
        },
      },
    }),
    prisma.emailTemplate.findMany({ orderBy: { name: "asc" } }),
  ]);

  const data = sequences.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    status: s.status,
    steps: s.steps,
    enrolled: s._count.enrollments,
    active: s.enrollments.filter((e) => e.status === "ACTIVE").length,
    replied: s.enrollments.filter((e) => e.status === "REPLIED").length,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-scanvault-black">Sequences</h1>
        <p className="text-sm text-muted-foreground">
          Automated drip workflows — schedule follow-up emails, calls and tasks over days.
        </p>
      </div>
      <SequencesPanel sequences={JSON.parse(JSON.stringify(data))} templates={templates} />
    </div>
  );
}
