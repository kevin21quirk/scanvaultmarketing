"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Phone, Mail, BedDouble, GripVertical } from "lucide-react";
import { scoreLabel } from "@/lib/scoring";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

type Stage = {
  id: string;
  name: string;
  color: string;
  isWon: boolean;
  isLost: boolean;
};

type Lead = {
  id: string;
  name: string;
  stageId: string | null;
  town: string | null;
  postcode: string | null;
  phone: string | null;
  email: string | null;
  beds: number | null;
  score: number;
  cqcRating: string | null;
  nextFollowUpAt: string | null;
  estimatedValue: number | null;
  _count: { contacts: number; activities: number };
};

function LeadCard({ lead, dragging }: { lead: Lead; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });
  const s = scoreLabel(lead.score);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`rounded-lg border bg-white p-3 shadow-sm select-none ${
        isDragging || dragging ? "opacity-50 rotate-2 shadow-lg" : ""
      }`}
    >
      <div className="flex items-start gap-1">
        <button
          {...listeners}
          {...attributes}
          className="mt-0.5 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <Link
            href={`/leads/${lead.id}`}
            className="text-sm font-medium text-scanvault-black hover:text-scanvault-red line-clamp-2"
          >
            {lead.name}
          </Link>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {[lead.town, lead.postcode].filter(Boolean).join(", ") || "—"}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
              style={{ backgroundColor: s.color }}
            >
              {lead.score}
            </span>
            {lead.beds != null && (
              <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5">
                <BedDouble className="h-3 w-3" />
                {lead.beds}
              </span>
            )}
            {lead.phone && <Phone className="h-3 w-3 text-muted-foreground" />}
            {lead.email && <Mail className="h-3 w-3 text-muted-foreground" />}
            {lead.nextFollowUpAt && (
              <span
                className={`text-[10px] ${
                  new Date(lead.nextFollowUpAt) < new Date()
                    ? "text-scanvault-red font-semibold"
                    : "text-muted-foreground"
                }`}
              >
                ⏰ {formatDate(lead.nextFollowUpAt)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StageColumn({ stage, leads }: { stage: Stage; leads: Lead[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const value = leads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0);

  return (
    <div className="flex flex-col w-72 shrink-0">
      <div
        className="flex items-center justify-between rounded-t-lg px-3 py-2 text-white"
        style={{ backgroundColor: stage.color }}
      >
        <span className="text-sm font-semibold truncate">{stage.name}</span>
        <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">{leads.length}</span>
      </div>
      {value > 0 && (
        <div className="bg-gray-100 text-center text-[10px] text-muted-foreground py-0.5 border-x">
          £{value.toLocaleString()}
        </div>
      )}
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-b-lg border border-t-0 p-2 space-y-2 min-h-[200px] transition-colors ${
          isOver ? "bg-red-50 border-scanvault-red" : "bg-gray-50/80"
        }`}
      >
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
        {leads.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">Drop leads here</p>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({ stages, initialLeads }: { stages: Stage[]; initialLeads: Lead[] }) {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const leadId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;

    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    const targetStageId = overId === "__none__" ? null : overId;
    if (lead.stageId === targetStageId) return;

    const previous = lead.stageId;
    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stageId: targetStageId } : l))
    );

    const res = await fetch(`/api/leads/${leadId}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId: targetStageId }),
    });
    if (!res.ok) {
      toast.error("Failed to move lead");
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stageId: previous } : l)));
    } else {
      const stage = stages.find((s) => s.id === overId);
      toast.success(`${lead.name} → ${stage?.name || "No Stage"}`);
      router.refresh();
    }
  }

  const active = activeId ? leads.find((l) => l.id === activeId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 flex-1 scrollbar-thin">
        {stages.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            leads={leads.filter((l) => l.stageId === stage.id)}
          />
        ))}
        {/* Unstaged column */}
        <StageColumn
          stage={{ id: "__none__", name: "No Stage", color: "#9CA3AF", isWon: false, isLost: false }}
          leads={leads.filter((l) => l.stageId === null)}
        />
      </div>
      <DragOverlay>{active ? <LeadCard lead={active} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}
