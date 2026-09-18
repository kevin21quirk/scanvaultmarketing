import { prisma } from "@/lib/db";
import { TemplatesPanel } from "@/components/templates-panel";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const templates = await prisma.emailTemplate.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-scanvault-black">Email Templates</h1>
        <p className="text-sm text-muted-foreground">
          Reusable outreach copy for campaigns and sequences. Use {"{{name}}"}, {"{{firstName}}"},{" "}
          {"{{town}}"}, {"{{providerName}}"} merge fields.
        </p>
      </div>
      <TemplatesPanel templates={templates} />
    </div>
  );
}
