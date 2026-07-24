import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { fromIni } from "@aws-sdk/credential-providers";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "~/env";

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
  credentials:
    env.NODE_ENV === "development"
      ? fromIni({ profile: env.AWS_PROFILE })
      : undefined,
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

/** Short-lived direct URL for displaying a private workspace asset. */
export async function createAssetReadUrl(storageKey: string): Promise<string> {
  if (!env.AWS_S3_ASSET_BUCKET) {
    throw new Error("AWS_S3_ASSET_BUCKET is not configured");
  }
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: env.AWS_S3_ASSET_BUCKET,
      Key: storageKey,
    }),
    { expiresIn: 10 * 60 },
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
