"use client";

import { BadgeCheck, CalendarX, Clock3, X } from "lucide-react";
import { useMemo, useState } from "react";

import { saveTranslatorProfile } from "~/app/[locale]/translate/profile/actions";
import {
  SearchableMultiSelect,
  type SearchableOption,
} from "~/components/admin/searchable-select";
import { PendingButton } from "~/components/pending-button";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";

/**
 * What one translator declared, and what it is worth so far — the same three
 * readings a coordinator gets in the roster: somebody's own word, a claim
 * waiting for a verifier, and a confirmed one.
 */
export type TranslatorDeclarationState =
  | "self_declared"
  | "awaiting_verification"
  | "verified"
  | "rejected"
  | "expired";

export interface TranslatorDeclaration {
  id: string;
  label: string;
  state: TranslatorDeclarationState;
}

/** A language they already claimed, with the direction it was claimed in. */
export interface TranslatorLanguageChoice {
  code: string;
  canTranslateInto: boolean;
  canTranslateFrom: boolean;
}

function DeclarationBadge({
  declaration,
  labels,
}: {
  declaration: TranslatorDeclaration;
  labels: Record<string, string>;
}) {
  const state = labels[`translator.profile.state.${declaration.state}`] ?? "";
  const marks: Record<
    TranslatorDeclarationState,
    { className: string; icon: React.ReactNode }
  > = {
    verified: {
      className: "text-ok border-ok/40",
      icon: <BadgeCheck aria-hidden />,
    },
    awaiting_verification: {
      className: "text-copy-muted border-dashed",
      icon: <Clock3 aria-hidden />,
    },
    rejected: {
      className: "text-destructive border-destructive/40",
      icon: <X aria-hidden />,
    },
    expired: {
      className: "text-copy-muted",
      icon: <CalendarX aria-hidden />,
    },
    self_declared: { className: "", icon: null },
  };
  const mark = marks[declaration.state];
  return (
    <Badge variant="outline" className={mark.className}>
      {mark.icon}
      {declaration.label}
      {/* The mark says it to the eye; this says it to a screen reader. */}
      <span className="sr-only">{` — ${state}`}</span>
    </Badge>
  );
}

function Declarations({
  declarations,
  labels,
}: {
  declarations: TranslatorDeclaration[];
  labels: Record<string, string>;
}) {
  if (declarations.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-copy-muted text-xs font-medium uppercase tracking-wide">
        {labels["translator.profile.declared"]}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {declarations.map((declaration) => (
          <DeclarationBadge
            key={declaration.id}
            declaration={declaration}
            labels={labels}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * The translator's own profile form. Every field is a selection from a shared
 * list — that is what lets an association match a mission's conditions against
 * it later without reading anything, and it is why there is nowhere here to type
 * a licence number.
 */
export function TranslatorProfileForm({
  locale,
  languageOptions,
  skillOptions,
  courseOptions,
  languages,
  skills,
  courses,
  labels,
}: {
  locale: string;
  /** Every language in the catalogue: a translator may work in one the site is not published in. */
  languageOptions: SearchableOption[];
  /** Only what the associations opened to translators. */
  skillOptions: SearchableOption[];
  courseOptions: SearchableOption[];
  languages: TranslatorLanguageChoice[];
  skills: TranslatorDeclaration[];
  courses: TranslatorDeclaration[];
  labels: Record<string, string>;
}) {
  const [languageCodes, setLanguageCodes] = useState(
    languages.map((language) => language.code),
  );
  const [skillIds, setSkillIds] = useState(skills.map((skill) => skill.id));
  const [courseIds, setCourseIds] = useState(
    courses.map((course) => course.id),
  );

  /**
   * The two directions, held here rather than left to the DOM: a save re-renders
   * this form with what the server now holds, and an uncontrolled checkbox whose
   * default changes under it is a checkbox that stops matching what it shows.
   * A language picked in this session has no row yet, so it falls back below.
   */
  const [directions, setDirections] = useState<
    Record<string, { into: boolean; from: boolean }>
  >(() =>
    Object.fromEntries(
      languages.map((language) => [
        language.code,
        { into: language.canTranslateInto, from: language.canTranslateFrom },
      ]),
    ),
  );

  const languageLabels = useMemo(
    () =>
      new Map(languageOptions.map((option) => [option.value, option.label])),
    [languageOptions],
  );

  return (
    <form action={saveTranslatorProfile} className="grid gap-6">
      <input type="hidden" name="locale" value={locale} />

      <Field>
        <FieldLabel>{labels["translator.profile.languages"]}</FieldLabel>
        <SearchableMultiSelect
          name="languages"
          options={languageOptions}
          value={languageCodes}
          onValueChange={setLanguageCodes}
          label={labels["translator.profile.languages"]}
          placeholder={labels["translator.profile.languagesPlaceholder"]}
          emptyLabel={labels["translator.profile.languagesEmpty"]}
        />
        <FieldDescription>
          {labels["translator.profile.languagesHint"]}
        </FieldDescription>
      </Field>

      {languageCodes.length > 0 ? (
        <div className="grid gap-2">
          <p className="text-sm font-medium">
            {labels["translator.profile.direction"]}
          </p>
          <p className="text-copy-muted text-xs">
            {labels["translator.profile.directionHint"]}
          </p>
          <div className="grid gap-2">
            {languageCodes.map((code) => {
              /** A newly picked language reads as "I translate into it". */
              const direction = directions[code] ?? { into: true, from: false };
              const set = (next: { into: boolean; from: boolean }) => {
                setDirections((current) => ({ ...current, [code]: next }));
              };
              return (
                <div
                  key={code}
                  className="border-line bg-subtle grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4"
                >
                  <span className="text-sm font-medium">
                    {languageLabels.get(code) ?? code}
                  </span>
                  {/*
                   * The two ticks travel as hidden fields rather than as the
                   * checkbox's own native input: React resets this form once the
                   * action returns, and a reset clears a checkbox back to its
                   * markup while the box on screen keeps showing this state — so
                   * the next save would drop a direction nobody unticked. A
                   * hidden field is written as an attribute, which is what a
                   * reset restores it to.
                   */}
                  {direction.into ? (
                    <input type="hidden" name={`into_${code}`} value="true" />
                  ) : null}
                  {direction.from ? (
                    <input type="hidden" name={`from_${code}`} value="true" />
                  ) : null}
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={direction.into}
                      onCheckedChange={(checked) => {
                        set({ ...direction, into: checked });
                      }}
                    />
                    {labels["translator.profile.into"]}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={direction.from}
                      onCheckedChange={(checked) => {
                        set({ ...direction, from: checked });
                      }}
                    />
                    {labels["translator.profile.from"]}
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <Field>
        <FieldLabel>{labels["translator.profile.skills"]}</FieldLabel>
        <SearchableMultiSelect
          name="skillIds"
          options={skillOptions}
          value={skillIds}
          onValueChange={setSkillIds}
          label={labels["translator.profile.skills"]}
          placeholder={labels["translator.profile.skillsPlaceholder"]}
          emptyLabel={labels["translator.profile.skillsEmpty"]}
        />
        <FieldDescription>
          {labels["translator.profile.skillsHint"]}
        </FieldDescription>
        <Declarations declarations={skills} labels={labels} />
      </Field>

      <Field>
        <FieldLabel>{labels["translator.profile.courses"]}</FieldLabel>
        <SearchableMultiSelect
          name="courseIds"
          options={courseOptions}
          value={courseIds}
          onValueChange={setCourseIds}
          label={labels["translator.profile.courses"]}
          placeholder={labels["translator.profile.coursesPlaceholder"]}
          emptyLabel={labels["translator.profile.coursesEmpty"]}
        />
        <FieldDescription>
          {labels["translator.profile.coursesHint"]}
        </FieldDescription>
        <Declarations declarations={courses} labels={labels} />
      </Field>

      {skills.length > 0 || courses.length > 0 ? (
        <p className="text-copy-muted text-xs">
          {labels["translator.profile.stateHint"]}
        </p>
      ) : null}

      <div className="flex justify-end">
        <PendingButton>{labels["translator.profile.save"]}</PendingButton>
      </div>
    </form>
  );
}
