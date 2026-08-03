"use client";

import { CheckCircle2 } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import {
  publishActivityLanguage,
  unpublishActivityLanguage,
  updateActivityContent,
  updateActivityDetails,
  updateActivityLocation,
  updateActivityTransit,
} from "~/app/[locale]/dashboard/activities/actions";
import { updateActivitySteward } from "~/app/[locale]/dashboard/steward-actions";
import { requestActivityTranslation } from "~/app/[locale]/dashboard/activities/translation-actions";
import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import type { LanguageMenuAbilities } from "~/components/admin/language-actions-menu";
import { SidebarFocusMode } from "~/components/admin/sidebar-focus-mode";
import {
  TranslationWorkspace,
  type WorkspaceLanguageWorkflow,
  type WorkspaceTranslation,
  type WorkspaceWorkflow,
} from "~/components/admin/translation-workspace";
import { PendingButton } from "~/components/pending-button";
import type { EditorialLanguage } from "~/lib/editorial-languages";

/**
 * Edit an existing activity's per-language name and description. Mirrors the
 * article content editor: every language posts inside one server-action form.
 *
 * Record details are rendered below the source fields, but their controls use
 * this form id too. The button below the workspace therefore saves the text and
 * the editable record details as one page-level action.
 */
export function ActivityEditorForm({
  formId,
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
  details,
  media,
  editorLabels,
  labels,
}: {
  formId: string;
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
  /** Record fields associated with this editor's single external form. */
  details?: React.ReactNode;
  /** The photo and its attachments, below the translation panel. */
  media?: React.ReactNode;
  editorLabels: Record<string, string>;
  labels: {
    save: string;
    saved: string;
    saveError: string;
  };
}) {
  const showActionError = useActionErrorToast();
  const submit = async (formData: FormData) => {
    try {
      await updateActivityContent(formData);
      await updateActivityDetails(formData);
      await updateActivityLocation(formData);
      await updateActivityTransit(formData);
      await updateActivitySteward(formData);
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
    <div className="grid gap-5">
      <SidebarFocusMode />
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
        formId={formId}
        media={media}
      >
        {details}
      </TranslationWorkspace>
      {/* Controls throughout both columns point at this form. Keeping it outside
       * the cards avoids nested forms while providing one Save for the record. */}
      <form id={formId} action={submit} className="grid justify-items-end">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="activityId" value={activityId} />
        <input type="hidden" name="recordId" value={activityId} />
        <input type="hidden" name="sourceLanguage" value={sourceLanguage} />
        <PendingButton>
          <CheckCircle2 aria-hidden />
          {labels.save}
        </PendingButton>
      </form>
    </div>
  );
}
