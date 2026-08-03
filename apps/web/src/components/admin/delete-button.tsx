"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { ActionFeedbackForm } from "~/components/admin/action-feedback-form";
import { Button } from "~/components/admin/workspace";
import { Popover, PopoverContent } from "~/components/ui/popover";

import { RowActionTrigger, RowScopeFields } from "./catalogue-row-controls";

export type DeleteLabels = {
  delete: string;
  confirm: string;
  hint: string;
  cancel: string;
  completed: string;
  error: string;
};

/**
 * Confirm-then-delete control. Scope travels as a hidden field so the server
 * action applies the matching permission; only rendered for rows the viewer
 * may delete and that are not in use.
 */
export function DeleteButton({
  action,
  idName,
  id,
  organizationId,
  locale,
  labels,
}: {
  action: (formData: FormData) => Promise<void>;
  idName: string;
  id: string;
  organizationId: string | null;
  locale: string;
  labels: DeleteLabels;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <RowActionTrigger label={labels.delete} icon={Trash2} tone="danger" />
      <PopoverContent align="end" className="w-64 text-start">
        <p className="text-sm font-medium">{labels.confirm}</p>
        <p className="text-copy-muted text-xs">{labels.hint}</p>
        <div className="mt-1 flex justify-end gap-2">
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              setOpen(false);
            }}
          >
            {labels.cancel}
          </Button>
          <ActionFeedbackForm
            action={action}
            successMessage={labels.completed}
            errorMessage={labels.error}
            onSuccess={() => {
              setOpen(false);
            }}
          >
            <RowScopeFields locale={locale} organizationId={organizationId} />
            <input type="hidden" name={idName} value={id} />
            <Button variant="danger">{labels.delete}</Button>
          </ActionFeedbackForm>
        </div>
      </PopoverContent>
    </Popover>
  );
}
