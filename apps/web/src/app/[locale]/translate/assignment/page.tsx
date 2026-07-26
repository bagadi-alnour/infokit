import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { and, eq, gt, isNull } from "drizzle-orm";
import { Languages, LockKeyhole } from "lucide-react";

import { saveExternalTranslation } from "~/app/[locale]/translate/assignment/actions";
import { PendingButton } from "~/components/pending-button";
import { SimulatorTranslationAssignment } from "~/components/simulator-translation-assignment";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { requireRouteLocale } from "~/i18n/route-locale";
import {
  isRtlEditorialLanguage,
  type EditorialLanguage,
} from "~/lib/editorial-languages";
import { db } from "~/server/db";
import {
  translationAssignments,
  translationSourceVersions,
} from "~/server/db/schema";
import { readTranslationAssignmentSession } from "~/server/translation-assignment-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SourcePayload = {
  sourceLanguage?: unknown;
  translations?: Record<
    string,
    {
      title?: unknown;
      summary?: unknown;
      plainText?: unknown;
      /** Organisation narrative fields. */
      purpose?: unknown;
      goals?: unknown;
      values?: unknown;
    }
  >;
};

type TargetPayload = {
  title?: unknown;
  summary?: unknown;
  plainText?: unknown;
  purpose?: unknown;
  goals?: unknown;
  values?: unknown;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export default async function TranslationAssignmentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const [labels, simulatorLabels, consoleLabels] = await Promise.all([
    loadPageCatalog(locale, "dashboard-articles"),
    loadPageCatalog(locale, "dashboard-simulator"),
    loadPageCatalog(locale, "dashboard-console"),
  ]);
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
  const sourceTranslation =
    sourcePayload.translations?.[assignment.sourceLanguage];
  const target = assignment.targetContent as TargetPayload | null;
  const editable =
    assignment.state === "requested" || assignment.state === "draft";
  /** The organisation narrative has its own three fields, not title/summary/body. */
  const isOrganization = assignment.entityKind === "organization_profile";
  const targetDir = isRtlEditorialLanguage(
    assignment.targetLanguage as EditorialLanguage,
  )
    ? "rtl"
    : "ltr";

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
            dir={
              isRtlEditorialLanguage(
                assignment.sourceLanguage as EditorialLanguage,
              )
                ? "rtl"
                : "ltr"
            }
          >
            {isOrganization ? (
              <>
                {(
                  [
                    ["field.purpose", sourceTranslation?.purpose],
                    ["field.goals", sourceTranslation?.goals],
                    ["field.values", sourceTranslation?.values],
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
                  {typeof sourceTranslation?.title === "string"
                    ? sourceTranslation.title
                    : labels.untitled}
                </p>
              </div>
            )}
            {!isOrganization &&
            typeof sourceTranslation?.summary === "string" ? (
              <div>
                <p className="text-copy-muted text-xs font-medium uppercase tracking-wide">
                  {labels["field.summary"]}
                </p>
                <p className="mt-1.5 leading-relaxed">
                  {sourceTranslation.summary}
                </p>
              </div>
            ) : null}
            {!isOrganization &&
            typeof sourceTranslation?.plainText === "string" ? (
              <div>
                <p className="text-copy-muted text-xs font-medium uppercase tracking-wide">
                  {labels["field.body"]}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap leading-relaxed">
                  {sourceTranslation.plainText}
                </p>
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
              <form action={saveExternalTranslation} className="grid gap-4">
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
              </form>
            ) : editable ? (
              <form action={saveExternalTranslation} className="grid gap-4">
                <input type="hidden" name="locale" value={locale} />
                <Field>
                  <FieldLabel htmlFor="translation-title">
                    {labels["field.title"]}
                  </FieldLabel>
                  <Input
                    id="translation-title"
                    name="title"
                    defaultValue={
                      typeof target?.title === "string" ? target.title : ""
                    }
                    dir={
                      isRtlEditorialLanguage(
                        assignment.targetLanguage as EditorialLanguage,
                      )
                        ? "rtl"
                        : "ltr"
                    }
                    maxLength={200}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="translation-summary">
                    {labels["field.summary"]}
                  </FieldLabel>
                  <Textarea
                    id="translation-summary"
                    name="summary"
                    defaultValue={
                      typeof target?.summary === "string" ? target.summary : ""
                    }
                    dir={
                      isRtlEditorialLanguage(
                        assignment.targetLanguage as EditorialLanguage,
                      )
                        ? "rtl"
                        : "ltr"
                    }
                    rows={4}
                    maxLength={2000}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="translation-body">
                    {labels["field.body"]}
                  </FieldLabel>
                  <Textarea
                    id="translation-body"
                    name="body"
                    defaultValue={
                      typeof target?.plainText === "string"
                        ? target.plainText
                        : ""
                    }
                    dir={
                      isRtlEditorialLanguage(
                        assignment.targetLanguage as EditorialLanguage,
                      )
                        ? "rtl"
                        : "ltr"
                    }
                    rows={14}
                    maxLength={40_000}
                  />
                  <FieldDescription>
                    {labels["translator.bodyHint"]}
                  </FieldDescription>
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
              </form>
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
