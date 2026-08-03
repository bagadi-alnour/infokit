import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft, GitBranch, Plus } from "lucide-react";
import Link from "next/link";

import { ActionFeedbackForm } from "~/components/admin/action-feedback-form";
import { WorkspacePage } from "~/components/admin/workspace";
import { PendingButton } from "~/components/pending-button";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { DatePicker } from "~/components/ui/date-picker";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { SelectField } from "~/components/ui/select-field";
import { Textarea } from "~/components/ui/textarea";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { requirePermission } from "~/server/auth/require";
import { db } from "~/server/db";
import { cities, cityTranslations, organizations } from "~/server/db/schema";
import { createSimulatorFlow } from "../actions";

function dateValue(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export default async function NewSimulatorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  await requirePermission("content.simulator.review", locale);
  const t = await loadPageCatalog(locale, "dashboard-simulator");
  const [organizationRows, cityRows] = await Promise.all([
    db
      .select({ id: organizations.id, name: organizations.displayName })
      .from(organizations)
      .orderBy(asc(organizations.displayName)),
    db
      .select({
        id: cities.id,
        code: cities.code,
        name: cityTranslations.name,
      })
      .from(cities)
      .leftJoin(
        cityTranslations,
        and(
          eq(cityTranslations.cityId, cities.id),
          eq(cityTranslations.languageCode, locale),
        ),
      )
      .where(eq(cities.active, true))
      .orderBy(asc(cities.code)),
  ]);
  const today = new Date();
  const nextReview = new Date(today);
  nextReview.setDate(nextReview.getDate() + 30);

  return (
    <WorkspacePage width="content">
      <Button
        variant="ghost"
        nativeButton={false}
        render={<Link href={localizedPath("/dashboard/simulator", locale)} />}
      >
        <ArrowLeft aria-hidden />
        {t["create.back"]}
      </Button>

      <header className="mt-5 border-b pb-6">
        {/* This page draws its own eyebrow, so the eyebrow is where the guide
            family lands (§5) — the rule under a `PageHeader` title is the same
            decision on the pages that use one. */}
        <p className="text-guide flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]">
          <GitBranch className="size-4" aria-hidden />
          {t["create.eyebrow"]}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {t.createTitle}
        </h1>
        <p className="text-copy-muted mt-2 max-w-3xl text-sm leading-relaxed">
          {t["create.intro"]}
        </p>
      </header>

      <ActionFeedbackForm
        action={createSimulatorFlow}
        successMessage={t["create.success"]}
        errorMessage={t["create.error"]}
        className="mt-6 grid gap-5"
      >
        <input type="hidden" name="locale" value={locale} />

        <Card>
          <CardHeader>
            <CardTitle>{t["create.ownership"]}</CardTitle>
            <CardDescription>{t["create.ownershipHint"]}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <Field className="md:col-span-2">
              <FieldLabel htmlFor="simulator-name">{t.internalName}</FieldLabel>
              <Input
                id="simulator-name"
                name="internalName"
                placeholder={t.namePlaceholder}
                minLength={2}
                maxLength={180}
                autoFocus
                required
              />
              <FieldDescription>{t["create.required"]}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="simulator-owner">{t.owner}</FieldLabel>
              <SelectField id="simulator-owner" name="organizationId">
                <option value="">{t.platformOwner}</option>
                {organizationRows.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </SelectField>
            </Field>
            <Field>
              <FieldLabel htmlFor="simulator-city">{t.city}</FieldLabel>
              <SelectField id="simulator-city" name="cityId">
                <option value="">{t.allCities}</option>
                {cityRows.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name ?? city.code}
                  </option>
                ))}
              </SelectField>
            </Field>
            <Field>
              <FieldLabel htmlFor="simulator-source-language">
                {t.sourceLanguage}
              </FieldLabel>
              <SelectField
                id="simulator-source-language"
                name="sourceLanguage"
                defaultValue={locale}
              >
                {(["fr", "en", "ar"] as const).map((language) => (
                  <option key={language} value={language}>
                    {t[`language.${language}`]}
                  </option>
                ))}
              </SelectField>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t["create.content"]}</CardTitle>
            <CardDescription>{t["create.contentHint"]}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <Field>
              <FieldLabel htmlFor="simulator-first-question">
                {t.initialPrompt}
              </FieldLabel>
              <Textarea
                id="simulator-first-question"
                name="initialPrompt"
                placeholder={t.initialPromptPlaceholder}
                rows={3}
                minLength={2}
                maxLength={2000}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="simulator-first-explanation">
                {t.initialExplanation}
              </FieldLabel>
              <Textarea
                id="simulator-first-explanation"
                name="initialExplanation"
                placeholder={t.initialExplanationPlaceholder}
                rows={3}
                maxLength={4000}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t["create.review"]}</CardTitle>
            <CardDescription>{t["create.reviewHint"]}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <Field>
              <FieldLabel htmlFor="simulator-source-summary">
                {t["editor.sourceSummary"]}
              </FieldLabel>
              <Textarea
                id="simulator-source-summary"
                name="sourceSummary"
                placeholder={t["editor.sourceSummaryHint"]}
                rows={4}
                minLength={10}
                maxLength={4000}
                required
              />
            </Field>
            <div className="grid gap-5 md:grid-cols-2">
              <Field>
                <FieldLabel>{t.lastReviewedDate}</FieldLabel>
                <DatePicker
                  name="lastReviewedDate"
                  locale={locale}
                  defaultValue={dateValue(today)}
                  placeholder={t["date.select"]}
                  clearLabel={t["date.clear"]}
                  required
                />
              </Field>
              <Field>
                <FieldLabel>{t.reviewDueDate}</FieldLabel>
                <DatePicker
                  name="reviewDueDate"
                  locale={locale}
                  defaultValue={dateValue(nextReview)}
                  placeholder={t["date.select"]}
                  clearLabel={t["date.clear"]}
                  required
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        <div className="border-line bg-surface sticky bottom-0 flex items-center justify-between gap-4 border-t px-1 py-4">
          <p className="text-copy-muted text-xs">{t["create.required"]}</p>
          <PendingButton>
            <Plus aria-hidden />
            {t.create}
          </PendingButton>
        </div>
      </ActionFeedbackForm>
    </WorkspacePage>
  );
}
