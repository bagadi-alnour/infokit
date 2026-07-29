"use client";

import {
  FilePlus2,
  FileText,
  ImageUp,
  LoaderCircle,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  addArticleDownload,
  createArticleDocumentUpload,
  createArticleImageUpload,
  removeArticleCoverImage,
  removeArticleDownload,
  setArticleCoverImage,
} from "~/app/[locale]/dashboard/articles/image-actions";
import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import {
  CoverImagePreview,
  useCoverImagePreview,
} from "~/components/admin/cover-image-preview";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import type { EditorialLanguage } from "~/lib/editorial-languages";
import {
  compressImageForUpload,
  isImageTooLargeError,
} from "~/lib/image-compression";
import { cn } from "~/lib/utils";

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
  const [removing, startRemoving] = useTransition();
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
      // Re-encoded before anything is signed: the upload URL is bound to the
      // exact type and length declared here, so the size sent to the action has
      // to be the size that is about to be PUT.
      const image = await compressImageForUpload(file);
      const request = new FormData();
      request.set("locale", locale);
      request.set("mimeType", image.type);
      request.set("byteSize", String(image.size));
      request.set("languageCode", sourceLanguage);
      request.set("altText", altText);
      request.set("rightsConfirmed", rightsConfirmed ? "true" : "false");
      const signed = await createArticleImageUpload(request);
      const response = await fetch(signed.uploadUrl, {
        method: "PUT",
        body: image,
        headers: { "Content-Type": image.type },
      });
      if (!response.ok) throw new Error("Upload failed");
      const attach = new FormData();
      attach.set("locale", locale);
      attach.set("entryId", entryId);
      attach.set("assetId", signed.assetId);
      await setArticleCoverImage(attach);
      showFile(image);
      toast.success(labels["image.saved"]);
      setAltText("");
      setRightsConfirmed(false);
    } catch (error) {
      // The size rule is already written under the field; as a toast it says
      // exactly which rule the chosen file broke.
      showActionError(
        error,
        (isImageTooLargeError(error)
          ? labels["image.constraints"]
          : labels["image.error"]) ?? "",
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  /**
   * Removing the photo posts on its own, from a button rather than a form of
   * its own: this manager sits inside the article's editor form, and a form
   * cannot contain another one.
   */
  const remove = () => {
    startRemoving(async () => {
      try {
        const request = new FormData();
        request.set("locale", locale);
        request.set("entryId", entryId);
        await removeArticleCoverImage(request);
        clearPreview();
        toast.success(labels["image.removed"]);
      } catch (error) {
        showActionError(error, labels["image.removeError"] ?? "");
      }
    });
  };
  const previewAlt = altText.trim()
    ? altText
    : (cover?.altText ?? labels["image.attached"] ?? "");

  return (
    // The photo beside what describes it, once there is a photo to show. Keyed
    // to this card's own width: it is a narrow column on some screens and the
    // full width of the editor on others.
    <div
      className={cn(
        "@container grid items-start gap-4",
        previewSrc ? "@2xl:grid-cols-2" : null,
      )}
    >
      <div className="grid min-w-0 gap-3">
        {previewSrc ? (
          <CoverImagePreview src={previewSrc} alt={previewAlt} />
        ) : null}
        {cover ? (
          <div className="border-line bg-subtle flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
            <span className="inline-flex items-center gap-2">
              <ImageUp className="size-4" aria-hidden />
              {labels["image.attached"]}
            </span>
            <Button
              type="button"
              variant="ghost"
              className="text-danger"
              disabled={removing}
              onClick={remove}
            >
              {removing ? (
                <LoaderCircle className="animate-spin" aria-hidden />
              ) : (
                <Trash2 aria-hidden />
              )}
              {labels["image.remove"]}
            </Button>
          </div>
        ) : null}
      </div>
      <div className="grid min-w-0 gap-3">
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
    </div>
  );
}

/**
 * The documents offered with the article — a form to fill in, a printable
 * guide. It sits beside the tags field, so it is shaped like one: a label, what
 * is already attached, and a single way to add another.
 *
 * Every action posts from a button rather than a form of its own: this manager
 * lives inside the article's editor form, and a form cannot contain another.
 */
export function ArticleDownloadsManager({
  locale,
  entryId,
  sourceLanguage,
  downloads,
  labels,
}: {
  locale: string;
  entryId: string;
  sourceLanguage: EditorialLanguage;
  downloads: { assetId: string; title: string }[];
  labels: Record<string, string>;
}) {
  const showActionError = useActionErrorToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removing, startRemoving] = useTransition();
  const [title, setTitle] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const request = new FormData();
      request.set("locale", locale);
      request.set("byteSize", String(file.size));
      request.set("languageCode", sourceLanguage);
      request.set("rightsConfirmed", rightsConfirmed ? "true" : "false");
      const signed = await createArticleDocumentUpload(request);
      const response = await fetch(signed.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/pdf" },
      });
      if (!response.ok) throw new Error("Upload failed");
      const attach = new FormData();
      attach.set("locale", locale);
      attach.set("entryId", entryId);
      attach.set("assetId", signed.assetId);
      attach.set("languageCode", sourceLanguage);
      attach.set("title", title);
      await addArticleDownload(attach);
      toast.success(labels["download.added"]);
      setTitle("");
      setRightsConfirmed(false);
      setOpen(false);
    } catch (error) {
      showActionError(error, labels["download.error"] ?? "");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = (assetId: string) => {
    startRemoving(async () => {
      try {
        const request = new FormData();
        request.set("locale", locale);
        request.set("entryId", entryId);
        request.set("assetId", assetId);
        await removeArticleDownload(request);
        toast.success(labels["download.removed"]);
      } catch (error) {
        showActionError(error, labels["download.removeError"] ?? "");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button type="button" variant="outline" size="sm" />}
      >
        <FilePlus2 aria-hidden />
        {labels["download.add"]}
        {downloads.length > 0 ? (
          <span className="border-line bg-subtle rounded-full border px-1.5 text-xs font-medium">
            {downloads.length}
          </span>
        ) : null}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{labels["download.heading"]}</DialogTitle>
          <DialogDescription>{labels["download.hint"]}</DialogDescription>
        </DialogHeader>
        <div className="grid min-w-0 content-start gap-3">
          {downloads.length > 0 ? (
            <ul className="grid gap-2">
              {downloads.map((download) => (
                <li
                  key={download.assetId}
                  className="border-line bg-subtle flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <FileText className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">{download.title}</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-danger shrink-0"
                    disabled={removing}
                    onClick={() => {
                      remove(download.assetId);
                    }}
                  >
                    {removing ? (
                      <LoaderCircle className="animate-spin" aria-hidden />
                    ) : (
                      <Trash2 aria-hidden />
                    )}
                    {labels["download.remove"]}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-copy-muted text-sm">
              {labels["download.empty"]}
            </p>
          )}
          <Field>
            <FieldLabel htmlFor="article-download-title">
              {labels["download.title"]}
            </FieldLabel>
            <Input
              id="article-download-title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
              }}
              maxLength={200}
            />
          </Field>
          <label className="border-line bg-subtle flex items-start gap-3 rounded-lg border p-3 text-sm">
            <Checkbox
              className="mt-0.5 shrink-0"
              checked={rightsConfirmed}
              onCheckedChange={setRightsConfirmed}
            />
            <span>{labels["download.rights"]}</span>
          </label>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(event) => void upload(event.target.files?.[0])}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy || !rightsConfirmed || title.trim().length < 2}
              onClick={() => inputRef.current?.click()}
            >
              <Upload aria-hidden />
              {labels["download.add"]}
            </Button>
            <span className="text-copy-muted text-xs">
              {busy
                ? labels["download.uploading"]
                : labels["download.constraints"]}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
