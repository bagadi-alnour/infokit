import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "~/env";
import { awsCredentials } from "~/server/aws-credentials";

function configuredEndpoint(): string | undefined {
  const endpoint = env.AWS_S3_ENDPOINT;
  if (!endpoint) return undefined;

  // AWS bucket URLs describe where an object is served; passing one as the
  // SDK endpoint makes the client prepend the bucket a second time. Custom
  // endpoints are retained for S3-compatible local/private storage.
  return new URL(endpoint).hostname.endsWith(".amazonaws.com")
    ? undefined
    : endpoint;
}

const s3 = new S3Client({
  region: env.AWS_REGION,
  endpoint: configuredEndpoint(),
  forcePathStyle: env.AWS_S3_FORCE_PATH_STYLE,
  credentials: awsCredentials(),
});

export async function createAssetUploadUrl(input: {
  storageKey: string;
  mimeType: string;
  byteSize: number;
  assetId: string;
}): Promise<string> {
  if (!env.AWS_S3_ASSET_BUCKET) {
    throw new Error("AWS_S3_ASSET_BUCKET is not configured");
  }
  return getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: env.AWS_S3_ASSET_BUCKET,
      Key: input.storageKey,
      ContentType: input.mimeType,
      ContentLength: input.byteSize,
    }),
    { expiresIn: 10 * 60 },
  );
}

/**
 * Short-lived direct URL for displaying a private workspace asset.
 *
 * Both response overrides below exist to bound what a hostile upload could do
 * once it is in the bucket. The uploader's browser chose the object's own
 * `Content-Type` — it is pinned by the upload signature, but it is still a
 * client-supplied value — and nothing has inspected the bytes behind it
 * (`content.assets.scan_state`, docs/PRODUCT.md §8.1). So the reader is told the
 * type *the database recorded*, not the one the object carries, and anything that
 * is not an image is sent as a download rather than rendered. A file that turns
 * out not to be what it claimed is then a broken image or a saved file, never a
 * document a browser will parse in a browsing context.
 */
export async function createAssetReadUrl(
  storageKey: string,
  options: {
    /**
     * Ask storage to send the file as a download under this name. A flyer saved
     * as an opaque storage key is a file nobody can find again later.
     */
    fileName?: string;
    /** The MIME type recorded on the asset row, pinned onto the response. */
    contentType?: string;
  } = {},
): Promise<string> {
  if (!env.AWS_S3_ASSET_BUCKET) {
    throw new Error("AWS_S3_ASSET_BUCKET is not configured");
  }
  // Only when the type is known: an unrecorded type keeps the old behaviour
  // rather than turning every caller that has not been told into a download.
  const rendersInline = options.contentType?.startsWith("image/") ?? true;
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: env.AWS_S3_ASSET_BUCKET,
      Key: storageKey,
      ResponseContentType: options.contentType,
      ResponseContentDisposition: options.fileName
        ? `attachment; filename="${asciiFileName(options.fileName)}"; filename*=UTF-8''${encodeURIComponent(options.fileName)}`
        : rendersInline
          ? undefined
          : "attachment",
    }),
    { expiresIn: 10 * 60 },
  );
}

/**
 * A quoted-string-safe fallback name for clients that ignore `filename*`.
 * Accents and non-Latin scripts survive in the `filename*` form beside it.
 */
function asciiFileName(name: string): string {
  const ascii = name
    // Header values are single-line: control characters go too, not just accents.
    .replace(/[\u0000-\u001f\u007f-\uffff"\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return ascii === "" ? "download" : ascii;
}

/**
 * Read a stored object into memory.
 *
 * Bounded on purpose. The caller is about to hand these bytes to a decoder, and
 * a stored object is never more trustworthy than the browser that pushed it —
 * the signature pinned a length, but storage is asked for its own answer here
 * before the body is pulled, so an oversized object costs one small response
 * rather than the whole file.
 */
export async function readAssetObject(
  storageKey: string,
  maxBytes: number,
): Promise<Buffer> {
  if (!env.AWS_S3_ASSET_BUCKET) {
    throw new Error("AWS_S3_ASSET_BUCKET is not configured");
  }
  const object = await s3.send(
    new GetObjectCommand({ Bucket: env.AWS_S3_ASSET_BUCKET, Key: storageKey }),
  );
  if (!object.Body) throw new Error("The stored object is empty");
  if ((object.ContentLength ?? maxBytes + 1) > maxBytes) {
    throw new Error("The stored object is larger than the upload limit");
  }
  return Buffer.from(await object.Body.transformToByteArray());
}

/**
 * Store bytes the server produced itself — a rendition, never an upload. No
 * signed URL is involved, so nothing outside the server can write this key.
 */
export async function writeAssetObject(input: {
  storageKey: string;
  mimeType: string;
  body: Uint8Array;
}): Promise<void> {
  if (!env.AWS_S3_ASSET_BUCKET) {
    throw new Error("AWS_S3_ASSET_BUCKET is not configured");
  }
  await s3.send(
    new PutObjectCommand({
      Bucket: env.AWS_S3_ASSET_BUCKET,
      Key: input.storageKey,
      Body: input.body,
      ContentType: input.mimeType,
    }),
  );
}

/** Confirm that a browser upload reached object storage intact. */
export async function verifyAssetUpload(input: {
  storageKey: string;
  mimeType: string;
  byteSize: number;
}): Promise<void> {
  if (!env.AWS_S3_ASSET_BUCKET) {
    throw new Error("AWS_S3_ASSET_BUCKET is not configured");
  }
  const object = await s3.send(
    new HeadObjectCommand({
      Bucket: env.AWS_S3_ASSET_BUCKET,
      Key: input.storageKey,
    }),
  );
  const uploadedType = object.ContentType?.split(";", 1)[0]?.trim();
  if (
    object.ContentLength !== input.byteSize ||
    uploadedType !== input.mimeType
  ) {
    throw new Error("The uploaded file did not match the requested upload");
  }
}
