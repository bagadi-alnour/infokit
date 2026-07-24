"use client";

import { ImageUp, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import {
  createArticleImageUpload,
  removeArticleCoverImage,
  setArticleCoverImage,
} from "~/app/[locale]/dashboard/articles/image-actions";
import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import {
  CoverImagePreview,
  useCoverImagePreview,
} from "~/components/admin/cover-image-preview";
import { PendingButton } from "~/components/pending-button";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import type { EditorialLanguage } from "~/lib/editorial-languages";

export function ArticleMediaManager({
  locale,
  entryId,
  sourceLanguage,
  cover,
  labels,
}: {
  locale: string;
  entryId: string;
  sourceLanguage: EditorialLanguage;
  cover: { assetId: string; previewUrl: string; altText: string } | null;
  labels: Record<string, string>;
}) {
  const showActionError = useActionErrorToast();
  const [busy, setBusy] = useState(false);
  const [altText, setAltText] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { previewSrc, showFile, clearPreview } = useCoverImagePreview(
    cover?.previewUrl ?? null,
  );

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const request = new FormData();
      request.set("locale", locale);
      request.set("mimeType", file.type);
      request.set("byteSize", String(file.size));
      request.set("languageCode", sourceLanguage);
      request.set("altText", altText);
      request.set("rightsConfirmed", rightsConfirmed ? "true" : "false");
      const signed = await createArticleImageUpload(request);
      const response = await fetch(signed.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!response.ok) throw new Error("Upload failed");
      const attach = new FormData();
      attach.set("locale", locale);
      attach.set("entryId", entryId);
      attach.set("assetId", signed.assetId);
      await setArticleCoverImage(attach);
      showFile(file);
      toast.success(labels["image.saved"]);
      setAltText("");
      setRightsConfirmed(false);
    } catch (error) {
      showActionError(error, labels["image.error"] ?? "");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async (formData: FormData) => {
    try {
      await removeArticleCoverImage(formData);
      clearPreview();
      toast.success(labels["image.removed"]);
    } catch (error) {
      showActionError(error, labels["image.removeError"] ?? "");
    }
  };
  const previewAlt = altText.trim()
    ? altText
    : (cover?.altText ?? labels["image.attached"] ?? "");

  return (
    <div className="grid gap-3">
      {previewSrc ? (
        <CoverImagePreview src={previewSrc} alt={previewAlt} />
      ) : null}
      {cover ? (
        <div className="border-line bg-subtle flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
          <span className="inline-flex items-center gap-2">
            <ImageUp className="size-4" aria-hidden />
            {labels["image.attached"]}
          </span>
          <form action={remove}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="entryId" value={entryId} />
            <PendingButton variant="ghost" className="text-danger">
              <Trash2 aria-hidden />
              {labels["image.remove"]}
            </PendingButton>
          </form>
        </div>
      ) : null}
      <Field>
        <FieldLabel htmlFor="article-cover-alt">
          {labels["image.alt"]}
        </FieldLabel>
        <Input
          id="article-cover-alt"
          value={altText}
          onChange={(event) => {
            setAltText(event.target.value);
          }}
          maxLength={500}
        />
      </Field>
      <label className="border-line bg-subtle flex items-start gap-3 rounded-lg border p-3 text-sm">
        <Checkbox
          className="mt-0.5 shrink-0"
          checked={rightsConfirmed}
          onCheckedChange={setRightsConfirmed}
        />
        <span>{labels["image.rights"]}</span>
      </label>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={(event) => void upload(event.target.files?.[0])}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy || !rightsConfirmed || altText.trim().length === 0}
          onClick={() => inputRef.current?.click()}
        >
          <Upload aria-hidden />
          {cover ? labels["image.replace"] : labels["image.select"]}
        </Button>
        <span className="text-copy-muted text-xs">
          {busy ? labels["image.uploading"] : labels["image.constraints"]}
        </span>
      </div>
    </div>
  );
}
