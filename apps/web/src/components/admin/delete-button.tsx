"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "~/components/admin/workspace";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

export type DeleteLabels = {
  delete: string;
  confirm: string;
  hint: string;
  cancel: string;
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
      <PopoverTrigger
        aria-label={labels.delete}
        title={labels.delete}
        className="text-copy-muted hover:bg-danger-soft hover:text-danger focus-visible:ring-danger/50 inline-flex size-8 items-center justify-center rounded-md outline-none focus-visible:ring-2"
      >
        <Trash2 className="size-4" aria-hidden />
      </PopoverTrigger>
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
          <form action={action}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name={idName} value={id} />
            <input
              type="hidden"
              name="scope"
              value={organizationId === null ? "global" : "org"}
            />
            {organizationId ? (
              <input
                type="hidden"
                name="organizationId"
                value={organizationId}
              />
            ) : null}
            <Button variant="danger">{labels.delete}</Button>
          </form>
        </div>
      </PopoverContent>
    </Popover>
  );
}
