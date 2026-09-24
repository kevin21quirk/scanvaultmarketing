import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsPanel } from "@/components/settings-panel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const [stages, tags, users, liProfileSetting] = await Promise.all([
    prisma.pipelineStage.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { leads: true } } } }),
    prisma.tag.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { leads: true } } } }),
    prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, createdAt: true }, orderBy: { name: "asc" } }),
    prisma.setting.findUnique({ where: { key: `li_profile_${user.id}` } }),
  ]);

  type LiProfile = { name: string; email: string | null; picture: string | null } | null;
  const linkedinProfile: LiProfile = liProfileSetting
    ? (liProfileSetting.value as LiProfile)
    : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-scanvault-black">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure the pipeline, tags, and team access.
        </p>
      </div>
      <SettingsPanel
        stages={JSON.parse(JSON.stringify(stages))}
        tags={JSON.parse(JSON.stringify(tags))}
        users={JSON.parse(JSON.stringify(users))}
        isAdmin={user.role === "ADMIN"}
        linkedinProfile={linkedinProfile}
      />
    </div>
  );
}
