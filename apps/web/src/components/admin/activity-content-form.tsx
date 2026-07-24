"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { updateActivityContent } from "~/app/[locale]/dashboard/activities/actions";
import {
  ActivityTranslationsEditor,
  type ActivityInitialTranslation,
} from "~/components/admin/activity-translations-editor";
import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import { SearchableMultiSelect } from "~/components/admin/searchable-select";
import { PendingButton } from "~/components/pending-button";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
import type { EditorialLanguage } from "~/lib/editorial-languages";

type Option = { value: string; label: string; description?: string };

/**
 * Edit an existing activity's per-language name/description plus its
 * classification (category, audience, public tags). Mirrors the article
 * content editor: everything posts inside one server-action form.
 */
export function ActivityEditorForm({
  locale,
  activityId,
  sourceLanguage,
  initial,
  categories,
  audiences,
  tags,
  initialCategoryId,
  initialAudienceId,
  initialTagIds,
  editorLabels,
  labels,
}: {
  locale: string;
  activityId: string;
  sourceLanguage: EditorialLanguage;
  initial: Partial<Record<EditorialLanguage, ActivityInitialTranslation>>;
  categories: Option[];
  audiences: Option[];
  tags: Option[];
  initialCategoryId: string;
  initialAudienceId: string;
  initialTagIds: string[];
  editorLabels: Record<string, string>;
  labels: {
    save: string;
    saved: string;
    saveError: string;
    category: string;
    audience: string;
    tags: string;
    tagsHint: string;
    tagsEmpty: string;
    tagsPlaceholder: string;
    noMatch: string;
  };
}) {
  const [selectedTagIds, setSelectedTagIds] = useState(initialTagIds);
  const showActionError = useActionErrorToast();
  const submit = async (formData: FormData) => {
    try {
      await updateActivityContent(formData);
      toast.success(labels.saved);
    } catch (error) {
      showActionError(error, labels.saveError);
    }
  };
  return (
    <form action={submit} className="grid gap-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="activityId" value={activityId} />
      <input type="hidden" name="sourceLanguage" value={sourceLanguage} />
      <ActivityTranslationsEditor
        activityId={activityId}
        interfaceLocale={locale}
        sourceLanguage={sourceLanguage}
        initial={initial}
        labels={editorLabels}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="activity-edit-category">
            {labels.category}
          </FieldLabel>
          <NativeSelect
            id="activity-edit-category"
            name="categoryId"
            defaultValue={initialCategoryId}
            required
          >
            {categories.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="activity-edit-audience">
            {labels.audience}
          </FieldLabel>
          <NativeSelect
            id="activity-edit-audience"
            name="audienceCategoryId"
            defaultValue={initialAudienceId}
            required
          >
            {audiences.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field>
        <FieldLabel>{labels.tags}</FieldLabel>
        {tags.length > 0 ? (
          <SearchableMultiSelect
            name="tagId"
            maxSelections={3}
            options={tags}
            value={selectedTagIds}
            onValueChange={setSelectedTagIds}
            label={labels.tags}
            placeholder={labels.tagsPlaceholder}
            emptyLabel={labels.noMatch}
          />
        ) : (
          <p className="text-copy-muted text-sm">{labels.tagsEmpty}</p>
        )}
        <FieldDescription>{labels.tagsHint}</FieldDescription>
      </Field>
      <PendingButton className="justify-self-end">
        <CheckCircle2 aria-hidden />
        {labels.save}
      </PendingButton>
    </form>
  );
}
