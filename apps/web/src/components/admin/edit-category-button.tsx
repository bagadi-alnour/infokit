"use client";

import { IconPicker } from "~/components/admin/icon-picker";
import { Field, TextInput } from "~/components/admin/workspace";
import { taxonomyIconNames } from "~/components/taxonomy-icon";

import { RowEditPopover } from "./catalogue-row-controls";
import type { CatalogueLabels } from "./catalogue-rows";

/** Inline editor for a platform category's name and icon (platform-only). */
export function EditCategoryButton({
  action,
  locale,
  categoryId,
  name,
  icon,
  labels,
}: {
  action: (formData: FormData) => Promise<void>;
  locale: string;
  categoryId: string;
  name: string;
  icon: string;
  labels: CatalogueLabels;
}) {
  return (
    <RowEditPopover
      action={action}
      label={labels["catalogue.categories.edit"]}
      save={labels["catalogue.save"]}
      locale={locale}
      idName="categoryId"
      id={categoryId}
    >
      <Field label={labels["catalogue.categories.labelFr"]}>
        <TextInput name="labelFr" defaultValue={name} required minLength={2} />
      </Field>
      <Field label={labels["catalogue.categories.icon"]}>
        <IconPicker
          name="icon"
          icons={taxonomyIconNames}
          defaultValue={icon}
          variant="grid"
          ariaLabel={labels["catalogue.categories.icon"]}
          searchLabel={labels["catalogue.icon.search"]}
          emptyLabel={labels["catalogue.icon.empty"]}
        />
      </Field>
    </RowEditPopover>
  );
}
