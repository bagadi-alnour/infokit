"use client";

import { Field, Select, TextInput } from "~/components/admin/workspace";

import { RowEditPopover } from "./catalogue-row-controls";
import {
  tagColorTokens,
  visibilityText,
  type CatalogueLabels,
  type CatalogueTagRow,
} from "./catalogue-rows";

/** Inline editor for a tag's name, namespace, colour, and visibility. */
export function EditTagButton({
  action,
  locale,
  tagId,
  organizationId,
  name,
  namespace,
  colorToken,
  visibility,
  labels,
}: {
  action: (formData: FormData) => Promise<void>;
  locale: string;
  tagId: string;
  organizationId: string | null;
  name: string;
  namespace: string;
  colorToken: string;
  visibility: CatalogueTagRow["visibility"];
  labels: CatalogueLabels;
}) {
  return (
    <RowEditPopover
      action={action}
      label={labels["catalogue.tags.edit"]}
      save={labels["catalogue.save"]}
      locale={locale}
      idName="tagId"
      id={tagId}
      organizationId={organizationId}
    >
      <Field label={labels["catalogue.tags.labelFr"]}>
        <TextInput name="labelFr" defaultValue={name} required minLength={2} />
      </Field>
      <Field label={labels["catalogue.tags.namespace"]}>
        <TextInput name="namespace" defaultValue={namespace} />
      </Field>
      <Field label={labels["catalogue.tags.color"]}>
        <Select name="colorToken" defaultValue={colorToken}>
          {tagColorTokens.map((tone) => (
            <option key={tone} value={tone}>
              {tone}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={labels["catalogue.tags.visibility"]}>
        <Select name="visibility" defaultValue={visibility}>
          <option value="public">{visibilityText(labels, "public")}</option>
          <option value="workspace">
            {visibilityText(labels, "workspace")}
          </option>
        </Select>
      </Field>
    </RowEditPopover>
  );
}
