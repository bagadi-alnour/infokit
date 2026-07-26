"use client";

import {
  ArrowLeft,
  FileImage,
  FileText,
  Globe2,
  LoaderCircle,
  MapPin,
  Plus,
  Tag,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { createArticle } from "~/app/[locale]/dashboard/articles/actions";
import { createArticleImageUpload } from "~/app/[locale]/dashboard/articles/image-actions";
import { createArticleTag } from "~/app/[locale]/dashboard/articles/tag-actions";
import {
  isPermissionDeniedError,
  useActionErrorToast,
} from "~/components/admin/admin-ui-provider";
import {
  CoverImagePreview,
  useCoverImagePreview,
} from "~/components/admin/cover-image-preview";
import { GlobalTagManager } from "~/components/admin/global-tag-manager";
import {
  ArticleContentFields,
  emptyArticleContent,
} from "~/components/admin/article-content-fields";
import {
  SearchableMultiSelect,
  SearchableSelect,
} from "~/components/admin/searchable-select";
import { PendingButton } from "~/components/pending-button";
import { PublicationChoice } from "~/components/admin/publication-choice";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "~/components/ui/attachment";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { DatePicker } from "~/components/ui/date-picker";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { SelectField } from "~/components/ui/select-field";
import { Separator } from "~/components/ui/separator";
import {
  editorialLanguageCodes,
  type EditorialLanguage,
} from "~/lib/editorial-languages";

type SourceLanguage = EditorialLanguage;

export interface ArticleFormOption {
  id: string;
  label: string;
  description?: string;
  organizationId?: string | null;
}

function label(labels: Record<string, string>, key: string) {
  return labels[key] ?? key;
}

export function ArticleCreateForm({
  locale,
  articlesPath,
  organizations,
  cities,
  tags,
  globalTags = [],
  canManageGlobalTags = false,
  labels,
}: {
  locale: string;
  articlesPath: string;
  organizations: ArticleFormOption[];
  cities: ArticleFormOption[];
  tags: ArticleFormOption[];
  globalTags?: { id: string; label: string; active: boolean }[];
  canManageGlobalTags?: boolean;
  labels: Record<string, string>;
}) {
  const [organizationId, setOrganizationId] = useState("");
  const [scope, setScope] = useState<"global" | "city">("global");
  const [cityId, setCityId] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState<SourceLanguage>("fr");
  const [availableTags, setAvailableTags] = useState(tags);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);
  const [canOutdate, setCanOutdate] = useState(false);
  const [slug, setSlug] = useState("");
  const [coverAssetId, setCoverAssetId] = useState("");
  const [coverFileName, setCoverFileName] = useState("");
  const [coverAlt, setCoverAlt] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [imageState, setImageState] = useState<
    "idle" | "uploading" | "done" | "error"
  >("idle");
  const coverInputRef = useRef<HTMLInputElement>(null);
  const showActionError = useActionErrorToast();
  const { previewSrc, showFile, clearPreview } = useCoverImagePreview();

  const addTag = async () => {
    const nextLabel = newTagLabel.trim();
    if (!nextLabel || creatingTag) return;
    setCreatingTag(true);
    try {
      const formData = new FormData();
      formData.set("locale", locale);
      formData.set("label", nextLabel);
      formData.set("organizationId", organizationId);
      const created = await createArticleTag(formData);
      setAvailableTags((current) => {
        const withoutCreated = current.filter((tag) => tag.id !== created.id);
        return [...withoutCreated, created].sort((left, right) =>
          left.label.localeCompare(right.label, locale),
        );
      });
      setSelectedTags((current) =>
        current.includes(created.id) || current.length >= 3
          ? current
          : [...current, created.id],
      );
      setNewTagLabel("");
      toast.success(
        label(
          labels,
          selectedTags.length >= 3 ? "tag.createdNotSelected" : "tag.created",
        ),
      );
    } catch (error) {
      showActionError(error, label(labels, "tag.createError"));
    } finally {
      setCreatingTag(false);
    }
  };

  const uploadCover = async (file: File | undefined) => {
    if (!file) return;
    setCoverFileName(file.name);
    setImageState("uploading");
    try {
      const uploadRequest = new FormData();
      uploadRequest.set("locale", locale);
      uploadRequest.set("mimeType", file.type);
      uploadRequest.set("byteSize", String(file.size));
      uploadRequest.set("languageCode", sourceLanguage);
      uploadRequest.set("altText", coverAlt);
      uploadRequest.set("rightsConfirmed", rightsConfirmed ? "true" : "false");
      const upload = await createArticleImageUpload(uploadRequest);
      const response = await fetch(upload.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!response.ok) throw new Error("Upload failed");
      setCoverAssetId(upload.assetId);
      showFile(file);
      setImageState("done");
    } catch (error) {
      setCoverAssetId("");
      setImageState(isPermissionDeniedError(error) ? "idle" : "error");
      showActionError(error, label(labels, "image.error"));
    }
  };

  const clearCover = () => {
    setCoverAssetId("");
    setCoverFileName("");
    setImageState("idle");
    clearPreview();
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  const chooseCover = () => {
    if (!coverInputRef.current) return;
    coverInputRef.current.value = "";
    coverInputRef.current.click();
  };

  const canChooseCover =
    coverAlt.trim().length > 0 && rightsConfirmed && imageState !== "uploading";
  const attachmentDescription =
    imageState === "uploading"
      ? label(labels, "image.uploading")
      : imageState === "done"
        ? label(labels, "image.uploaded").replace("{name}", coverFileName)
        : imageState === "error"
          ? label(labels, "image.error")
          : label(labels, "image.constraints");

  return (
    <form action={createArticle} className="grid gap-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="coverAssetId" value={coverAssetId} />

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
            {label(labels, "create.back")}
          </Button>
          <div className="flex items-center gap-3">
            <span className="bg-brand-soft text-brand flex size-10 items-center justify-center rounded-lg">
              <FileText aria-hidden />
            </span>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {label(labels, "create.title")}
              </h1>
              <p className="text-copy-muted mt-1 max-w-2xl text-sm">
                {label(labels, "create.hint")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>{label(labels, "create.contentHeading")}</CardTitle>
            <CardDescription>
              {label(labels, "create.contentHint")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="article-source-language">
                  {label(labels, "field.sourceLanguage")}
                </FieldLabel>
                <SelectField
                  id="article-source-language"
                  name="sourceLanguage"
                  value={sourceLanguage}
                  onValueChange={(next) => {
                    setSourceLanguage(next as SourceLanguage);
                  }}
                >
                  {editorialLanguageCodes.map((language) => (
                    <option key={language} value={language}>
                      {label(labels, `language.${language}`)}
                    </option>
                  ))}
                </SelectField>
                <FieldDescription>
                  {label(labels, "field.sourceLanguageHint")}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="article-slug">
                  {label(labels, "field.slug")}
                </FieldLabel>
                <Input
                  id="article-slug"
                  name="slug"
                  value={slug}
                  onChange={(event) => {
                    setSlug(event.target.value);
                  }}
                  autoComplete="off"
                  placeholder={label(labels, "field.slugPlaceholder")}
                  pattern="[a-z0-9\-]*"
                />
                <FieldDescription>
                  {label(labels, "field.slugHint")}
                </FieldDescription>
                <p className="text-copy-muted truncate text-xs" dir="ltr">
                  /{sourceLanguage}/articles/
                  {slug || label(labels, "field.slugPreview")}
                </p>
              </Field>
            </div>
            <Separator />
            <ArticleContentFields
              key={sourceLanguage}
              interfaceLocale={locale}
              sourceLanguage={sourceLanguage}
              initial={emptyArticleContent}
              labels={labels}
            />
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:sticky xl:top-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>{label(labels, "create.scopeHeading")}</CardTitle>
              <CardDescription>
                {label(labels, "create.scopeHint")}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field>
                <FieldLabel htmlFor="article-scope">
                  {label(labels, "scope.type")}
                </FieldLabel>
                <SelectField
                  id="article-scope"
                  name="scope"
                  value={scope}
                  onValueChange={(next) => {
                    setScope(next as "global" | "city");
                  }}
                >
                  <option value="global">
                    {label(labels, "scope.global")}
                  </option>
                  <option value="city">{label(labels, "scope.city")}</option>
                </SelectField>
                <FieldDescription className="flex gap-2">
                  {scope === "global" ? (
                    <Globe2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                  ) : (
                    <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                  )}
                  {label(
                    labels,
                    scope === "global" ? "scope.globalHint" : "scope.cityHint",
                  )}
                </FieldDescription>
              </Field>
              {scope === "city" ? (
                <Field>
                  <FieldLabel>{label(labels, "field.city")}</FieldLabel>
                  <SearchableSelect
                    name="cityId"
                    options={cities.map((city) => ({
                      value: city.id,
                      label: city.label,
                    }))}
                    value={cityId}
                    onValueChange={setCityId}
                    label={label(labels, "field.city")}
                    placeholder={label(labels, "field.cityPlaceholder")}
                    emptyLabel={label(labels, "noMatch")}
                    required
                  />
                </Field>
              ) : (
                <input type="hidden" name="cityId" value="" />
              )}
              <Field>
                <FieldLabel>{label(labels, "field.organization")}</FieldLabel>
                <SearchableSelect
                  name="organizationId"
                  options={[
                    { value: "", label: label(labels, "scope.platform") },
                    ...organizations.map((organization) => ({
                      value: organization.id,
                      label: organization.label,
                    })),
                  ]}
                  value={organizationId}
                  onValueChange={(nextOrganizationId) => {
                    setOrganizationId(nextOrganizationId);
                    setSelectedTags((current) =>
                      current.filter((tagId) => {
                        const tag = availableTags.find(
                          (item) => item.id === tagId,
                        );
                        return (
                          tag?.organizationId === null ||
                          tag?.organizationId === nextOrganizationId
                        );
                      }),
                    );
                  }}
                  label={label(labels, "field.organization")}
                  placeholder={label(labels, "scope.platform")}
                  emptyLabel={label(labels, "noMatch")}
                />
                <FieldDescription>
                  {label(labels, "field.organizationHint")}
                </FieldDescription>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>
                {label(labels, "create.classificationHeading")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field>
                <FieldLabel>{label(labels, "field.tags")}</FieldLabel>
                {availableTags.some(
                  (tag) =>
                    tag.organizationId === null ||
                    tag.organizationId === organizationId,
                ) ? (
                  <SearchableMultiSelect
                    name="tagIds"
                    maxSelections={3}
                    options={availableTags
                      .filter(
                        (tag) =>
                          tag.organizationId === null ||
                          tag.organizationId === organizationId,
                      )
                      .map((tag) => ({
                        value: tag.id,
                        label: tag.label,
                        description: tag.description,
                      }))}
                    value={selectedTags}
                    onValueChange={setSelectedTags}
                    label={label(labels, "field.tags")}
                    placeholder={label(labels, "field.tagsPlaceholder")}
                    emptyLabel={label(labels, "noMatch")}
                  />
                ) : (
                  <p className="text-copy-muted text-sm">
                    {label(labels, "field.tagsEmpty")}
                  </p>
                )}
                <FieldDescription>
                  {label(labels, "field.tagsHint")}
                </FieldDescription>
                <div className="border-line bg-subtle grid gap-2 rounded-lg border p-3">
                  <p className="text-copy-muted text-xs">
                    {label(labels, "tag.createHint")}
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={newTagLabel}
                      onChange={(event) => {
                        setNewTagLabel(event.target.value);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void addTag();
                        }
                      }}
                      maxLength={120}
                      aria-label={label(labels, "tag.newLabel")}
                      placeholder={label(labels, "tag.newPlaceholder")}
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
                      {label(labels, "tag.create")}
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
              </Field>
              <Field>
                <FieldLabel htmlFor="article-date">
                  {label(labels, "field.articleDate")}
                </FieldLabel>
                <DatePicker
                  id="article-date"
                  name="articleDate"
                  locale={locale as "fr" | "en" | "ar"}
                  placeholder={label(labels, "date.select")}
                  clearLabel={label(labels, "date.clear")}
                />
                <FieldDescription>
                  {label(labels, "field.articleDateHint")}
                </FieldDescription>
              </Field>
              <label className="border-line bg-subtle flex items-start gap-3 rounded-lg border p-3 text-sm">
                <Checkbox name="featured" className="mt-0.5" />
                <span>
                  <span className="font-medium">
                    {label(labels, "field.featured")}
                  </span>
                  <span className="text-copy-muted mt-0.5 block text-xs">
                    {label(labels, "field.featuredHint")}
                  </span>
                </span>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <FileImage aria-hidden />
                {label(labels, "image.heading")}
              </CardTitle>
              <CardDescription>{label(labels, "image.hint")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field>
                <FieldLabel htmlFor="cover-alt">
                  {label(labels, "image.alt")}
                </FieldLabel>
                <Input
                  id="cover-alt"
                  value={coverAlt}
                  onChange={(event) => {
                    setCoverAlt(event.target.value);
                  }}
                  maxLength={500}
                />
                <FieldDescription>
                  {label(labels, "image.altHint")}
                </FieldDescription>
              </Field>
              <label className="flex items-start gap-3 text-sm">
                <Checkbox
                  checked={rightsConfirmed}
                  onCheckedChange={setRightsConfirmed}
                  className="mt-0.5"
                />
                <span>{label(labels, "image.rights")}</span>
              </label>
              <input
                ref={coverInputRef}
                id="article-cover-image"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="sr-only"
                disabled={!canChooseCover}
                onChange={(event) => void uploadCover(event.target.files?.[0])}
              />
              <Attachment state={imageState} className="w-full">
                <AttachmentMedia>
                  {imageState === "uploading" ? (
                    <LoaderCircle
                      data-slot="spinner"
                      className="animate-spin"
                      aria-hidden
                    />
                  ) : (
                    <FileImage aria-hidden />
                  )}
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>
                    {coverFileName || label(labels, "image.select")}
                  </AttachmentTitle>
                  <AttachmentDescription
                    role={imageState === "error" ? "alert" : undefined}
                  >
                    {attachmentDescription}
                  </AttachmentDescription>
                </AttachmentContent>
                {coverFileName && imageState !== "uploading" ? (
                  <AttachmentActions>
                    <AttachmentAction
                      type="button"
                      aria-label={label(labels, "image.remove")}
                      onClick={clearCover}
                    >
                      <X aria-hidden />
                    </AttachmentAction>
                  </AttachmentActions>
                ) : null}
                <AttachmentTrigger
                  aria-label={label(
                    labels,
                    coverFileName ? "image.replace" : "image.select",
                  )}
                  disabled={!canChooseCover}
                  onClick={chooseCover}
                />
              </Attachment>
              {previewSrc ? (
                <CoverImagePreview
                  src={previewSrc}
                  alt={coverAlt || coverFileName}
                />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>{label(labels, "freshness.question")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <label className="border-line bg-subtle flex items-start gap-3 rounded-lg border p-3 text-sm">
                <Checkbox
                  name="canBecomeOutdated"
                  checked={canOutdate}
                  onCheckedChange={setCanOutdate}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">
                    {label(labels, "freshness.canOutdate")}
                  </span>
                  <span className="text-copy-muted mt-0.5 block text-xs">
                    {label(labels, "freshness.canOutdateHint")}
                  </span>
                </span>
              </label>
              {canOutdate ? (
                <Field>
                  <FieldLabel htmlFor="article-unreliable-from">
                    {label(labels, "freshness.unreliableFrom")}
                  </FieldLabel>
                  <DatePicker
                    id="article-unreliable-from"
                    name="unreliableFrom"
                    locale={locale as "fr" | "en" | "ar"}
                    placeholder={label(labels, "date.select")}
                    clearLabel={label(labels, "date.clear")}
                    required
                  />
                  <FieldDescription>
                    {label(labels, "freshness.unreliableHint")}
                  </FieldDescription>
                </Field>
              ) : null}
            </CardContent>
            <CardContent className="border-t pt-5">
              <PublicationChoice
                locale={locale as "fr" | "en" | "ar"}
                labels={{
                  heading: label(labels, "publication.heading"),
                  hint: label(labels, "publication.hint"),
                  draft: label(labels, "publication.draft"),
                  now: label(labels, "publication.now"),
                  scheduled: label(labels, "publication.scheduled"),
                  date: label(labels, "publication.dateOnly"),
                  time: label(labels, "publication.time"),
                  selectDate: label(labels, "publication.selectDate"),
                  clearDate: label(labels, "publication.clearDate"),
                  dateHint: label(labels, "publication.dateHint"),
                }}
              />
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button
                nativeButton={false}
                render={<Link href={articlesPath} />}
                variant="outline"
              >
                {label(labels, "action.cancel")}
              </Button>
              <PendingButton>
                <Plus aria-hidden />
                {label(labels, "create.action")}
              </PendingButton>
            </CardFooter>
          </Card>
        </div>
      </div>
    </form>
  );
}
