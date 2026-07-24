"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { IconPicker } from "~/components/admin/icon-picker";
import { Button, Field, Select, TextInput } from "~/components/admin/workspace";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

export type EditServiceLabels = {
  edit: string;
  name: string;
  category: string;
  icon: string;
  save: string;
  searchIcons: string;
  emptyIcons: string;
};

/**
 * Inline editor for a service's name, category, and icon. Scope (global vs
 * this association) is carried as a hidden field so the server action applies
 * the matching permission — the button only renders when the viewer may edit.
 */
export function EditServiceButton({
  action,
  locale,
  serviceId,
  organizationId,
  name,
  icon,
  categoryId,
  categories,
  icons,
  labels,
}: {
  action: (formData: FormData) => Promise<void>;
  locale: string;
  serviceId: string;
  organizationId: string | null;
  name: string;
  icon: string;
  categoryId: string;
  categories: readonly { id: string; label: string }[];
  icons: readonly string[];
  labels: EditServiceLabels;
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
          <input type="hidden" name="serviceId" value={serviceId} />
          <input
            type="hidden"
            name="scope"
            value={organizationId === null ? "global" : "org"}
          />
          {organizationId ? (
            <input type="hidden" name="organizationId" value={organizationId} />
          ) : null}
          <Field label={labels.name}>
            <TextInput
              name="nameFr"
              defaultValue={name}
              required
              minLength={2}
            />
          </Field>
          <Field label={labels.category}>
            <Select name="categoryId" defaultValue={categoryId} required>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </Select>
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
