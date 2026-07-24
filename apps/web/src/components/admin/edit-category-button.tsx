"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { IconPicker } from "~/components/admin/icon-picker";
import { Button, Field, TextInput } from "~/components/admin/workspace";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

export type EditCategoryLabels = {
  edit: string;
  name: string;
  icon: string;
  save: string;
  searchIcons: string;
  emptyIcons: string;
};

/** Inline editor for a platform category's name and icon (platform-only). */
export function EditCategoryButton({
  action,
  locale,
  categoryId,
  name,
  icon,
  icons,
  labels,
}: {
  action: (formData: FormData) => Promise<void>;
  locale: string;
  categoryId: string;
  name: string;
  icon: string;
  icons: readonly string[];
  labels: EditCategoryLabels;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={labels.edit}
        title={labels.edit}
        className="text-copy-muted hover:bg-subtle hover:text-ink focus-visible:ring-brand/50 inline-flex size-8 items-center justify-center rounded-md outline-none focus-visible:ring-2"
      >
        <Pencil className="size-4" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <form action={action} className="grid gap-3 text-start">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="categoryId" value={categoryId} />
          <Field label={labels.name}>
            <TextInput
              name="labelFr"
              defaultValue={name}
              required
              minLength={2}
            />
          </Field>
          <Field label={labels.icon}>
            <IconPicker
              name="icon"
              icons={icons}
              defaultValue={icon}
              variant="grid"
              ariaLabel={labels.icon}
              searchLabel={labels.searchIcons}
              emptyLabel={labels.emptyIcons}
            />
          </Field>
          <Button>{labels.save}</Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
