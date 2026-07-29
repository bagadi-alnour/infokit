"use client";

import { FileImage, LoaderCircle, X } from "lucide-react";
import { useRef, useState } from "react";

import {
  isPermissionDeniedError,
  useActionErrorToast,
} from "~/components/admin/admin-ui-provider";
import {
  CoverImagePreview,
  useCoverImagePreview,
} from "~/components/admin/cover-image-preview";
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
import { Checkbox } from "~/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import type { EditorialLanguage } from "~/lib/editorial-languages";
import { readLabel, type Labels } from "~/lib/form-messages";
import {
  compressImageForUpload,
  isImageTooLargeError,
} from "~/lib/image-compression";

/**
 * The cover image, uploaded before the form is saved.
 *
 * The image cannot travel with the post: it goes straight to object storage
 * through a signed URL, and only the asset id it produces is posted with the
 * rest of the form. That makes this its own little state machine — describe the
 * image, confirm the rights, upload, then keep or replace it — which the create
 * forms used to carry a copy of each.
 *
 * It stays outside React Hook Form on purpose: the id is a result the editor
 * cannot type and the form cannot validate, so this owns it and posts it through
 * the hidden input below, the same way the translation workspace posts its text.
 * Alt text and the rights confirmation belong to the *upload*, not to the
 * content, and are never posted with the form.
 */

/** What the signed-upload actions return — the same shape for every kind. */
export type CoverImageUploadAction = (
  formData: FormData,
) => Promise<{ assetId: string; uploadUrl: string }>;

export type CoverImageLabels = {
  alt: string;
  altHint: string;
  /** The sentence the editor confirms before an image may be chosen. */
  rights: string;
  select: string;
  replace: string;
  remove: string;
  uploading: string;
  /** Carries `{name}`, replaced by the chosen file's name. */
  uploaded: string;
  error: string;
  /** The file types and the size limit, shown before anything is chosen. */
  constraints: string;
};

/**
 * Read the ten entries from a catalog that groups them under one prefix.
 *
 * The article console keys them `image.*` and the activity console
 * `activity.create.image.*`; the field itself should not have to know which.
 */
export function coverImageLabels(
  labels: Labels,
  prefix: string,
): CoverImageLabels {
  const entry = (key: string) => readLabel(labels, `${prefix}.${key}`);
  return {
    alt: entry("alt"),
    altHint: entry("altHint"),
    rights: entry("rights"),
    select: entry("select"),
    replace: entry("replace"),
    remove: entry("remove"),
    uploading: entry("uploading"),
    uploaded: entry("uploaded"),
    error: entry("error"),
    constraints: entry("constraints"),
  };
}

/** How far the upload has got, which is also the attachment's own vocabulary. */
type UploadPhase = "idle" | "uploading" | "done" | "error";

export function CoverImageField({
  locale,
  sourceLanguage,
  createUpload,
  labels,
  name = "coverAssetId",
  idPrefix = "cover",
  onAltTextChange,
}: {
  locale: string;
  /** The language the alt text is written in, stored with the asset. */
  sourceLanguage: EditorialLanguage;
  createUpload: CoverImageUploadAction;
  labels: CoverImageLabels;
  /** The `FormData` key the uploaded asset id is posted under. */
  name?: string;
  /** Distinguishes this field's control ids from another on the same page. */
  idPrefix?: string;
  /** For a form that shows the alt text elsewhere, such as a translation rail. */
  onAltTextChange?: (next: string) => void;
}) {
  const [assetId, setAssetId] = useState("");
  const [fileName, setFileName] = useState("");
  const [altText, setAltText] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showActionError = useActionErrorToast();
  const { previewSrc, showFile, clearPreview } = useCoverImagePreview();

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setPhase("uploading");
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
      const created = await createUpload(request);
      const response = await fetch(created.uploadUrl, {
        method: "PUT",
        body: image,
        headers: { "Content-Type": image.type },
      });
      if (!response.ok) throw new Error("Upload failed");
      setAssetId(created.assetId);
      showFile(image);
      setPhase("done");
    } catch (error) {
      setAssetId("");
      // A refused permission is not a broken upload: the editor may not attach
      // images here at all, which the toast explains.
      setPhase(isPermissionDeniedError(error) ? "idle" : "error");
      // The size rule is already written under the field; as a toast it says
      // exactly which rule the chosen file broke.
      showActionError(
        error,
        isImageTooLargeError(error) ? labels.constraints : labels.error,
      );
    }
  };

  const clear = () => {
    setAssetId("");
    setFileName("");
    setPhase("idle");
    clearPreview();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const choose = () => {
    const input = fileInputRef.current;
    if (!input) return;
    // Cleared first, so picking the same file again still fires `change`.
    input.value = "";
    input.click();
  };

  // An image nobody described cannot be published, and one whose rights are
  // unconfirmed may not be stored, so both come before choosing a file.
  const ready =
    altText.trim().length > 0 && rightsConfirmed && phase !== "uploading";
  const status =
    phase === "uploading"
      ? labels.uploading
      : phase === "done"
        ? labels.uploaded.replace("{name}", fileName)
        : phase === "error"
          ? labels.error
          : labels.constraints;

  return (
    <>
      <input type="hidden" name={name} value={assetId} />
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-alt`}>{labels.alt}</FieldLabel>
        <Input
          id={`${idPrefix}-alt`}
          value={altText}
          onChange={(event) => {
            setAltText(event.target.value);
            onAltTextChange?.(event.target.value);
          }}
          maxLength={500}
        />
        <FieldDescription>{labels.altHint}</FieldDescription>
      </Field>
      <Field orientation="horizontal" className="items-start gap-3">
        <Checkbox
          id={`${idPrefix}-rights`}
          checked={rightsConfirmed}
          onCheckedChange={setRightsConfirmed}
          className="mt-0.5"
        />
        <FieldLabel
          htmlFor={`${idPrefix}-rights`}
          className="text-sm font-normal leading-normal"
        >
          {labels.rights}
        </FieldLabel>
      </Field>
      <input
        ref={fileInputRef}
        id={`${idPrefix}-file`}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        disabled={!ready}
        onChange={(event) => void upload(event.target.files?.[0])}
      />
      <Attachment state={phase} className="w-full">
        <AttachmentMedia>
          {phase === "uploading" ? (
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
          <AttachmentTitle>{fileName || labels.select}</AttachmentTitle>
          <AttachmentDescription role={phase === "error" ? "alert" : undefined}>
            {status}
          </AttachmentDescription>
        </AttachmentContent>
        {fileName && phase !== "uploading" ? (
          <AttachmentActions>
            <AttachmentAction
              type="button"
              aria-label={labels.remove}
              onClick={clear}
            >
              <X aria-hidden />
            </AttachmentAction>
          </AttachmentActions>
        ) : null}
        <AttachmentTrigger
          aria-label={fileName ? labels.replace : labels.select}
          disabled={!ready}
          onClick={choose}
        />
      </Attachment>
      {previewSrc ? (
        <CoverImagePreview src={previewSrc} alt={altText || fileName} />
      ) : null}
    </>
  );
}
