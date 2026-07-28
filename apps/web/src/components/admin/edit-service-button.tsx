"use client";

import { IconPicker } from "~/components/admin/icon-picker";
import { StewardContactFields } from "~/components/admin/steward-contact";
import { Field, Select, TextInput } from "~/components/admin/workspace";
import { taxonomyIconNames } from "~/components/taxonomy-icon";
import type { StewardContactValues } from "~/lib/steward-contact";

import { RowEditPopover } from "./catalogue-row-controls";
import type {
  CatalogueCategoryOption,
  CatalogueLabels,
} from "./catalogue-rows";

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
  labels,
  steward,
}: {
  action: (formData: FormData) => Promise<void>;
  locale: string;
  serviceId: string;
  organizationId: string | null;
  name: string;
  icon: string;
  categoryId: string;
  categories: readonly CatalogueCategoryOption[];
  labels: CatalogueLabels;
  /**
   * The workspace-only "who to ask about this row" contact. Omitted where the
   * screen has not loaded it — the action then leaves the stored contact alone
   * rather than clearing it.
   */
  steward?: StewardContactValues;
}) {
  return (
    <RowEditPopover
      action={action}
      label={labels["catalogue.services.edit"]}
      save={labels["catalogue.services.save"]}
      locale={locale}
      idName="serviceId"
      id={serviceId}
      organizationId={organizationId}
    >
      <Field label={labels["catalogue.services.nameFr"]}>
        <TextInput name="nameFr" defaultValue={name} required minLength={2} />
      </Field>
      <Field label={labels["catalogue.services.category"]}>
        <Select name="categoryId" defaultValue={categoryId} required>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={labels["catalogue.services.icon"]}>
        <IconPicker
          name="icon"
          icons={taxonomyIconNames}
          defaultValue={icon}
          variant="grid"
          ariaLabel={labels["catalogue.services.icon"]}
          searchLabel={labels["catalogue.icon.search"]}
          emptyLabel={labels["catalogue.icon.empty"]}
        />
      </Field>
      {/* Folded away: a service is usually edited to fix its name, and the
       * steward contact is a rarer, separate errand. */}
      {steward ? (
        <details className="text-sm">
          <summary className="text-copy-muted cursor-pointer">
            {labels.shared["steward.title"]}
          </summary>
          <div className="mt-3">
            <StewardContactFields
              values={steward}
              labels={labels.shared}
              columns={false}
            />
          </div>
        </details>
      ) : null}
    </RowEditPopover>
  );
}
