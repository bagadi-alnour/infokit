"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Globe } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import { Button } from "~/components/admin/workspace";
import { Popover, PopoverContent } from "~/components/ui/popover";

import { isRedirectError, RowActionTrigger } from "./catalogue-row-controls";
import {
  checkText,
  kindText,
  reachText,
  validityText,
  type SkillKindValue,
  type SkillsLabels,
  type ReachValue,
} from "./skills-rows";

/**
 * The columns the skills and courses tables answer the same way — who owns the
 * row, how far it reaches, how long a declaration lasts, whether anybody has to
 * confirm it, and how much is riding on it — plus the one action that only
 * exists here: handing an association's row to the platform.
 *
 * Written once, like catalogue-columns.tsx, so each table is left holding only
 * what is its own: a skill's kind, a course's provider.
 */

/** "InfoKit", or the association that wrote the row. */
export function ownerColumn<Row extends { ownerName: string }>(
  labels: SkillsLabels,
): ColumnDef<Row> {
  return {
    id: "owner",
    accessorFn: (row) => row.ownerName,
    header: () => labels["skills.owner"],
    meta: { label: labels["skills.owner"], filter: {} },
    cell: ({ row }) => (
      <span className="text-copy-muted text-xs">{row.original.ownerName}</span>
    ),
  };
}

export function kindColumn<Row extends { kind: SkillKindValue }>(
  labels: SkillsLabels,
): ColumnDef<Row> {
  return {
    id: "kind",
    accessorFn: (row) => kindText(labels, row.kind),
    header: () => labels["skills.kind"],
    meta: { label: labels["skills.kind"] },
    cell: ({ row }) => (
      <span className="text-copy-muted text-xs">
        {kindText(labels, row.original.kind)}
      </span>
    ),
  };
}

/** Who reads this row: us, every association, or translators too. */
export function reachColumn<Row extends { visibility: ReachValue }>(
  labels: SkillsLabels,
): ColumnDef<Row> {
  return {
    id: "reach",
    accessorFn: (row) => reachText(labels, row.visibility),
    header: () => labels["skills.reach"],
    meta: { label: labels["skills.reach"] },
    cell: ({ row }) => (
      <span className="text-copy-muted text-xs">
        {reachText(labels, row.original.visibility)}
      </span>
    ),
  };
}

export function validityColumn<Row extends { validityMonths: number | null }>(
  labels: SkillsLabels,
): ColumnDef<Row> {
  return {
    id: "validity",
    // Sorting by the number, not by its words: "no expiry" is the longest of
    // them, and sorts last either way.
    accessorFn: (row) => row.validityMonths ?? Number.MAX_SAFE_INTEGER,
    header: () => labels["skills.validity"],
    meta: { label: labels["skills.validity"] },
    cell: ({ row }) => (
      <span className="text-copy-muted text-xs">
        {validityText(labels, row.original.validityMonths)}
      </span>
    ),
  };
}

/** Whether a declaration needs a verifier, or the person's word stands. */
export function checkColumn<Row extends { verificationRequired: boolean }>(
  labels: SkillsLabels,
): ColumnDef<Row> {
  return {
    id: "check",
    accessorFn: (row) => checkText(labels, row.verificationRequired),
    header: () => labels["skills.check"],
    meta: { label: labels["skills.check"] },
    cell: ({ row }) => (
      <span className="text-copy-muted text-xs">
        {checkText(labels, row.original.verificationRequired)}
      </span>
    ),
  };
}

/** People holding it plus requirements asking for it — so, what a delete costs. */
export function declarationsColumn<Row extends { usageCount: number }>(
  labels: SkillsLabels,
): ColumnDef<Row> {
  return {
    id: "declarations",
    accessorFn: (row) => row.usageCount,
    header: () => labels["skills.declarations"],
    meta: { label: labels["skills.declarations"], align: "end" },
  };
}

/**
 * Hand one association's skill to the platform. It is a one-way move — the row
 * stops being theirs to edit — so it confirms first, and it says what happens to
 * the declarations already made against it: nothing, because they point at the
 * same row.
 */
export function PromoteSkillButton({
  action,
  skillId,
  locale,
  labels,
}: {
  action: (formData: FormData) => Promise<void>;
  skillId: string;
  locale: string;
  labels: SkillsLabels;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const showActionError = useActionErrorToast();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <RowActionTrigger label={labels["skills.promote"]} icon={Globe} />
      <PopoverContent align="end" className="w-72 text-start">
        <p className="text-sm font-medium">{labels["skills.promote"]}</p>
        <p className="text-copy-muted text-xs">
          {labels["skills.promoteHint"]}
        </p>
        <div className="mt-1 flex justify-end gap-2">
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              setOpen(false);
            }}
          >
            {labels["catalogue.cancel"]}
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const formData = new FormData();
                formData.set("locale", locale);
                formData.set("skillId", skillId);
                try {
                  await action(formData);
                  toast.success(labels["skills.promoted"]);
                  setOpen(false);
                } catch (error) {
                  // A redirect is the page explaining itself — a duplicate name
                  // in the platform scope is the likely one here.
                  if (!isRedirectError(error)) {
                    showActionError(error, labels["catalogue.actionError"]);
                  }
                }
              });
            }}
          >
            {labels["skills.promote"]}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
