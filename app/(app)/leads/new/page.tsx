import { prisma } from "@/lib/db";
import { LeadForm } from "@/components/lead-form";

export const dynamic = "force-dynamic";

export default async function NewLeadPage() {
  const stages = await prisma.pipelineStage.findMany({ orderBy: { order: "asc" } });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-scanvault-black">Add Lead</h1>
      <LeadForm stages={stages} />
    </div>
  );
}
