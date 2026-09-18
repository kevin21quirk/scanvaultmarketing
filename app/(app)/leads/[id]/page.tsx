import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Phone,
  Mail,
  Globe,
  MapPin,
  BedDouble,
  Building2,
  Star,
  ExternalLink,
  Pencil,
} from "lucide-react";
import { LeadStageSelect } from "@/components/lead-stage-select";
import { LeadActions } from "@/components/lead-actions";
import { ContactsPanel } from "@/components/contacts-panel";
import { ActivityPanel } from "@/components/activity-panel";
import { TasksPanel } from "@/components/tasks-panel";
import { formatDate, formatDateTime, formatCurrency, leadAddress } from "@/lib/utils";
import { scoreLabel } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      stage: true,
      assignedTo: { select: { id: true, name: true } },
      tags: { include: { tag: true } },
      contacts: { orderBy: [{ isPrimary: "desc" }, { firstName: "asc" }] },
      activities: {
        orderBy: { occurredAt: "desc" },
        take: 50,
        include: {
          user: { select: { name: true } },
          contact: { select: { firstName: true, lastName: true } },
        },
      },
      tasks: {
        orderBy: [{ status: "asc" }, { dueAt: "asc" }],
        include: { assignedTo: { select: { name: true } } },
      },
      campaignMemberships: { include: { campaign: { select: { name: true } } } },
      sequenceEnrollments: { include: { sequence: { select: { name: true } } } },
    },
  });

  if (!lead) notFound();

  const [stages, users, sequences] = await Promise.all([
    prisma.pipelineStage.findMany({ orderBy: { order: "asc" } }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.sequence.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true } }),
  ]);

  const score = scoreLabel(lead.score);
  const ratingBadge =
    lead.cqcRating === "Outstanding" || lead.cqcRating === "Good"
      ? "success"
      : lead.cqcRating === "Requires improvement"
        ? "warning"
        : lead.cqcRating === "Inadequate"
          ? "destructive"
          : "muted";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/leads"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-scanvault-red"
          >
            <ArrowLeft className="h-4 w-4" /> Back to leads
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-scanvault-black">{lead.name}</h1>
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
              style={{ backgroundColor: score.color }}
            >
              {score.label} · {lead.score}
            </span>
            {lead.cqcRating && <Badge variant={ratingBadge as never}>{lead.cqcRating}</Badge>}
            {lead.doNotContact && <Badge variant="destructive">Do Not Contact</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {lead.type.replace(/_/g, " ")} · {lead.providerName || "Independent"} · added{" "}
            {formatDate(lead.createdAt)} via {lead.source}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <LeadStageSelect leadId={lead.id} stages={stages} currentStageId={lead.stageId} />
          <LeadActions
            leadId={lead.id}
            assignedToId={lead.assignedToId}
            users={users}
            doNotContact={lead.doNotContact}
            sequences={sequences}
            enrolledSequenceIds={lead.sequenceEnrollments.map((e) => e.sequenceId)}
          />
          <Button variant="outline" size="sm" asChild>
            <Link href={`/leads/${lead.id}/edit`}>
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — details + contacts */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <span>{leadAddress(lead) || "No address"}</span>
              </div>
              {lead.region && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="w-4" />
                  <span>
                    {lead.region}
                    {lead.localAuthority ? ` · ${lead.localAuthority}` : ""}
                  </span>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${lead.phone}`} className="hover:text-scanvault-red">
                    {lead.phone}
                  </a>
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${lead.email}`} className="hover:text-scanvault-red break-all">
                    {lead.email}
                  </a>
                </div>
              )}
              {lead.website && (
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-scanvault-red break-all"
                  >
                    {lead.website.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              )}
              {lead.beds != null && (
                <div className="flex items-center gap-2">
                  <BedDouble className="h-4 w-4 text-muted-foreground" />
                  <span>{lead.beds} beds</span>
                </div>
              )}
              {lead.providerName && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{lead.providerName}</span>
                </div>
              )}
              {lead.cqcRating && (
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-muted-foreground" />
                  <span>
                    CQC: {lead.cqcRating}
                    {lead.cqcRatedAt ? ` (${formatDate(lead.cqcRatedAt)})` : ""}
                  </span>
                </div>
              )}
              {lead.cqcLocationId && (
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={`https://www.cqc.org.uk/location/${lead.cqcLocationId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-scanvault-red hover:underline"
                  >
                    View on CQC
                  </a>
                </div>
              )}
              {lead.estimatedValue != null && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground">Est. value: </span>
                  <span className="font-semibold">{formatCurrency(lead.estimatedValue)}</span>
                </div>
              )}
              {lead.careTypes.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Care types</p>
                  <div className="flex flex-wrap gap-1">
                    {lead.careTypes.map((t) => (
                      <Badge key={t} variant="muted" className="text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {lead.nextFollowUpAt && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground">Next follow-up: </span>
                  <span
                    className={
                      lead.nextFollowUpAt < new Date()
                        ? "text-scanvault-red font-medium"
                        : "font-medium"
                    }
                  >
                    {formatDateTime(lead.nextFollowUpAt)}
                  </span>
                </div>
              )}
              {lead.assignedTo && (
                <div>
                  <span className="text-muted-foreground">Owner: </span>
                  <span className="font-medium">{lead.assignedTo.name}</span>
                </div>
              )}
              {lead.notes && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                  <p className="whitespace-pre-wrap">{lead.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <ContactsPanel leadId={lead.id} contacts={JSON.parse(JSON.stringify(lead.contacts))} />
          <TasksPanel leadId={lead.id} tasks={JSON.parse(JSON.stringify(lead.tasks))} users={users} />
        </div>

        {/* Right column — activity timeline */}
        <div className="lg:col-span-2">
          <ActivityPanel
            leadId={lead.id}
            contacts={lead.contacts.map((c) => ({
              id: c.id,
              name: `${c.firstName} ${c.lastName || ""}`.trim(),
            }))}
            activities={JSON.parse(JSON.stringify(lead.activities))}
          />
        </div>
      </div>
    </div>
  );
}
