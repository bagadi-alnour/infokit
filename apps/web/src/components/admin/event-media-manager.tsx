"use client";

import { Download, FileText, ImageUp, ShieldAlert, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import {
  addEventFlyer,
  createEventFlyerUpload,
  createEventImageUpload,
  removeEventCoverImage,
  removeEventFlyer,
  setEventCoverImage,
} from "~/app/[locale]/dashboard/events/media-actions";
import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import {
  CoverImagePreview,
  useCoverImagePreview,
} from "~/components/admin/cover-image-preview";
import { Button, Field, TextInput } from "~/components/admin/workspace";
import { PendingButton } from "~/components/pending-button";
import { Checkbox } from "~/components/ui/checkbox";
import type { EventLanguage } from "~/lib/event-languages";
import {
  compressImageForUpload,
  isImageTooLargeError,
} from "~/lib/image-compression";
import type {
  WorkspaceEventCover,
  WorkspaceEventFlyer,
} from "~/server/content/event-media";

export type EventMediaLabels = {
  coverHeading: string;
  coverHint: string;
  coverAttached: string;
  altLabel: string;
  altHint: string;
  rights: string;
  select: string;
  replace: string;
  remove: string;
  uploading: string;
  uploadError: string;
  coverSaved: string;
  coverRemoved: string;
  flyersHeading: string;
  flyersHint: string;
  flyersEmpty: string;
  flyerTitle: string;
  flyerTitleHint: string;
  addFlyer: string;
  flyerAdded: string;
  flyerRemoved: string;
  removeError: string;
  constraints: string;
  /** Shown while the safety scan has not finished — the file is not public yet. */
  pendingScan: string;
  download: string;
};

/**
 * The event's cover image and its printable flyers.
 *
 * A flyer is what someone pins to a wall or hands to a person without a phone,
 * so it is a first-class part of announcing an event rather than an attachment
 * hidden behind the description. The file goes straight to storage from the
 * browser through a signed URL; this component only ever holds the metadata.
 *
 * Nothing here decides who may read the file: the event's own reach does. What
 * is shown is the one thing an editor cannot infer — whether the safety scan
 * has cleared it for readers yet.
 */
export function EventMediaManager({
  locale,
  eventId,
  sourceLanguage,
  cover,
  flyers,
  labels,
}: {
  locale: string;
  eventId: string;
  sourceLanguage: EventLanguage;
  cover: WorkspaceEventCover | null;
  flyers: readonly WorkspaceEventFlyer[];
  labels: EventMediaLabels;
}) {
  const showActionError = useActionErrorToast();
  const [busy, setBusy] = useState(false);
  const [coverAlt, setCoverAlt] = useState("");
  const [coverRights, setCoverRights] = useState(false);
  const [flyerName, setFlyerName] = useState("");
  const [flyerRights, setFlyerRights] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const flyerInputRef = useRef<HTMLInputElement>(null);
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
      request.set("eventId", eventId);
      request.set("mimeType", image.type);
      request.set("byteSize", String(image.size));
      request.set("languageCode", sourceLanguage);
      request.set("altText", coverAlt || file.name);
      request.set("rightsConfirmed", coverRights ? "true" : "false");
      const upload = await createEventImageUpload(request);
      const response = await fetch(upload.uploadUrl, {
        method: "PUT",
        body: image,
        headers: { "Content-Type": image.type },
      });
      if (!response.ok) throw new Error("Upload failed");
      const attach = new FormData();
      attach.set("locale", locale);
      attach.set("eventId", eventId);
      attach.set("assetId", upload.assetId);
      await setEventCoverImage(attach);
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

  const uploadFlyer = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const request = new FormData();
      request.set("locale", locale);
      request.set("eventId", eventId);
      request.set("byteSize", String(file.size));
      request.set("languageCode", sourceLanguage);
      request.set("rightsConfirmed", flyerRights ? "true" : "false");
      const upload = await createEventFlyerUpload(request);
      const response = await fetch(upload.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/pdf" },
      });
      if (!response.ok) throw new Error("Upload failed");
      const attach = new FormData();
      attach.set("locale", locale);
      attach.set("eventId", eventId);
      attach.set("assetId", upload.assetId);
      attach.set("languageCode", sourceLanguage);
      attach.set("title", flyerName || file.name);
      await addEventFlyer(attach);
      toast.success(labels.flyerAdded);
      setFlyerName("");
      setFlyerRights(false);
    } catch (error) {
      showActionError(error, labels.uploadError);
    } finally {
      setBusy(false);
      if (flyerInputRef.current) flyerInputRef.current.value = "";
    }
  };

  const removeCover = async (formData: FormData) => {
    try {
      await removeEventCoverImage(formData);
      clearPreview();
      toast.success(labels.coverRemoved);
    } catch (error) {
      showActionError(error, labels.removeError);
    }
  };
  const dropFlyer = async (formData: FormData) => {
    try {
      await removeEventFlyer(formData);
      toast.success(labels.flyerRemoved);
    } catch (error) {
      showActionError(error, labels.removeError);
    }
  };

  const previewAlt = coverAlt.trim()
    ? coverAlt
    : (cover?.altText ?? labels.coverAttached);

  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <div>
          <h3 className="text-sm font-semibold">{labels.coverHeading}</h3>
          <p className="text-copy-muted mt-0.5 text-xs">{labels.coverHint}</p>
        </div>
        {previewSrc ? (
          <CoverImagePreview src={previewSrc} alt={previewAlt} />
        ) : null}
        {cover ? (
          <div className="border-line bg-subtle grid gap-2 rounded-lg border px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2">
                <ImageUp className="size-4" aria-hidden />
                {labels.coverAttached}
              </span>
              <form action={removeCover}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="eventId" value={eventId} />
                <PendingButton variant="ghost" className="text-danger">
                  {labels.remove}
                </PendingButton>
              </form>
            </div>
            {cover.scanState === "clean" ? null : (
              <PendingScanNotice label={labels.pendingScan} />
            )}
          </div>
        ) : null}
        <div className="grid gap-3">
          <Field label={labels.altLabel} hint={labels.altHint}>
            <TextInput
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
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={busy || !coverRights}
            onClick={() => coverInputRef.current?.click()}
          >
            <Upload className="size-4" aria-hidden />
            {cover ? labels.replace : labels.select}
          </Button>
          <span className="text-copy-muted text-xs">
            {busy ? labels.uploading : labels.constraints}
          </span>
        </div>
      </section>

      <section className="grid gap-3">
        <div>
          <h3 className="text-sm font-semibold">{labels.flyersHeading}</h3>
          <p className="text-copy-muted mt-0.5 text-xs">{labels.flyersHint}</p>
        </div>
        {flyers.length > 0 ? (
          <ul className="grid gap-2">
            {flyers.map((flyer) => (
              <li
                key={flyer.assetId}
                className="border-line bg-subtle grid gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <FileText className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">{flyer.title}</span>
                    <span className="text-copy-muted shrink-0 text-xs uppercase">
                      {flyer.languageCode ?? ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {flyer.downloadUrl ? (
                      <a
                        href={flyer.downloadUrl}
                        className="text-copy-muted hover:text-ink inline-flex items-center gap-1 rounded-md px-2 py-1"
                      >
                        <Download className="size-4" aria-hidden />
                        {labels.download}
                      </a>
                    ) : null}
                    <form action={dropFlyer}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="eventId" value={eventId} />
                      <input
                        type="hidden"
                        name="assetId"
                        value={flyer.assetId}
                      />
                      <PendingButton variant="ghost" className="text-danger">
                        {labels.remove}
                      </PendingButton>
                    </form>
                  </span>
                </div>
                {flyer.scanState === "clean" ? null : (
                  <PendingScanNotice label={labels.pendingScan} />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-copy-muted text-sm">{labels.flyersEmpty}</p>
        )}
        <div className="grid gap-3">
          <Field label={labels.flyerTitle} hint={labels.flyerTitleHint}>
            <TextInput
              value={flyerName}
              onChange={(event) => {
                setFlyerName(event.target.value);
              }}
              maxLength={200}
            />
          </Field>
          <label className="border-line bg-subtle flex items-start gap-3 rounded-lg border p-3 text-sm">
            <Checkbox
              className="mt-0.5 shrink-0"
              checked={flyerRights}
              onCheckedChange={(value) => {
                setFlyerRights(value);
              }}
            />
            <span>{labels.rights}</span>
          </label>
        </div>
        <input
          ref={flyerInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(event) => {
            void uploadFlyer(event.target.files?.[0]);
          }}
        />
        <div>
          <Button
            type="button"
            variant="secondary"
            disabled={busy || !flyerRights || flyerName.trim().length < 2}
            onClick={() => flyerInputRef.current?.click()}
          >
            <Upload className="size-4" aria-hidden />
            {labels.addFlyer}
          </Button>
        </div>
      </section>
    </div>
  );
}

/**
 * Why an uploaded file is not on the public page yet. Without this the editor
 * would reasonably assume the upload failed and try again.
 */
function PendingScanNotice({ label }: { label: string }) {
  return (
    <p className="text-copy-muted inline-flex items-start gap-2 text-xs">
      <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {label}
    </p>
  );
}
