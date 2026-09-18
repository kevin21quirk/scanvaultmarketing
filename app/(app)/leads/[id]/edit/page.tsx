import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { LeadForm } from "@/components/lead-form";

export const dynamic = "force-dynamic";

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [lead, stages] = await Promise.all([
    prisma.lead.findUnique({ where: { id } }),
    prisma.pipelineStage.findMany({ orderBy: { order: "asc" } }),
  ]);
  if (!lead) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-scanvault-black">Edit — {lead.name}</h1>
      <LeadForm lead={JSON.parse(JSON.stringify(lead))} stages={stages} />
    </div>
  );
}
