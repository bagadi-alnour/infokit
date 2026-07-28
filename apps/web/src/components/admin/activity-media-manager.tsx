"use client";

import { FileText, ImageUp, LoaderCircle, Trash2, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
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
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import type { EditorialLanguage } from "~/lib/editorial-languages";

/**
 * An activity's files, in two managers rather than one.
 *
 * The photo and the PDFs are unrelated decisions — one is how the activity
 * looks on a card, the other is paperwork a visitor takes away — and the editor
 * lays them out in different places: the photo under the text it illustrates,
 * the documents beside the tags. Neither posts a form of its own, because both
 * render inside the activity's editor form and a form cannot contain another.
 */

type CoverLabels = {
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
  removeError: string;
  constraints: string;
};

type DownloadsLabels = {
  downloadsHeading: string;
  downloadsHint: string;
  downloadsEmpty: string;
  downloadTitle: string;
  rights: string;
  addDownload: string;
  remove: string;
  uploading: string;
  uploadError: string;
  downloadAdded: string;
  downloadRemoved: string;
  removeError: string;
  downloadConstraints: string;
};

/** The cover image: attach one, replace it, or take it down. */
export function ActivityCoverManager({
  locale,
  activityId,
  sourceLanguage,
  cover,
  labels,
}: {
  locale: string;
  activityId: string;
  sourceLanguage: EditorialLanguage;
  cover: { assetId: string; previewUrl: string; altText: string } | null;
  labels: CoverLabels;
}) {
  const showActionError = useActionErrorToast();
  const [busy, setBusy] = useState(false);
  const [removing, startRemoving] = useTransition();
  const [coverAlt, setCoverAlt] = useState("");
  const [coverRights, setCoverRights] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
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

  const removeCover = () => {
    startRemoving(async () => {
      try {
        const request = new FormData();
        request.set("locale", locale);
        request.set("activityId", activityId);
        await removeActivityCoverImage(request);
        clearPreview();
        toast.success(labels.coverRemoved);
      } catch (error) {
        showActionError(error, labels.removeError);
      }
    });
  };

  const previewAlt = coverAlt.trim()
    ? coverAlt
    : (cover?.altText ?? labels.coverAttached);

  return (
    // The picture beside its own fields once there is room: a preview reads as
    // a picture, not as a form control, and stacking the two wastes the width.
    <div className="@container">
      <div className="@2xl:grid-cols-2 grid min-w-0 items-start gap-4">
        <div className="grid min-w-0 content-start gap-3">
          {previewSrc ? (
            <CoverImagePreview src={previewSrc} alt={previewAlt} />
          ) : null}
          {cover ? (
            <div className="border-line bg-subtle flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <span className="inline-flex items-center gap-2">
                <ImageUp className="size-4" aria-hidden />
                {labels.coverAttached}
              </span>
              <Button
                type="button"
                variant="ghost"
                className="text-danger"
                disabled={removing}
                onClick={removeCover}
              >
                {removing ? (
                  <LoaderCircle className="animate-spin" aria-hidden />
                ) : (
                  <Trash2 aria-hidden />
                )}
                {labels.remove}
              </Button>
            </div>
          ) : null}
        </div>
        <div className="grid min-w-0 content-start gap-3">
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
          <label className="border-line bg-subtle flex items-start gap-3 rounded-lg border p-3 text-sm">
            <Checkbox
              className="mt-0.5 shrink-0"
              checked={coverRights}
              onCheckedChange={(value) => {
                setCoverRights(value);
              }}
            />
            <span>{labels.rights}</span>
          </label>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            onChange={(event) => {
              void uploadCover(event.target.files?.[0]);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
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
        </div>
      </div>
    </div>
  );
}

/**
 * The downloadable PDFs. Sits beside the tags field in the editor, so it is
 * shaped like a field: a label, what is already there, and one way to add.
 */
export function ActivityDownloadsManager({
  locale,
  activityId,
  sourceLanguage,
  downloads,
  labels,
}: {
  locale: string;
  activityId: string;
  sourceLanguage: EditorialLanguage;
  downloads: { id: string; title: string }[];
  labels: DownloadsLabels;
}) {
  const showActionError = useActionErrorToast();
  const [busy, setBusy] = useState(false);
  const [removing, startRemoving] = useTransition();
  const [docTitle, setDocTitle] = useState("");
  const [docRights, setDocRights] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);

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

  const removeDownload = (downloadId: string) => {
    startRemoving(async () => {
      try {
        const request = new FormData();
        request.set("locale", locale);
        request.set("activityId", activityId);
        request.set("downloadId", downloadId);
        await removeActivityDownload(request);
        toast.success(labels.downloadRemoved);
      } catch (error) {
        showActionError(error, labels.removeError);
      }
    });
  };

  return (
    <section className="grid min-w-0 content-start gap-3">
      <div>
        <h3 className="text-sm font-medium">{labels.downloadsHeading}</h3>
        <p className="text-copy-muted mt-0.5 text-xs">{labels.downloadsHint}</p>
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
              <Button
                type="button"
                variant="ghost"
                className="text-danger shrink-0"
                disabled={removing}
                onClick={() => {
                  removeDownload(download.id);
                }}
              >
                {removing ? (
                  <LoaderCircle className="animate-spin" aria-hidden />
                ) : (
                  <Trash2 aria-hidden />
                )}
                {labels.remove}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-copy-muted text-sm">{labels.downloadsEmpty}</p>
      )}
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
      <label className="border-line bg-subtle flex items-start gap-3 rounded-lg border p-3 text-sm">
        <Checkbox
          className="mt-0.5 shrink-0"
          checked={docRights}
          onCheckedChange={(value) => {
            setDocRights(value);
          }}
        />
        <span>{labels.rights}</span>
      </label>
      <input
        ref={docInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(event) => {
          void uploadDocument(event.target.files?.[0]);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy || !docRights || docTitle.trim().length < 2}
          onClick={() => docInputRef.current?.click()}
        >
          <Upload aria-hidden />
          {labels.addDownload}
        </Button>
        <span className="text-copy-muted text-xs">
          {busy ? labels.uploading : labels.downloadConstraints}
        </span>
      </div>
    </section>
  );
}
