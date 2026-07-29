"use client";

import { type Locale } from "@infokit/shared/i18n";
import {
  ArrowLeft,
  FileImage,
  FileText,
  Globe2,
  LoaderCircle,
  MapPin,
  Plus,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { createArticle } from "~/app/[locale]/dashboard/articles/actions";
import { createArticleImageUpload } from "~/app/[locale]/dashboard/articles/image-actions";
import { createArticleTag } from "~/app/[locale]/dashboard/articles/tag-actions";
import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import {
  CoverImageField,
  coverImageLabels,
} from "~/components/admin/cover-image-field";
import {
  CheckboxFormField,
  DateFormField,
  FormSubmitButton,
  SearchableMultiSelectFormField,
  SearchableSelectFormField,
  SelectFormField,
  TextFormField,
} from "~/components/admin/form-field";
import { GlobalTagManager } from "~/components/admin/global-tag-manager";
import { PublicationChoice } from "~/components/admin/publication-choice";
import {
  articleFieldNames,
  TranslationWorkspace,
} from "~/components/admin/translation-workspace";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import {
  useFormMessages,
  useServerFormAction,
  useWorkspaceForm,
} from "~/hooks/use-workspace-form";
import { articleScopes } from "~/lib/article-scope";
import { familyStyles } from "~/lib/content-families";
import { editorialLanguageCodes } from "~/lib/editorial-languages";
import { readLabel, type FormMessages, type Labels } from "~/lib/form-messages";
import { slugPattern } from "~/lib/slug";
import { cn } from "~/lib/utils";

export interface ArticleFormOption {
  id: string;
  label: string;
  description?: string;
  organizationId?: string | null;
}

/**
 * The article as this form holds it: one field per `FormData` key `createArticle`
 * reads, so what the editor filled in and what the action parses cannot describe
 * different articles.
 *
 * The source text is not here. `TranslationWorkspace` owns the title, summary and
 * body for every language and posts its own inputs, so the required-title rule
 * stays where that editor lives; this schema covers the decisions around the
 * text — reach, owner, tags, dates and freshness — including the two the action
 * throws on, which an editor deserves to hear before saving rather than after.
 */
function articleFormSchema(messages: FormMessages, slugInvalid: string) {
  const optional = z.string();
  return z
    .object({
      sourceLanguage: z.enum(editorialLanguageCodes),
      slug: z
        .string()
        .regex(slugPattern, slugInvalid)
        .max(160, messages.tooLong),
      scope: z.enum(articleScopes),
      cityId: optional,
      organizationId: optional,
      // The chips input already stops at three; the server agrees, so the form
      // says so too rather than letting a fourth tag fail the save.
      tagIds: z.array(z.string()).max(3, messages.invalid),
      articleDate: optional,
      featured: z.boolean(),
      canBecomeOutdated: z.boolean(),
      unreliableFrom: optional,
    })
    .superRefine((values, context) => {
      if (values.scope === "city" && values.cityId === "") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cityId"],
          message: messages.required,
        });
      }
      if (values.canBecomeOutdated && values.unreliableFrom === "") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["unreliableFrom"],
          message: messages.required,
        });
      }
    });
}

type ArticleFieldValues = z.infer<ReturnType<typeof articleFormSchema>>;

/** A new article starts global, French, and a draft. */
const articleDefaults: ArticleFieldValues = {
  sourceLanguage: "fr",
  slug: "",
  scope: "global",
  cityId: "",
  organizationId: "",
  tagIds: [],
  articleDate: "",
  featured: false,
  canBecomeOutdated: false,
  unreliableFrom: "",
};

/** A tag is offered when it is platform-wide or belongs to the chosen owner. */
function tagBelongsTo(tag: ArticleFormOption, organizationId: string) {
  return tag.organizationId === null || tag.organizationId === organizationId;
}

export function ArticleCreateForm({
  locale,
  articlesPath,
  organizations,
  cities,
  tags,
  globalTags = [],
  canManageGlobalTags = false,
  canPublish = false,
  labels,
  editorLabels,
  aiEnabled,
}: {
  locale: Locale;
  articlesPath: string;
  organizations: ArticleFormOption[];
  cities: ArticleFormOption[];
  tags: ArticleFormOption[];
  globalTags?: { id: string; label: string; active: boolean }[];
  canManageGlobalTags?: boolean;
  /**
   * Whether this editor may put an article in front of readers from this form.
   * Publishing straight from a creation form means nobody has reviewed it, which
   * belongs to whoever holds the platform's own check; everyone else sends it up
   * the chain instead, so the two publishing choices are simply not offered.
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
    () => articleFormSchema(messages, readLabel(labels, "field.slugInvalid")),
    [labels, messages],
  );
  const form = useWorkspaceForm({ schema, defaultValues: articleDefaults });
  const { formProps } = useServerFormAction({
    form,
    action: createArticle,
    errorMessage: copy("toast.createError"),
    // The form is two columns and five cards tall, so the field holding the
    // submit back is often off screen.
    invalidMessage: messages.reviewFields,
  });

  // Tags an editor creates from here, and the box they type them in: a label on
  // its way to becoming a tag is not part of the article, so it stays local.
  const [availableTags, setAvailableTags] = useState(tags);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);
  const showActionError = useActionErrorToast();

  const sourceLanguage = form.watch("sourceLanguage");
  const slug = form.watch("slug");
  const scope = form.watch("scope");
  const organizationId = form.watch("organizationId");
  const canOutdate = form.watch("canBecomeOutdated");

  const offeredTags = useMemo(
    () => availableTags.filter((tag) => tagBelongsTo(tag, organizationId)),
    [availableTags, organizationId],
  );
  useEffect(() => {
    // A tag belongs to one organisation, so changing the owner drops a tag the
    // new owner does not have instead of posting a tag it may not use.
    const selected = form.getValues("tagIds");
    const kept = selected.filter((tagId) =>
      offeredTags.some((tag) => tag.id === tagId),
    );
    if (kept.length === selected.length) return;
    form.setValue("tagIds", kept, { shouldDirty: true });
  }, [form, offeredTags]);

  const addTag = async () => {
    const nextLabel = newTagLabel.trim();
    if (!nextLabel || creatingTag) return;
    setCreatingTag(true);
    try {
      const request = new FormData();
      request.set("locale", locale);
      request.set("label", nextLabel);
      request.set("organizationId", organizationId);
      const created = await createArticleTag(request);
      setAvailableTags((current) => {
        const withoutCreated = current.filter((tag) => tag.id !== created.id);
        return [...withoutCreated, created].sort((left, right) =>
          left.label.localeCompare(right.label, locale),
        );
      });
      const selected = form.getValues("tagIds");
      const room = !selected.includes(created.id) && selected.length < 3;
      if (room) {
        form.setValue("tagIds", [...selected, created.id], {
          shouldDirty: true,
        });
      }
      setNewTagLabel("");
      toast.success(copy(room ? "tag.created" : "tag.createdNotSelected"));
    } catch (error) {
      showActionError(error, copy("tag.createError"));
    } finally {
      setCreatingTag(false);
    }
  };

  return (
    <form {...formProps} className="grid gap-6">
      <input type="hidden" name="locale" value={locale} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button
            nativeButton={false}
            render={<Link href={articlesPath} />}
            variant="ghost"
            size="sm"
            className="-ms-2"
          >
            <ArrowLeft aria-hidden />
            {copy("create.back")}
          </Button>
          <div className="flex items-center gap-3">
            {/* The badge is this page's opening, so it carries the reading
                family (§5) rather than the accent: the activity editor and the
                article editor are the same layout, and drawing both openings in
                one teal made the two pages a heading apart. */}
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-lg",
                familyStyles.article.wash,
                familyStyles.article.text,
              )}
            >
              <FileText aria-hidden />
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
      </div>

      {/* Content spans the full width: the source pane and the language
       * accordion each need the room, and everything below it is short-field
       * work that reads fine in two columns. */}
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
              description={
                <>
                  {copy("field.slugHint")}
                  <span className="mt-1 block truncate" dir="ltr">
                    /{sourceLanguage}/articles/
                    {slug || copy("field.slugPreview")}
                  </span>
                </>
              }
              autoComplete="off"
              placeholder={copy("field.slugPlaceholder")}
            />
          </div>
          <Separator />
          {/* Keyed on the source language: switching it rebuilds the editor
           * around the new source text instead of relabelling the old one. */}
          <TranslationWorkspace
            key={sourceLanguage}
            entityKind="editorial_entry"
            organizationId={organizationId || undefined}
            interfaceLocale={locale}
            sourceLanguage={sourceLanguage}
            labels={editorLabels}
            aiEnabled={aiEnabled}
            names={articleFieldNames}
            fields={{ summary: true }}
            media={
              <Card>
                <CardHeader className="border-b">
                  <CardTitle className="flex items-center gap-2">
                    <FileImage aria-hidden />
                    {copy("image.heading")}
                  </CardTitle>
                  <CardDescription>{copy("image.hint")}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <CoverImageField
                    locale={locale}
                    sourceLanguage={sourceLanguage}
                    createUpload={createArticleImageUpload}
                    labels={coverImageLabels(labels, "image")}
                  />
                </CardContent>
              </Card>
            }
          />
        </CardContent>
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>{copy("create.scopeHeading")}</CardTitle>
              <CardDescription>{copy("create.scopeHint")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <SelectFormField
                control={form.control}
                name="scope"
                label={copy("scope.type")}
                description={
                  <span className="flex gap-2">
                    {scope === "global" ? (
                      <Globe2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                    ) : (
                      <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                    )}
                    {copy(
                      scope === "global"
                        ? "scope.globalHint"
                        : "scope.cityHint",
                    )}
                  </span>
                }
              >
                <option value="global">{copy("scope.global")}</option>
                <option value="city">{copy("scope.city")}</option>
              </SelectFormField>
              {/* A city-scoped article needs its city, so the field only exists
               * while the answer matters — and only then does it post. */}
              {scope === "city" ? (
                <SearchableSelectFormField
                  control={form.control}
                  name="cityId"
                  label={copy("field.city")}
                  options={cities.map((city) => ({
                    value: city.id,
                    label: city.label,
                  }))}
                  placeholder={copy("field.cityPlaceholder")}
                  emptyLabel={copy("noMatch")}
                  required
                />
              ) : null}
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>{copy("create.classificationHeading")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {offeredTags.length > 0 ? (
                <SearchableMultiSelectFormField
                  control={form.control}
                  name="tagIds"
                  label={copy("field.tags")}
                  description={copy("field.tagsHint")}
                  options={offeredTags.map((tag) => ({
                    value: tag.id,
                    label: tag.label,
                    description: tag.description,
                  }))}
                  placeholder={copy("field.tagsPlaceholder")}
                  emptyLabel={copy("noMatch")}
                  maxSelections={3}
                />
              ) : (
                <Field className="gap-1">
                  <FieldLabel>{copy("field.tags")}</FieldLabel>
                  <p className="text-copy-muted text-sm">
                    {copy("field.tagsEmpty")}
                  </p>
                  <FieldDescription className="text-copy-muted text-xs">
                    {copy("field.tagsHint")}
                  </FieldDescription>
                </Field>
              )}
              <div className="border-line bg-subtle grid gap-2 rounded-lg border p-3">
                <p className="text-copy-muted text-xs">
                  {copy("tag.createHint")}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={newTagLabel}
                    onChange={(event) => {
                      setNewTagLabel(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      // Enter here creates a tag; it must not also submit the
                      // article the editor is still writing.
                      event.preventDefault();
                      void addTag();
                    }}
                    maxLength={120}
                    aria-label={copy("tag.newLabel")}
                    placeholder={copy("tag.newPlaceholder")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    disabled={!newTagLabel.trim() || creatingTag}
                    onClick={() => void addTag()}
                  >
                    {creatingTag ? (
                      <LoaderCircle className="animate-spin" aria-hidden />
                    ) : (
                      <Tag aria-hidden />
                    )}
                    {copy("tag.create")}
                  </Button>
                </div>
              </div>
              {canManageGlobalTags ? (
                <GlobalTagManager
                  locale={locale}
                  tags={globalTags}
                  labels={labels}
                />
              ) : null}
              <DateFormField
                control={form.control}
                name="articleDate"
                label={copy("field.articleDate")}
                description={copy("field.articleDateHint")}
                locale={locale}
                placeholder={copy("date.select")}
                clearLabel={copy("date.clear")}
              />
              <CheckboxFormField
                control={form.control}
                name="featured"
                label={copy("field.featured")}
                description={copy("field.featuredHint")}
                className="border-line bg-subtle rounded-lg border p-3"
              />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:sticky xl:top-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>{copy("freshness.question")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <CheckboxFormField
                control={form.control}
                name="canBecomeOutdated"
                label={copy("freshness.canOutdate")}
                description={copy("freshness.canOutdateHint")}
                className="border-line bg-subtle rounded-lg border p-3"
              />
              {canOutdate ? (
                <DateFormField
                  control={form.control}
                  name="unreliableFrom"
                  label={copy("freshness.unreliableFrom")}
                  description={copy("freshness.unreliableHint")}
                  locale={locale}
                  placeholder={copy("date.select")}
                  clearLabel={copy("date.clear")}
                  required
                />
              ) : null}
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
                render={<Link href={articlesPath} />}
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
