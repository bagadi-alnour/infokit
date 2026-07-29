import { createHash } from "node:crypto";

import { and, eq } from "drizzle-orm";
import sharp from "sharp";

import {
  readAssetObject,
  verifyAssetUpload,
  writeAssetObject,
} from "~/server/assets/s3";
import { db } from "~/server/db";
import { assetVariants, assets } from "~/server/db/schema";

/**
 * The safety pass an upload has to survive before it counts as `clean`
 * (docs/DATABASE-SCHEMA.md §9, NFR-012).
 *
 * For an image it is a sanitisation, not a detection: the server reads the
 * stored bytes, decodes them, and re-encodes the pixels into a rendition of its
 * own. A file that is not the image it claimed cannot survive that — nor can
 * anything travelling *beside* the image, since EXIF, XMP, colour profiles and
 * whatever was appended after the end marker are simply not carried across. The
 * rendition is then what readers are served, so a visitor never receives bytes a
 * browser chose. That is the whole of the guarantee, and it is worth stating what
 * it is not: it is not signature-based malware detection, and it says nothing
 * about what the picture depicts. The scanning provider is still undecided
 * (docs/PRODUCT.md, Open questions).
 *
 * A document gets none of this — there is no equivalent to re-encoding a PDF —
 * so it stays `pending` and keeps its record off every public surface until a
 * real scanner exists. That is a deliberate refusal, not an oversight: marking a
 * file clean because nothing looked at it would empty the word of meaning
 * everywhere else it is checked.
 */

/** The rendition kind this pass writes; one per asset, replaced on a re-run. */
const RENDITION_KIND = "optimized_image";

/** The longest edge a rendition keeps — larger than any surface displays. */
const renditionEdge = 2400;
const renditionQuality = 82;
const renditionType = "image/webp";

/**
 * A megabyte that decodes to more than this many pixels is a compression bomb,
 * not a photograph: the console's own uploads arrive at 2400px on the long edge
 * (~6 MP), and the decoded surface is what costs the server its memory.
 */
const maxPixels = 32_000_000;

/**
 * How much of a stored file this pass will hold in memory. Deliberately above
 * the console's own one-megabyte upload limit: a file stored before that limit
 * existed is still a legitimate image, and refusing to sanitise it would leave
 * it stuck at `pending` — unable to be cleared and unable to be published.
 */
const maxReadBytes = 8 * 1024 * 1024;

/**
 * What the decoder must report for each accepted type. A mismatch is a file
 * whose declared type is wrong, which is exactly the case worth refusing:
 * libvips reports AVIF as HEIF carrying AV1.
 */
const acceptedFormats: Record<string, readonly string[]> = {
  "image/jpeg": ["jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/avif": ["heif", "avif"],
};

/**
 * The upload is not usable and the editor has to hear so now. Distinct from a
 * storage or database failure, which leaves the asset `pending` to be retried.
 */
export class AssetRejectedError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AssetRejectedError";
  }
}

/**
 * Claim an upload: confirm it reached storage intact, then put it through the
 * pass above. Every attach path calls this, which is why it is one function —
 * a surface that only verified would be publishing unread bytes.
 */
export async function scanUploadedAsset(asset: {
  id: string;
  storageKey: string;
  mimeType: string;
  byteSize: number;
  scanState: string;
}): Promise<void> {
  await verifyAssetUpload(asset);
  if (asset.scanState === "flagged") {
    throw new AssetRejectedError(
      "The uploaded file did not pass the safety pass",
    );
  }
  // Already cleared: re-attaching a cover must not re-encode it a second time.
  if (asset.scanState === "clean") return;
  if (!asset.mimeType.startsWith("image/")) return;
  await sanitizeImage(asset);
}

/**
 * The rendition to serve in place of an uploaded image, when the pass has
 * produced one. Null for an asset from before this existed, or for a document —
 * both then fall back to the stored original, so no reader loses a file that was
 * already published.
 */
export async function sanitizedImageRendition(
  assetId: string,
): Promise<{ storageKey: string; mimeType: string } | null> {
  const [variant] = await db
    .select({
      storageKey: assetVariants.storageKey,
      mimeType: assetVariants.mimeType,
    })
    .from(assetVariants)
    .where(
      and(
        eq(assetVariants.assetId, assetId),
        eq(assetVariants.kind, RENDITION_KIND),
      ),
    )
    .limit(1);
  return variant ?? null;
}

async function sanitizeImage(asset: {
  id: string;
  storageKey: string;
  mimeType: string;
}): Promise<void> {
  const original = await readAssetObject(asset.storageKey, maxReadBytes);
  let rendition: Awaited<ReturnType<typeof reencode>>;
  try {
    rendition = await reencode(original, asset.mimeType);
  } catch (cause) {
    /**
     * The decoder refused, so the file is not what it said it was. Recorded
     * rather than only thrown: the object stays in the bucket until the cleanup
     * job reaches it, and `flagged` is what keeps every surface from offering it
     * in the meantime.
     */
    await db
      .update(assets)
      .set({ scanState: "flagged" })
      .where(eq(assets.id, asset.id));
    throw new AssetRejectedError("The uploaded image could not be read", {
      cause,
    });
  }

  // The object first: a recorded rendition must always be one that exists.
  const storageKey = `uploads/renditions/${asset.id}/optimized.webp`;
  await writeAssetObject({
    storageKey,
    mimeType: renditionType,
    body: rendition.body,
  });

  const variant = {
    assetId: asset.id,
    kind: RENDITION_KIND,
    storageKey,
    mimeType: renditionType,
    byteSize: rendition.body.byteLength,
    width: rendition.width,
    height: rendition.height,
    sha256: sha256(rendition.body),
  } as const;
  await db.transaction(async (tx) => {
    await tx
      .insert(assetVariants)
      .values(variant)
      .onConflictDoUpdate({
        target: [assetVariants.assetId, assetVariants.kind],
        set: {
          storageKey: variant.storageKey,
          mimeType: variant.mimeType,
          byteSize: variant.byteSize,
          width: variant.width,
          height: variant.height,
          sha256: variant.sha256,
        },
      });
    await tx
      .update(assets)
      // The original's hash, recorded while its bytes are in hand: afterwards
      // the row says which file was cleared, not merely that one was.
      .set({ scanState: "clean", sha256: sha256(original) })
      .where(eq(assets.id, asset.id));
  });
}

async function reencode(
  body: Buffer,
  declaredType: string,
): Promise<{ body: Buffer; width: number; height: number }> {
  const expected = acceptedFormats[declaredType];
  if (!expected) throw new Error(`Unsupported image type: ${declaredType}`);
  const image = sharp(body, { limitInputPixels: maxPixels });
  const { format } = await image.metadata();
  // Unreadable bytes never reach here: the decoder throws while reading them.
  if (!expected.includes(format)) {
    throw new Error(`Declared ${declaredType}, decoded as ${format}`);
  }
  const encoded = await image
    // Orientation is applied here because it is about to be thrown away with
    // the rest of the metadata; without this a phone photo arrives sideways.
    .rotate()
    .resize({
      width: renditionEdge,
      height: renditionEdge,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: renditionQuality })
    .toBuffer({ resolveWithObject: true });
  return {
    body: encoded.data,
    width: encoded.info.width,
    height: encoded.info.height,
  };
}

function sha256(body: Buffer): string {
  return createHash("sha256").update(body).digest("hex");
}
