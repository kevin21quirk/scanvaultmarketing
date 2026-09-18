"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Ban, Workflow, UserCheck, Archive } from "lucide-react";
import { toast } from "sonner";

type UserOpt = { id: string; name: string };

export function LeadActions({
  leadId,
  users,
  assignedToId,
  doNotContact,
  sequences,
  enrolledSequenceIds,
}: {
  leadId: string;
  users: UserOpt[];
  assignedToId: string | null;
  doNotContact: boolean;
  sequences: { id: string; name: string }[];
  enrolledSequenceIds: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function patch(body: Record<string, unknown>, msg: string) {
    startTransition(async () => {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success(msg);
        router.refresh();
      } else toast.error("Update failed");
    });
  }

  function enroll(sequenceId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/sequences/${sequenceId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: [leadId] }),
      });
      if (res.ok) {
        toast.success("Enrolled in sequence");
        router.refresh();
      } else toast.error("Enrollment failed");
    });
  }

  function archive() {
    patch({ status: "ARCHIVED" }, "Lead archived");
    router.push("/leads");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}>
          <MoreHorizontal className="h-4 w-4" /> Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Assign owner</DropdownMenuLabel>
        {users.map((u) => (
          <DropdownMenuItem
            key={u.id}
            onClick={() => patch({ assignedToId: u.id }, `Assigned to ${u.name}`)}
          >
            <UserCheck className="h-4 w-4" />
            {u.name}
            {u.id === assignedToId ? " ✓" : ""}
          </DropdownMenuItem>
        ))}
        {sequences.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Enroll in sequence</DropdownMenuLabel>
            {sequences
              .filter((s) => !enrolledSequenceIds.includes(s.id))
              .map((s) => (
                <DropdownMenuItem key={s.id} onClick={() => enroll(s.id)}>
                  <Workflow className="h-4 w-4" /> {s.name}
                </DropdownMenuItem>
              ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() =>
            patch({ doNotContact: !doNotContact }, doNotContact ? "DNC removed" : "Marked do-not-contact")
          }
        >
          <Ban className="h-4 w-4" /> {doNotContact ? "Remove DNC flag" : "Mark do-not-contact"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={archive}>
          <Archive className="h-4 w-4" /> Archive lead
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
