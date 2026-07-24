import { loadPageCatalog } from "@calais/shared/i18n/catalogs";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft, GitBranch, Plus } from "lucide-react";
import Link from "next/link";

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
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
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
    <div className="mx-auto max-w-5xl px-4 py-7 md:px-7 lg:px-8">
      <Button
        variant="ghost"
        nativeButton={false}
        render={<Link href={localizedPath("/dashboard/simulator", locale)} />}
      >
        <ArrowLeft aria-hidden />
        {t["create.back"]}
      </Button>

      <header className="mt-5 border-b pb-6">
        <p className="text-brand flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]">
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

      <form action={createSimulatorFlow} className="mt-6 grid gap-5">
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
              <NativeSelect id="simulator-owner" name="organizationId">
                <NativeSelectOption value="">
                  {t.platformOwner}
                </NativeSelectOption>
                {organizationRows.map((organization) => (
                  <NativeSelectOption
                    key={organization.id}
                    value={organization.id}
                  >
                    {organization.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="simulator-city">{t.city}</FieldLabel>
              <NativeSelect id="simulator-city" name="cityId">
                <NativeSelectOption value="">{t.allCities}</NativeSelectOption>
                {cityRows.map((city) => (
                  <NativeSelectOption key={city.id} value={city.id}>
                    {city.name ?? city.code}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="simulator-source-language">
                {t.sourceLanguage}
              </FieldLabel>
              <NativeSelect
                id="simulator-source-language"
                name="sourceLanguage"
                defaultValue={locale}
              >
                {(["fr", "en", "ar"] as const).map((language) => (
                  <NativeSelectOption key={language} value={language}>
                    {t[`language.${language}`]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
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
      </form>
    </div>
  );
}
