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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import type { EditorialLanguage } from "~/lib/editorial-languages";
import {
  compressImageForUpload,
  isImageTooLargeError,
} from "~/lib/image-compression";

/**
 * An activity's files, in two managers rather than one.
 *
 * The photo and the PDFs are unrelated decisions — one is how the activity looks
 * on a card, the other is paperwork a visitor takes away — and they get very
 * different amounts of room: the photo panel is the picture, and the documents
 * are one small button at its top corner opening a dialog. Most activities have
 * no PDF at all, and the ones that do are edited rarely.
 *
 * Neither posts a form of its own, because both render inside the activity's
 * editor form and a form cannot contain another. The dialog's own controls are
 * portalled out of that form, but they are still buttons and inputs rather than
 * a form, so a stray Enter cannot submit the record.
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
  /** The button at the photo panel's corner, and the dialog it opens. */
  downloadsAction: string;
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
      // Re-encoded before anything is signed: the upload URL is bound to the
      // exact type and length declared here, so the size sent to the action has
      // to be the size that is about to be PUT.
      const image = await compressImageForUpload(file);
      const request = new FormData();
      request.set("locale", locale);
      request.set("mimeType", image.type);
      request.set("byteSize", String(image.size));
      request.set("languageCode", sourceLanguage);
      request.set("altText", coverAlt || file.name);
      request.set("rightsConfirmed", coverRights ? "true" : "false");
      const upload = await createActivityImageUpload(request);
      const response = await fetch(upload.uploadUrl, {
        method: "PUT",
        body: image,
        headers: { "Content-Type": image.type },
      });
      if (!response.ok) throw new Error("Upload failed");
      const attach = new FormData();
      attach.set("locale", locale);
      attach.set("activityId", activityId);
      attach.set("assetId", upload.assetId);
      await setActivityCoverImage(attach);
      showFile(image);
      toast.success(labels.coverSaved);
      setCoverAlt("");
      setCoverRights(false);
    } catch (error) {
      // The size rule is already written under the field; as a toast it says
      // exactly which rule the chosen file broke.
      showActionError(
        error,
        isImageTooLargeError(error) ? labels.constraints : labels.uploadError,
      );
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
 * The downloadable PDFs, behind one small button at the photo panel's top
 * corner. Everything about them — what is attached, taking one down, adding
 * another — happens in the dialog it opens, so the panel itself stays a picture.
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
  const [open, setOpen] = useState(false);
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
      // The document is attached and the panel's count is about to say so;
      // leaving the dialog open would invite a second upload of the same file.
      setOpen(false);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button type="button" variant="outline" size="sm" />}
      >
        <FilePlus2 aria-hidden />
        {labels.downloadsAction}
        {/* The count is the only thing the closed panel says about documents,
         * so an activity with a flyer never looks like one without. */}
        {downloads.length > 0 ? (
          <span className="border-line bg-subtle rounded-full border px-1.5 text-xs font-medium">
            {downloads.length}
          </span>
        ) : null}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{labels.downloadsHeading}</DialogTitle>
          <DialogDescription>{labels.downloadsHint}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
