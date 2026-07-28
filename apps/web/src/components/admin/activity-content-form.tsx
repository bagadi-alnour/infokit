"use client";

import { CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  publishActivityLanguage,
  unpublishActivityLanguage,
  updateActivityContent,
} from "~/app/[locale]/dashboard/activities/actions";
import { requestActivityTranslation } from "~/app/[locale]/dashboard/activities/translation-actions";
import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import type { LanguageMenuAbilities } from "~/components/admin/language-actions-menu";
import { SearchableMultiSelect } from "~/components/admin/searchable-select";
import { SidebarFocusMode } from "~/components/admin/sidebar-focus-mode";
import {
  TranslationWorkspace,
  type WorkspaceLanguageWorkflow,
  type WorkspaceTranslation,
  type WorkspaceWorkflow,
} from "~/components/admin/translation-workspace";
import { PendingButton } from "~/components/pending-button";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { SelectField } from "~/components/ui/select-field";
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
  organizationId,
  sourceLanguage,
  initial,
  languageStates,
  abilities,
  aiEnabled,
  archived,
  canVerify,
  returnPath,
  categories,
  audiences,
  tags,
  initialCategoryId,
  initialAudienceId,
  initialTagIds,
  media,
  downloads,
  editorLabels,
  labels,
}: {
  locale: string;
  activityId: string;
  /** Null when the platform holds the activity itself, rather than a custodian. */
  organizationId: string | null;
  sourceLanguage: EditorialLanguage;
  initial: Partial<Record<EditorialLanguage, WorkspaceTranslation>>;
  /** Where every language stands on the server: published, scheduled, in review. */
  languageStates: Partial<Record<EditorialLanguage, WorkspaceLanguageWorkflow>>;
  abilities: Omit<LanguageMenuAbilities, "aiEnabled">;
  /** False when the deployment has no translation provider configured. */
  aiEnabled: boolean;
  /** True on an archived activity: every per-language action would be refused. */
  archived: boolean;
  canVerify: boolean;
  returnPath: string;
  categories: Option[];
  audiences: Option[];
  tags: Option[];
  initialCategoryId: string;
  initialAudienceId: string;
  initialTagIds: string[];
  /** The photo, laid out below both editor columns. */
  media?: React.ReactNode;
  /** The downloadable documents, laid out beside the tags field. */
  downloads?: React.ReactNode;
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

  /**
   * What each language's own menu offers, and the three actions behind it.
   * Every one re-checks on the server; this only decides what is worth showing.
   */
  const workflow = useMemo<WorkspaceWorkflow>(
    () => ({
      ownerField: "activityId",
      languages: languageStates,
      abilities,
      actions: {
        requestTranslation: requestActivityTranslation,
        publish: publishActivityLanguage,
        unpublish: unpublishActivityLanguage,
      },
      frozen: archived,
    }),
    [abilities, archived, languageStates],
  );

  return (
    <form action={submit} className="grid gap-5">
      <SidebarFocusMode />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="activityId" value={activityId} />
      <input type="hidden" name="sourceLanguage" value={sourceLanguage} />
      {/* Classification travels in the source column, so the translation rail
       * stays aligned with the text it mirrors. */}
      <TranslationWorkspace
        entityKind="activity"
        entityId={activityId}
        organizationId={organizationId ?? undefined}
        interfaceLocale={locale}
        sourceLanguage={sourceLanguage}
        initial={initial}
        labels={editorLabels}
        canVerify={canVerify}
        aiEnabled={aiEnabled}
        returnPath={returnPath}
        workflow={workflow}
        media={media}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="activity-edit-category">
              {labels.category}
            </FieldLabel>
            <SelectField
              id="activity-edit-category"
              name="categoryId"
              defaultValue={initialCategoryId}
              required
            >
              {categories.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </Field>
          <Field>
            <FieldLabel htmlFor="activity-edit-audience">
              {labels.audience}
            </FieldLabel>
            <SelectField
              id="activity-edit-audience"
              name="audienceCategoryId"
              defaultValue={initialAudienceId}
              required
            >
              {audiences.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </Field>
        </div>
        {/* Tags and the downloadable documents side by side: both are things
         * attached to the activity rather than words in it, and each is short
         * enough that stacking them only adds scrolling. The split is keyed to
         * this row's own width — the column it sits in narrows when the
         * translation rail appears beside it. */}
        <div className="@container">
          <div className="@xl:grid-cols-2 grid items-start gap-4">
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
            {downloads}
          </div>
        </div>
      </TranslationWorkspace>
      <PendingButton className="justify-self-end">
        <CheckCircle2 aria-hidden />
        {labels.save}
      </PendingButton>
    </form>
  );
}
