import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { IdCard, LockKeyhole } from "lucide-react";
import Link from "next/link";

import { TranslatorProfileForm } from "~/components/translator-profile-form";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { requireRouteLocale } from "~/i18n/route-locale";
import { db } from "~/server/db";
import {
  languages,
  translationAssignments,
  translators,
} from "~/server/db/schema";
import {
  courseTitle,
  listCoursesForTranslator,
  listSkillsForTranslator,
  skillName,
  type SkillKind,
} from "~/server/skills";
import { readTranslationAssignmentSession } from "~/server/translation-assignment-session";
import { translatorProfileFacets } from "~/server/translators";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * A translator filling in their own profile, from the link that sent them work.
 *
 * "Sending content to a translator is the invitation": the assignment session
 * that lets them translate one article also lets them say which languages they
 * work in and what they can do — so the association does not have to guess it,
 * and a mission's conditions can be matched against it later.
 *
 * There is no account behind this page. The person is resolved from the
 * assignment the session cookie names, never from the form, and the page reads
 * and writes that one directory row and nothing else. An assignment that was
 * mailed to a typed address has no row to fill in, and says so.
 */
export default async function TranslatorProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const [labels, skillLabels] = await Promise.all([
    loadPageCatalog(locale, "dashboard-articles"),
    loadPageCatalog(locale, "dashboard-skills"),
  ]);
  const assignmentId = await readTranslationAssignmentSession();
  const [assignment] = assignmentId
    ? await db
        .select({
          translatorId: translationAssignments.translatorId,
          translatorName: translationAssignments.translatorName,
          translatorEmail: translationAssignments.translatorEmail,
        })
        .from(translationAssignments)
        .where(
          and(
            eq(translationAssignments.id, assignmentId),
            isNull(translationAssignments.revokedAt),
            gt(translationAssignments.expiresAt, new Date()),
          ),
        )
        .limit(1)
    : [];

  const backLink = (
    <Link
      href={`/${locale}/translate/assignment`}
      className="text-brand text-sm font-medium underline-offset-4 hover:underline"
    >
      {labels["translator.profile.back"]}
    </Link>
  );

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

  /**
   * The send went to an address, not to a directory entry — the flow that
   * existed before the directory. There is nowhere to store a declaration, so
   * the page explains the gap instead of collecting anything.
   */
  if (!assignment.translatorId) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-2xl place-items-center px-4 py-10">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>
              {labels["translator.profile.notInDirectoryTitle"]}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-copy-muted">
              {labels["translator.profile.notInDirectoryBody"]}
            </p>
            {backLink}
          </CardContent>
        </Card>
      </main>
    );
  }

  const translatorId = assignment.translatorId;
  const [[translator], languageRows, skillRows, courseRows, facets] =
    await Promise.all([
      db
        .select({
          displayName: translators.displayName,
          contactEmail: translators.contactEmail,
        })
        .from(translators)
        .where(eq(translators.id, translatorId))
        .limit(1),
      /**
       * The whole catalogue, not the `enabled` part: `enabled` says the platform
       * publishes content in a language, and a translator may well work in one it
       * does not.
       */
      db
        .select({
          code: languages.code,
          nativeName: languages.nativeName,
          englishName: languages.englishName,
          frenchName: languages.frenchName,
        })
        .from(languages)
        .orderBy(asc(languages.publicSortOrder), asc(languages.code)),
      listSkillsForTranslator(),
      listCoursesForTranslator(),
      translatorProfileFacets(translatorId),
    ]);

  const kindLabel = (kind: SkillKind) => {
    if (kind === "software") return skillLabels["skills.kind.software"];
    if (kind === "driving_permit") {
      return skillLabels["skills.kind.driving_permit"];
    }
    if (kind === "certification") {
      return skillLabels["skills.kind.certification"];
    }
    return skillLabels["skills.kind.skill"];
  };

  const languageOptions = languageRows.map((row) => ({
    value: row.code,
    label: row.nativeName,
    // The reader's own name for it, so someone searching "pachto" finds پښتو.
    description: locale === "fr" ? row.frenchName : row.englishName,
  }));
  const skillOptions = skillRows.map((row) => ({
    value: row.id,
    label: skillName(row, locale),
    description: kindLabel(row.kind),
  }));
  const courseOptions = courseRows.map((row) => ({
    value: row.id,
    label: courseTitle(row, locale),
    description: row.provider ?? undefined,
  }));

  const identity = labels["translator.profile.identity"]
    .replace(
      "{name}",
      translator?.displayName ??
        assignment.translatorName ??
        assignment.translatorEmail,
    )
    .replace("{email}", translator?.contactEmail ?? assignment.translatorEmail);

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-8 md:px-6">
      <header className="mb-6 flex items-start gap-3">
        <span className="bg-brand-soft text-brand flex size-11 items-center justify-center rounded-xl">
          <IdCard aria-hidden />
        </span>
        <div>
          <p className="text-copy-muted flex items-center gap-1.5 text-xs font-medium">
            <LockKeyhole className="size-3.5" aria-hidden />
            {labels["translator.secure"]}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {labels["translator.profile.title"]}
          </h1>
          <p className="text-copy-muted mt-2 text-sm">{identity}</p>
        </div>
      </header>

      {/**
       * The purpose, who reads it and how long it is kept, before anything is
       * collected — what docs/PHASE-3-TEAM-MANAGEMENT.md requires of every
       * language, training and skill declaration.
       */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{labels["translator.profile.notice.title"]}</CardTitle>
        </CardHeader>
        <CardContent className="text-copy-muted grid gap-2 text-sm">
          <p>{labels["translator.profile.notice.purpose"]}</p>
          <p>{labels["translator.profile.notice.visibility"]}</p>
          <p>{labels["translator.profile.notice.retention"]}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <TranslatorProfileForm
            locale={locale}
            languageOptions={languageOptions}
            skillOptions={skillOptions}
            courseOptions={courseOptions}
            languages={facets.languageRows}
            skills={facets.skillRows.map((row) => ({
              id: row.id,
              label: skillName(row, locale),
              state: row.state,
            }))}
            courses={facets.courseRows.map((row) => ({
              id: row.id,
              label: courseTitle(row, locale),
              state: row.state,
            }))}
            labels={labels}
          />
        </CardContent>
      </Card>

      <div className="mt-6">{backLink}</div>
    </main>
  );
}
