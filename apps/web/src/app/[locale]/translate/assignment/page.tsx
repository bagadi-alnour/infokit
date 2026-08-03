import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { and, eq, gt, isNull } from "drizzle-orm";
import { Languages, LockKeyhole } from "lucide-react";

import { saveExternalTranslation } from "~/app/[locale]/translate/assignment/actions";
import { ActionFeedbackForm } from "~/components/admin/action-feedback-form";
import { PendingButton } from "~/components/pending-button";
import { SimulatorTranslationAssignment } from "~/components/simulator-translation-assignment";
import { TranslatorContextPanel } from "~/components/translator-context-panel";
import { TranslatorProfileInvitation } from "~/components/translator-profile-invitation";
import { TranslatorRichTextField } from "~/components/translator-rich-text-field";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { requireRouteLocale } from "~/i18n/route-locale";
import {
  editorialTextDirection,
  type EditorialLanguage,
} from "~/lib/editorial-languages";
import { buildWorkspaceLabels } from "~/lib/workspace-labels";
import { recordRestrictedRead } from "~/server/audit/reads";
import { db } from "~/server/db";
import {
  translationAssignments,
  translationSourceVersions,
} from "~/server/db/schema";
import {
  hasAssignmentContext,
  loadAssignmentContext,
} from "~/server/translation/assignment-context";
import { readTranslationAssignmentSession } from "~/server/translation-assignment-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** The translatable fields of one language, as a sealed source version holds them. */
type SourceFields = {
  title?: unknown;
  summary?: unknown;
  /** Present when the text was authored in the rich-text editor. */
  bodyHtml?: unknown;
  plainText?: unknown;
  /** Organisation narrative fields. */
  purpose?: unknown;
  goals?: unknown;
  values?: unknown;
};

/**
 * A sealed source payload, in the two shapes the content types write it in.
 *
 * An article and an organisation narrative key their fields by language, because
 * a revision carries every language it was saved with. An activity seals only
 * the language it was authored in — sealing the rest would declare every
 * translation stale each time a translator touched one — so it writes those
 * fields flat. `sourceFieldsOf` reads both, rather than each screen having to
 * know which content type it is looking at.
 */
type SourcePayload = SourceFields & {
  sourceLanguage?: unknown;
  translations?: Record<string, SourceFields>;
};

type TargetPayload = {
  title?: unknown;
  summary?: unknown;
  bodyHtml?: unknown;
  plainText?: unknown;
  purpose?: unknown;
  goals?: unknown;
  values?: unknown;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function sourceFieldsOf(
  payload: SourcePayload,
  sourceLanguage: string,
): SourceFields {
  return payload.translations?.[sourceLanguage] ?? payload;
}

export default async function TranslationAssignmentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const [labels, simulatorLabels, consoleLabels, overviewLabels] =
    await Promise.all([
      loadPageCatalog(locale, "dashboard-articles"),
      loadPageCatalog(locale, "dashboard-simulator"),
      loadPageCatalog(locale, "dashboard-console"),
      // The rich-text editor's own vocabulary lives once, in the create
      // catalogue, and travels with the editor wherever it is mounted.
      loadPageCatalog(locale, "dashboard-overview"),
    ]);
  const editorLabels = buildWorkspaceLabels(overviewLabels);
  // Article keys win: the console catalog only fills in the organisation
  // narrative field names this page borrows.
  const text: Record<string, string> = {
    ...consoleLabels,
    ...labels,
    ...simulatorLabels,
  };
  const assignmentId = await readTranslationAssignmentSession();
  const [assignment] = assignmentId
    ? await db
        .select({
          id: translationAssignments.id,
          entityKind: translationAssignments.entityKind,
          entityId: translationAssignments.entityId,
          /** Present only when the link went to someone the directory knows. */
          translatorId: translationAssignments.translatorId,
          targetLanguage: translationAssignments.targetLanguageCode,
          state: translationAssignments.state,
          instructions: translationAssignments.instructions,
          expiresAt: translationAssignments.expiresAt,
          sourceLanguage: translationSourceVersions.sourceLanguageCode,
          sourceContent: translationSourceVersions.sourceContentJson,
          targetContent: translationAssignments.submittedContentJson,
        })
        .from(translationAssignments)
        .innerJoin(
          translationSourceVersions,
          eq(
            translationSourceVersions.id,
            translationAssignments.sourceVersionId,
          ),
        )
        .where(
          and(
            eq(translationAssignments.id, assignmentId),
            isNull(translationAssignments.revokedAt),
            gt(translationAssignments.expiresAt, new Date()),
          ),
        )
        .limit(1)
    : [];

  if (!assignment) {
    /**
     * A translator session that no longer opens its assignment: revoked while
     * they had the page, or expired since. The link's own opening is already an
     * event, so this is the other end of the same story — recorded only when a
     * session was actually presented, since a bare visit to this URL identifies
     * nobody and proves nothing.
     */
    if (assignmentId) {
      await recordRestrictedRead({
        action: "translation.assignment.read_refused",
        subjectType: "translation_assignment",
        subjectId: assignmentId,
        actorType: "translator",
        outcome: "denied",
        errorCode: "assignment_unavailable",
      });
    }
    return (
      <main className="mx-auto grid min-h-dvh max-w-2xl place-items-center px-4 py-10">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{labels["translator.unavailableTitle"]}</CardTitle>
          </CardHeader>
          <CardContent className="text-copy-muted">
            {labels["translator.unavailableBody"]}
          </CardContent>
        </Card>
      </main>
    );
  }

  const sourcePayload = assignment.sourceContent as SourcePayload;
  const sourceTranslation = sourceFieldsOf(
    sourcePayload,
    assignment.sourceLanguage,
  );
  const target = assignment.targetContent as TargetPayload | null;
  const editable =
    assignment.state === "requested" || assignment.state === "draft";
  /** The organisation narrative has its own three fields, not title/summary/body. */
  const isOrganization = assignment.entityKind === "organization_profile";
  const targetDir = editorialTextDirection(
    assignment.targetLanguage as EditorialLanguage,
  );
  /**
   * Only what the source actually holds is asked for. A record with no summary
   * offering a summary field invites a translator to write one, and a sentence
   * nobody authored in the source language is not a translation of anything.
   */
  const sourceBodyHtml = asText(sourceTranslation.bodyHtml);
  const sourcePlainText = asText(sourceTranslation.plainText);
  const hasSummary = asText(sourceTranslation.summary).length > 0;
  const hasBody = Boolean(sourceBodyHtml || sourcePlainText);
  /**
   * The record the words belong to: its photo, and the labels it already
   * carries in this translator's language. Reference only — see
   * `~/server/translation/assignment-context`.
   */
  const context = await loadAssignmentContext({
    kind: assignment.entityKind,
    entityId: assignment.entityId,
    targetLanguage: assignment.targetLanguage,
    sourceLanguage: assignment.sourceLanguage,
  });

  if (assignment.entityKind === "simulator_flow") {
    return (
      <SimulatorTranslationAssignment
        locale={locale}
        assignment={assignment}
        labels={text}
      />
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-6xl px-4 py-8 md:px-6">
      <header className="mb-6 flex items-start gap-3">
        <span className="bg-brand-soft text-brand flex size-11 items-center justify-center rounded-xl">
          <Languages aria-hidden />
        </span>
        <div>
          <p className="text-copy-muted flex items-center gap-1.5 text-xs font-medium">
            <LockKeyhole className="size-3.5" aria-hidden />
            {labels["translator.secure"]}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {labels["translator.title"].replace(
              "{language}",
              text[`language.${assignment.targetLanguage}`] ??
                assignment.targetLanguage,
            )}
          </h1>
          <p className="text-copy-muted mt-2 text-sm">
            {labels["translator.expires"].replace(
              "{date}",
              new Intl.DateTimeFormat(locale, {
                dateStyle: "long",
                timeStyle: "short",
              }).format(assignment.expiresAt),
            )}
          </p>
        </div>
      </header>

      {assignment.translatorId ? (
        <TranslatorProfileInvitation locale={locale} labels={labels} />
      ) : null}

      {/* The record before its words: a translator who can see the photo and
       * the labels the record already carries is translating a thing, not a
       * paragraph. */}
      {hasAssignmentContext(context) ? (
        <TranslatorContextPanel
          context={context}
          direction={targetDir}
          labels={text}
        />
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              {labels["translator.source"].replace(
                "{language}",
                text[`language.${assignment.sourceLanguage}`] ??
                  assignment.sourceLanguage,
              )}
            </CardTitle>
          </CardHeader>
          <CardContent
            className="grid gap-5"
            lang={assignment.sourceLanguage}
            dir={editorialTextDirection(
              assignment.sourceLanguage as EditorialLanguage,
            )}
          >
            {isOrganization ? (
              <>
                {(
                  [
                    ["field.purpose", sourceTranslation.purpose],
                    ["field.goals", sourceTranslation.goals],
                    ["field.values", sourceTranslation.values],
                  ] as const
                ).map(([labelKey, value]) =>
                  asText(value) ? (
                    <div key={labelKey}>
                      <p className="text-copy-muted text-xs font-medium uppercase tracking-wide">
                        {text[labelKey]}
                      </p>
                      <p className="mt-1.5 whitespace-pre-wrap leading-relaxed">
                        {asText(value)}
                      </p>
                    </div>
                  ) : null,
                )}
              </>
            ) : null}
            {isOrganization ? null : (
              <div>
                <p className="text-copy-muted text-xs font-medium uppercase tracking-wide">
                  {labels["field.title"]}
                </p>
                <p className="mt-1.5 text-xl font-semibold">
                  {asText(sourceTranslation.title) || labels.untitled}
                </p>
              </div>
            )}
            {!isOrganization && hasSummary ? (
              <div>
                <p className="text-copy-muted text-xs font-medium uppercase tracking-wide">
                  {labels["field.summary"]}
                </p>
                <p className="mt-1.5 leading-relaxed">
                  {asText(sourceTranslation.summary)}
                </p>
              </div>
            ) : null}
            {!isOrganization && hasBody ? (
              <div>
                <p className="text-copy-muted text-xs font-medium uppercase tracking-wide">
                  {labels["field.body"]}
                </p>
                {/* Shown with its headings, lists and links intact: a
                 * translator asked to reproduce structure has to be able to see
                 * it. The markup was sanitised before it was stored
                 * (`sanitizeRichText`) and the source version sealed a copy of
                 * that same sanitised text. */}
                {sourceBodyHtml ? (
                  <div
                    className="prose-article [&_a]:text-brand mt-1.5 leading-relaxed [&_a]:underline [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:ps-5 [&_p:not(:last-child)]:mb-3 [&_ul]:list-disc [&_ul]:ps-5"
                    dangerouslySetInnerHTML={{ __html: sourceBodyHtml }}
                  />
                ) : (
                  <p className="mt-1.5 whitespace-pre-wrap leading-relaxed">
                    {sourcePlainText}
                  </p>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{labels["translator.yourTranslation"]}</CardTitle>
          </CardHeader>
          <CardContent>
            {assignment.instructions ? (
              <div className="border-line bg-subtle mb-5 rounded-lg border p-3 text-sm">
                <p className="font-medium">
                  {labels["translator.instructions"]}
                </p>
                <p className="text-copy-muted mt-1 whitespace-pre-wrap">
                  {assignment.instructions}
                </p>
              </div>
            ) : null}
            {editable && isOrganization ? (
              <ActionFeedbackForm
                action={saveExternalTranslation}
                successMessage={labels["translator.draftSaved"]}
                successMessageField="intent"
                successMessages={{
                  draft: labels["translator.draftSaved"],
                  submit: labels["translator.submittedSuccess"],
                }}
                errorMessage={labels["translator.saveError"]}
                className="grid gap-4"
              >
                <input type="hidden" name="locale" value={locale} />
                <input
                  type="hidden"
                  name="entityKind"
                  value="organization_profile"
                />
                <Field>
                  <FieldLabel htmlFor="translation-purpose">
                    {text["field.purpose"]}
                  </FieldLabel>
                  <Textarea
                    id="translation-purpose"
                    name="purpose"
                    defaultValue={asText(target?.purpose)}
                    dir={targetDir}
                    rows={4}
                    maxLength={4000}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="translation-goals">
                    {text["field.goals"]}
                  </FieldLabel>
                  <Textarea
                    id="translation-goals"
                    name="goals"
                    defaultValue={asText(target?.goals)}
                    dir={targetDir}
                    rows={5}
                    maxLength={4000}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="translation-values">
                    {text["field.values"]}
                  </FieldLabel>
                  <Textarea
                    id="translation-values"
                    name="values"
                    defaultValue={asText(target?.values)}
                    dir={targetDir}
                    rows={5}
                    maxLength={4000}
                  />
                </Field>
                <div className="flex flex-wrap justify-end gap-2">
                  <PendingButton
                    variant="secondary"
                    name="intent"
                    value="draft"
                  >
                    {labels["translator.saveDraft"]}
                  </PendingButton>
                  <PendingButton name="intent" value="submit">
                    {labels["translator.submit"]}
                  </PendingButton>
                </div>
              </ActionFeedbackForm>
            ) : editable ? (
              <ActionFeedbackForm
                action={saveExternalTranslation}
                successMessage={labels["translator.draftSaved"]}
                successMessageField="intent"
                successMessages={{
                  draft: labels["translator.draftSaved"],
                  submit: labels["translator.submittedSuccess"],
                }}
                errorMessage={labels["translator.saveError"]}
                className="grid gap-4"
              >
                <input type="hidden" name="locale" value={locale} />
                <Field>
                  <FieldLabel htmlFor="translation-title">
                    {labels["field.title"]}
                  </FieldLabel>
                  <Input
                    id="translation-title"
                    name="title"
                    defaultValue={asText(target?.title)}
                    dir={targetDir}
                    maxLength={200}
                  />
                </Field>
                {hasSummary ? (
                  <Field>
                    <FieldLabel htmlFor="translation-summary">
                      {labels["field.summary"]}
                    </FieldLabel>
                    <Textarea
                      id="translation-summary"
                      name="summary"
                      defaultValue={asText(target?.summary)}
                      dir={targetDir}
                      rows={4}
                      maxLength={2000}
                    />
                  </Field>
                ) : null}
                {hasBody ? (
                  <Field>
                    <FieldLabel htmlFor="translation-body">
                      {labels["field.body"]}
                    </FieldLabel>
                    {/* The field matches the field the source was written in:
                     * rich text where the newsroom used the editor, a plain box
                     * where the source is one sentence. */}
                    {sourceBodyHtml ? (
                      <TranslatorRichTextField
                        name="bodyHtml"
                        locale={locale}
                        direction={targetDir}
                        defaultHtml={asText(target?.bodyHtml)}
                        placeholder={labels["translator.bodyPlaceholder"]}
                        labels={editorLabels}
                      />
                    ) : (
                      <Textarea
                        id="translation-body"
                        name="body"
                        defaultValue={asText(target?.plainText)}
                        dir={targetDir}
                        rows={14}
                        maxLength={40_000}
                      />
                    )}
                    <FieldDescription>
                      {sourceBodyHtml
                        ? labels["translator.bodyRichHint"]
                        : labels["translator.bodyHint"]}
                    </FieldDescription>
                  </Field>
                ) : null}
                <div className="flex flex-wrap justify-end gap-2">
                  <PendingButton
                    variant="secondary"
                    name="intent"
                    value="draft"
                  >
                    {labels["translator.saveDraft"]}
                  </PendingButton>
                  <PendingButton name="intent" value="submit">
                    {labels["translator.submit"]}
                  </PendingButton>
                </div>
              </ActionFeedbackForm>
            ) : (
              <p className="text-copy-muted text-sm">
                {text[`translator.state.${assignment.state}`] ??
                  assignment.state}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
