"use client";

import { type Locale } from "@infokit/shared/i18n";
import { ArrowLeft, Phone, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { z } from "zod";

import { createBasicInformation } from "~/app/[locale]/dashboard/basics/actions";
import {
  CheckboxFormField,
  FormSubmitButton,
  SearchableSelectFormField,
  SelectFormField,
  TextAreaFormField,
  TextFormField,
} from "~/components/admin/form-field";
import { IconPicker } from "~/components/admin/icon-picker";
import { PublicationChoice } from "~/components/admin/publication-choice";
import {
  articleFieldNames,
  TranslationWorkspace,
} from "~/components/admin/translation-workspace";
import { taxonomyIconNames } from "~/components/taxonomy-icon";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Field, FieldDescription, FieldTitle } from "~/components/ui/field";
import { Separator } from "~/components/ui/separator";
import {
  useFormMessages,
  useServerFormAction,
  useWorkspaceForm,
} from "~/hooks/use-workspace-form";
import {
  basicInformationReaches,
  basicInformationReviewIntervals,
  BASIC_INFORMATION_REVIEW_DAYS,
} from "~/lib/basic-information";
import { editorialLanguageCodes } from "~/lib/editorial-languages";
import { readLabel, type FormMessages, type Labels } from "~/lib/form-messages";
import { slugPattern } from "~/lib/slug";

/** One row of a picker: the id that posts, and the words that name it. */
export interface BasicInformationOption {
  id: string;
  label: string;
}

/**
 * The same shape the action's `dialSchema` accepts, so an editor hears about a
 * number that cannot be dialled while they are still looking at the field.
 */
const dialPattern = /^[+(]?[\d][\d\s./()+-]*$/;

/**
 * The tile as this form holds it: one field per `FormData` key
 * `createBasicInformation` reads, so what the editor filled in and what the
 * action parses cannot describe different contacts.
 *
 * The label and the sentence saying when to use the number are not here.
 * `TranslationWorkspace` owns those for all eleven languages and posts its own
 * inputs; what this schema covers is everything around them — the digits, who
 * answers them, and when somebody has to check them again. The two rules the
 * action throws on are checked here as well, because an editor deserves to read
 * a sentence rather than a constraint violation.
 */
function basicInformationFormSchema(
  messages: FormMessages,
  labels: { slugInvalid: string; dialInvalid: string },
) {
  const optional = z.string();
  return z
    .object({
      sourceLanguage: z.enum(editorialLanguageCodes),
      slug: z
        .string()
        .regex(slugPattern, labels.slugInvalid)
        .max(160, messages.tooLong),
      dial: z.union([
        z.literal(""),
        z
          .string()
          .regex(dialPattern, labels.dialInvalid)
          .max(40, messages.tooLong),
      ]),
      reach: optional,
      dialInstead: z.union([
        z.literal(""),
        z
          .string()
          .regex(dialPattern, labels.dialInvalid)
          .max(40, messages.tooLong),
      ]),
      emergency: z.boolean(),
      categoryId: optional,
      answeredByOrganizationId: optional,
      organizationId: optional,
      cityId: optional,
      priority: optional,
      reviewIntervalDays: optional,
      sourceSummary: z.string().max(2000, messages.tooLong),
    })
    .superRefine((values, context) => {
      // A number that is displayed has to say how it is reached; the database
      // enforces the same pair, and 114 being offered as a call is exactly the
      // failure both checks exist to stop.
      if (values.dial !== "" && values.reach === "") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reach"],
          message: messages.required,
        });
      }
    });
}

type BasicInformationFieldValues = z.infer<
  ReturnType<typeof basicInformationFormSchema>
>;

/**
 * The glyph a contact starts with. Not part of the schema: `IconPicker` posts
 * its own hidden input and holds its own state, so the form library never sees
 * it — and it cannot be empty, which is the only thing the action asks of it.
 */
const DEFAULT_ICON = "phone";

/**
 * A new contact starts French, called by voice, not the number for danger, and a
 * draft. The interval is the quarter the whole kind is built around
 * (`~/lib/basic-information`).
 */
const basicInformationDefaults: BasicInformationFieldValues = {
  sourceLanguage: "fr",
  slug: "",
  dial: "",
  reach: "voice",
  dialInstead: "",
  emergency: false,
  categoryId: "",
  answeredByOrganizationId: "",
  organizationId: "",
  cityId: "",
  priority: "0",
  reviewIntervalDays: String(BASIC_INFORMATION_REVIEW_DAYS),
  sourceSummary: "",
};

export function BasicInformationCreateForm({
  locale,
  basicsPath,
  organizations,
  cities,
  categories,
  canPublish = false,
  labels,
  editorLabels,
  aiEnabled,
}: {
  locale: Locale;
  basicsPath: string;
  organizations: BasicInformationOption[];
  cities: BasicInformationOption[];
  categories: BasicInformationOption[];
  /**
   * Whether this editor may put a number in front of readers from this form.
   * Nothing on a form that has never been saved has been read by anyone, so the
   * two publishing choices belong to whoever holds the platform's own check; the
   * create action asks for exactly that, so everyone else is not offered them.
   */
  canPublish?: boolean;
  labels: Labels;
  /** The workspace's own vocabulary; see `~/lib/workspace-labels`. */
  editorLabels: Labels;
  /** False when no AI translation provider is configured for this deployment. */
  aiEnabled: boolean;
}) {
  const copy = (key: string) => readLabel(labels, key);
  const messages = useFormMessages(labels);
  const schema = useMemo(
    () =>
      basicInformationFormSchema(messages, {
        slugInvalid: readLabel(labels, "field.slugInvalid"),
        dialInvalid: readLabel(labels, "field.dialInvalid"),
      }),
    [labels, messages],
  );
  const form = useWorkspaceForm({
    schema,
    defaultValues: basicInformationDefaults,
  });
  const { formProps } = useServerFormAction({
    form,
    action: createBasicInformation,
    errorMessage: copy("toast.createError"),
    // The form is two columns and four cards tall, so the field holding the
    // submit back is often off screen.
    invalidMessage: messages.reviewFields,
  });

  const sourceLanguage = form.watch("sourceLanguage");
  const dial = form.watch("dial");
  const hasDial = dial.trim() !== "";

  useEffect(() => {
    // Both halves of the pair move together. A tile with no number cannot have
    // a reach or a fallback — the action refuses one, and the database refuses
    // it for every other writer — so dropping the number drops them here rather
    // than posting a combination that can only be rejected.
    if (hasDial) {
      if (form.getValues("reach") === "") {
        form.setValue("reach", "voice", { shouldDirty: true });
      }
      return;
    }
    if (form.getValues("reach") !== "") {
      form.setValue("reach", "", { shouldDirty: true });
    }
    if (form.getValues("dialInstead") !== "") {
      form.setValue("dialInstead", "", { shouldDirty: true });
    }
  }, [form, hasDial]);

  return (
    <form {...formProps} className="grid gap-6">
      <input type="hidden" name="locale" value={locale} />

      <div className="space-y-2">
        <Button
          nativeButton={false}
          render={<Link href={basicsPath} />}
          variant="ghost"
          size="sm"
          className="-ms-2"
        >
          <ArrowLeft aria-hidden />
          {copy("create.back")}
        </Button>
        <div className="flex items-center gap-3">
          {/* The page's one coloured element (DESIGN-SYSTEM.md §5). These are
              not one of the four reading families — a number is read inside the
              home page's urgent block, not as an article — so the opening
              carries the brand rather than borrowing a family's tint. */}
          <span className="bg-brand-soft text-brand flex size-10 items-center justify-center rounded-lg">
            <Phone aria-hidden />
          </span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {copy("create.title")}
            </h1>
            <p className="text-copy-muted mt-1 max-w-2xl text-sm">
              {copy("create.hint")}
            </p>
          </div>
        </div>
      </div>

      {/* The words span the full width: the source pane and the language
       * accordion each need the room, and everything below is short-field work
       * that reads fine in two columns. */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>{copy("create.contentHeading")}</CardTitle>
          <CardDescription>{copy("create.contentHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectFormField
              control={form.control}
              name="sourceLanguage"
              label={copy("field.sourceLanguage")}
              description={copy("field.sourceLanguageHint")}
            >
              {editorialLanguageCodes.map((language) => (
                <option key={language} value={language}>
                  {copy(`language.${language}`)}
                </option>
              ))}
            </SelectFormField>
            <TextFormField
              control={form.control}
              name="slug"
              label={copy("field.slug")}
              description={copy("field.slugHint")}
              autoComplete="off"
              placeholder={copy("field.slugPlaceholder")}
            />
          </div>
          <Separator />
          {/* No body: the whole text of a contact is its label and the sentence
           * saying when to use it, so the rich-text editor is not rendered at
           * all rather than rendered and dropped on save. Keyed on the source
           * language, so switching it rebuilds the editor around the new source
           * text instead of relabelling the old one. */}
          <TranslationWorkspace
            key={sourceLanguage}
            entityKind="editorial_entry"
            interfaceLocale={locale}
            sourceLanguage={sourceLanguage}
            labels={editorLabels}
            aiEnabled={aiEnabled}
            names={articleFieldNames}
            fields={{ summary: true, body: false }}
          />
        </CardContent>
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>{copy("create.numberHeading")}</CardTitle>
              <CardDescription>{copy("create.numberHint")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextFormField
                  control={form.control}
                  name="dial"
                  label={copy("field.dial")}
                  description={copy("field.dialHint")}
                  autoComplete="off"
                  inputMode="tel"
                  dir="ltr"
                  placeholder={copy("field.dialPlaceholder")}
                />
                {/* How a number is reached only exists while there is a number:
                 * a reach with nothing to dial is refused by the action and by
                 * the database check behind it. */}
                {hasDial ? (
                  <SelectFormField
                    control={form.control}
                    name="reach"
                    label={copy("field.reach")}
                    description={copy("field.reachHint")}
                    required
                  >
                    {basicInformationReaches.map((reach) => (
                      <option key={reach} value={reach}>
                        {copy(`reach.${reach}`)}
                      </option>
                    ))}
                  </SelectFormField>
                ) : null}
              </div>
              {hasDial ? (
                <TextFormField
                  control={form.control}
                  name="dialInstead"
                  label={copy("field.dialInstead")}
                  description={copy("field.dialInsteadHint")}
                  autoComplete="off"
                  inputMode="tel"
                  dir="ltr"
                  placeholder={copy("field.dialPlaceholder")}
                />
              ) : null}
              <Field>
                {/* A title rather than a label: the picker's trigger is a
                 * popover button carrying its own accessible name, and a
                 * `<label>` has nothing to point `htmlFor` at. */}
                <FieldTitle>{copy("field.icon")}</FieldTitle>
                <IconPicker
                  name="icon"
                  icons={taxonomyIconNames}
                  defaultValue={DEFAULT_ICON}
                  ariaLabel={copy("field.icon")}
                  searchLabel={copy("icon.search")}
                  emptyLabel={copy("icon.empty")}
                />
                <FieldDescription>{copy("field.iconHint")}</FieldDescription>
              </Field>
              <CheckboxFormField
                control={form.control}
                name="emergency"
                label={copy("field.emergency")}
                description={copy("field.emergencyHint")}
                className="border-line bg-subtle rounded-lg border p-3"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>{copy("create.ownerHeading")}</CardTitle>
              <CardDescription>{copy("create.ownerHint")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <SearchableSelectFormField
                control={form.control}
                name="organizationId"
                label={copy("field.organization")}
                description={copy("field.organizationHint")}
                options={[
                  { value: "", label: copy("scope.platform") },
                  ...organizations.map((organization) => ({
                    value: organization.id,
                    label: organization.label,
                  })),
                ]}
                placeholder={copy("scope.platform")}
                emptyLabel={copy("noMatch")}
              />
              {/* Who picks the phone up, which is not the same question as who
               * answers for the number being right: a platform-owned tile can
               * still print an association's line. */}
              <SearchableSelectFormField
                control={form.control}
                name="answeredByOrganizationId"
                label={copy("field.answeredBy")}
                description={copy("field.answeredByHint")}
                options={[
                  { value: "", label: copy("field.answeredBy.none") },
                  ...organizations.map((organization) => ({
                    value: organization.id,
                    label: organization.label,
                  })),
                ]}
                placeholder={copy("field.answeredBy.none")}
                emptyLabel={copy("noMatch")}
              />
              <SearchableSelectFormField
                control={form.control}
                name="cityId"
                label={copy("field.city")}
                description={copy("field.cityHint")}
                options={[
                  { value: "", label: copy("field.city.none") },
                  ...cities.map((city) => ({
                    value: city.id,
                    label: city.label,
                  })),
                ]}
                placeholder={copy("field.city.none")}
                emptyLabel={copy("noMatch")}
              />
              <SearchableSelectFormField
                control={form.control}
                name="categoryId"
                label={copy("field.category")}
                description={copy("field.categoryHint")}
                options={[
                  { value: "", label: copy("field.category.none") },
                  ...categories.map((category) => ({
                    value: category.id,
                    label: category.label,
                  })),
                ]}
                placeholder={copy("field.categoryPlaceholder")}
                emptyLabel={copy("noMatch")}
              />
              <TextFormField
                control={form.control}
                name="priority"
                label={copy("field.priority")}
                description={copy("field.priorityHint")}
                type="number"
                min={0}
                max={999}
                inputMode="numeric"
              />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:sticky xl:top-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>{copy("freshness.heading")}</CardTitle>
              <CardDescription>{copy("freshness.hint")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <SelectFormField
                control={form.control}
                name="reviewIntervalDays"
                label={copy("field.reviewInterval")}
                description={copy("field.reviewIntervalHint")}
              >
                {basicInformationReviewIntervals.map((days) => (
                  <option key={days} value={String(days)}>
                    {copy(`interval.${String(days)}`)}
                  </option>
                ))}
              </SelectFormField>
              <TextAreaFormField
                control={form.control}
                name="sourceSummary"
                label={copy("freshness.sourceSummary")}
                description={copy("freshness.sourceSummaryHint")}
                rows={3}
                maxLength={2000}
              />
            </CardContent>
            <CardContent className="border-t pt-5">
              <PublicationChoice
                locale={locale}
                canPublish={canPublish}
                labels={{
                  heading: copy("publication.heading"),
                  hint: copy("publication.hint"),
                  draft: copy("publication.draft"),
                  team: copy("publication.team"),
                  platform: copy("publication.platform"),
                  now: copy("publication.now"),
                  scheduled: copy("publication.scheduled"),
                  date: copy("publication.dateOnly"),
                  time: copy("publication.time"),
                  selectDate: copy("publication.selectDate"),
                  clearDate: copy("publication.clearDate"),
                  dateHint: copy("publication.dateHint"),
                }}
              />
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button
                nativeButton={false}
                render={<Link href={basicsPath} />}
                variant="outline"
              >
                {copy("action.cancel")}
              </Button>
              <FormSubmitButton control={form.control}>
                <Plus aria-hidden />
                {copy("create.action")}
              </FormSubmitButton>
            </CardFooter>
          </Card>
        </div>
      </div>
    </form>
  );
}
