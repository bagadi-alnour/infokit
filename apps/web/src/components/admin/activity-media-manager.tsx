"use client";

import { FileText, ImageUp, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import {
  addActivityDownload,
  createActivityDocumentUpload,
  createActivityImageUpload,
  removeActivityCoverImage,
  removeActivityDownload,
  setActivityCoverImage,
} from "~/app/[locale]/dashboard/activities/image-actions";
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

type MediaLabels = {
  coverHeading: string;
  coverHint: string;
  coverAttached: string;
  altLabel: string;
  rights: string;
  select: string;
  replace: string;
  remove: string;
  uploading: string;
  uploadError: string;
  coverSaved: string;
  coverRemoved: string;
  downloadsHeading: string;
  downloadsHint: string;
  downloadsEmpty: string;
  downloadTitle: string;
  addDownload: string;
  downloadAdded: string;
  downloadRemoved: string;
  removeError: string;
  constraints: string;
};

export function ActivityMediaManager({
  locale,
  activityId,
  sourceLanguage,
  cover,
  downloads,
  labels,
}: {
  locale: string;
  activityId: string;
  sourceLanguage: EditorialLanguage;
  cover: { assetId: string; previewUrl: string; altText: string } | null;
  downloads: { id: string; title: string }[];
  labels: MediaLabels;
}) {
  const showActionError = useActionErrorToast();
  const [busy, setBusy] = useState(false);
  const [coverAlt, setCoverAlt] = useState("");
  const [coverRights, setCoverRights] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docRights, setDocRights] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const { previewSrc, showFile, clearPreview } = useCoverImagePreview(
    cover?.previewUrl ?? null,
  );

  const uploadCover = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const request = new FormData();
      request.set("locale", locale);
      request.set("mimeType", file.type);
      request.set("byteSize", String(file.size));
      request.set("languageCode", sourceLanguage);
      request.set("altText", coverAlt || file.name);
      request.set("rightsConfirmed", coverRights ? "true" : "false");
      const upload = await createActivityImageUpload(request);
      const response = await fetch(upload.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!response.ok) throw new Error("Upload failed");
      const attach = new FormData();
      attach.set("locale", locale);
      attach.set("activityId", activityId);
      attach.set("assetId", upload.assetId);
      await setActivityCoverImage(attach);
      showFile(file);
      toast.success(labels.coverSaved);
      setCoverAlt("");
      setCoverRights(false);
    } catch (error) {
      showActionError(error, labels.uploadError);
    } finally {
      setBusy(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const uploadDocument = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const request = new FormData();
      request.set("locale", locale);
      request.set("byteSize", String(file.size));
      request.set("languageCode", sourceLanguage);
      request.set("rightsConfirmed", docRights ? "true" : "false");
      const upload = await createActivityDocumentUpload(request);
      const response = await fetch(upload.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/pdf" },
      });
      if (!response.ok) throw new Error("Upload failed");
      const attach = new FormData();
      attach.set("locale", locale);
      attach.set("activityId", activityId);
      attach.set("assetId", upload.assetId);
      attach.set("languageCode", sourceLanguage);
      attach.set("title", docTitle || file.name);
      await addActivityDownload(attach);
      toast.success(labels.downloadAdded);
      setDocTitle("");
      setDocRights(false);
    } catch (error) {
      showActionError(error, labels.uploadError);
    } finally {
      setBusy(false);
      if (docInputRef.current) docInputRef.current.value = "";
    }
  };

  const removeCover = async (formData: FormData) => {
    try {
      await removeActivityCoverImage(formData);
      clearPreview();
      toast.success(labels.coverRemoved);
    } catch (error) {
      showActionError(error, labels.removeError);
    }
  };
  const removeDownload = async (formData: FormData) => {
    try {
      await removeActivityDownload(formData);
      toast.success(labels.downloadRemoved);
    } catch (error) {
      showActionError(error, labels.removeError);
    }
  };
  const previewAlt = coverAlt.trim()
    ? coverAlt
    : (cover?.altText ?? labels.coverAttached);

  return (
    <div className="grid gap-6">
      {/* Cover image */}
      <section className="grid gap-3">
        <div>
          <h3 className="text-sm font-semibold">{labels.coverHeading}</h3>
          <p className="text-copy-muted mt-0.5 text-xs">{labels.coverHint}</p>
        </div>
        {previewSrc ? (
          <CoverImagePreview src={previewSrc} alt={previewAlt} />
        ) : null}
        {cover ? (
          <div className="border-line bg-subtle flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
            <span className="inline-flex items-center gap-2">
              <ImageUp className="size-4" aria-hidden />
              {labels.coverAttached}
            </span>
            <form action={removeCover}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="activityId" value={activityId} />
              <PendingButton variant="ghost" className="text-danger">
                <Trash2 aria-hidden />
                {labels.remove}
              </PendingButton>
            </form>
          </div>
        ) : null}
        <div className="grid gap-3">
          <Field>
            <FieldLabel htmlFor="activity-cover-alt">
              {labels.altLabel}
            </FieldLabel>
            <Input
              id="activity-cover-alt"
              value={coverAlt}
              onChange={(event) => {
                setCoverAlt(event.target.value);
              }}
              maxLength={500}
            />
          </Field>
          <label className="border-line bg-subtle flex items-start gap-3 self-end rounded-lg border p-3 text-sm">
            <Checkbox
              className="mt-0.5 shrink-0"
              checked={coverRights}
              onCheckedChange={(value) => {
                setCoverRights(value);
              }}
            />
            <span>{labels.rights}</span>
          </label>
        </div>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          onChange={(event) => {
            void uploadCover(event.target.files?.[0]);
          }}
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy || !coverRights}
            onClick={() => coverInputRef.current?.click()}
          >
            <Upload aria-hidden />
            {cover ? labels.replace : labels.select}
          </Button>
          <span className="text-copy-muted text-xs">
            {busy ? labels.uploading : labels.constraints}
          </span>
        </div>
      </section>

      {/* Downloadable PDFs */}
      <section className="grid gap-3">
        <div>
          <h3 className="text-sm font-semibold">{labels.downloadsHeading}</h3>
          <p className="text-copy-muted mt-0.5 text-xs">
            {labels.downloadsHint}
          </p>
        </div>
        {downloads.length > 0 ? (
          <ul className="grid gap-2">
            {downloads.map((download) => (
              <li
                key={download.id}
                className="border-line bg-subtle flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <FileText className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{download.title}</span>
                </span>
                <form action={removeDownload}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="activityId" value={activityId} />
                  <input type="hidden" name="downloadId" value={download.id} />
                  <PendingButton variant="ghost" className="text-danger">
                    <Trash2 aria-hidden />
                    {labels.remove}
                  </PendingButton>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-copy-muted text-sm">{labels.downloadsEmpty}</p>
        )}
        <div className="grid gap-3">
          <Field>
            <FieldLabel htmlFor="activity-download-title">
              {labels.downloadTitle}
            </FieldLabel>
            <Input
              id="activity-download-title"
              value={docTitle}
              onChange={(event) => {
                setDocTitle(event.target.value);
              }}
              maxLength={200}
            />
          </Field>
          <label className="border-line bg-subtle flex items-start gap-3 self-end rounded-lg border p-3 text-sm">
            <Checkbox
              className="mt-0.5 shrink-0"
              checked={docRights}
              onCheckedChange={(value) => {
                setDocRights(value);
              }}
            />
            <span>{labels.rights}</span>
          </label>
        </div>
        <input
          ref={docInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(event) => {
            void uploadDocument(event.target.files?.[0]);
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="justify-self-start"
          disabled={busy || !docRights || docTitle.trim().length < 2}
          onClick={() => docInputRef.current?.click()}
        >
          <Upload aria-hidden />
          {labels.addDownload}
        </Button>
      </section>
    </div>
  );
}
