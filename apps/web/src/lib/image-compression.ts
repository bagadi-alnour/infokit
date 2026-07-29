/**
 * Re-encoding a cover image in the browser, before it is handed to storage.
 *
 * The reason is bandwidth on the reading end. An editor attaches whatever the
 * camera or the phone produced, and a six-megabyte photograph is the same cover
 * image as a three-hundred-kilobyte one to every reader who then loads the page
 * on a prepaid connection. Re-encoding also discards everything in the file that
 * is not pixel data — EXIF, XMP, colour profiles, and anything appended after
 * the image's own end marker — which is worth having on its own.
 *
 * It is *not* the safety scan, and nothing here may be read as satisfying it.
 * This code runs on the editor's own machine, and the signed upload URL is a
 * write credential the browser holds: whatever bytes are PUT to it are the bytes
 * that land in the bucket, compressed by this module or not.
 * `content.assets.scan_state` is untouched (docs/PRODUCT.md §8.1).
 */

/**
 * What a cover image may weigh once it is stored. One megabyte is the number the
 * console states to the editor, so it is the number enforced here and again in
 * the upload action that signs the URL — a limit only the browser knows is not a
 * limit at all.
 */
export const maxUploadBytes = 1024 * 1024;

/**
 * What to try, in order, until one result fits inside the megabyte. Quality is
 * spent only as far as the limit requires: a modest photograph is kept at the
 * first rung, and only an image that will not fit walks down the ladder.
 */
const attempts = [
  { edge: 2400, quality: 0.82 },
  { edge: 2000, quality: 0.72 },
  { edge: 1600, quality: 0.62 },
  { edge: 1200, quality: 0.5 },
];

/**
 * A ceiling on what is worth copying into a canvas — four bytes a pixel, on top
 * of a decode that has already happened. Past this an image built to be exactly
 * this expensive is left alone, and the size limit below refuses it.
 */
const maxPixels = 80_000_000;
const outputType = "image/webp";

type Dimensions = { width: number; height: number };

/** Thrown when no re-encoding brings the file under {@link maxUploadBytes}. */
export class ImageTooLargeError extends Error {
  constructor() {
    super("The image is larger than the upload limit");
    this.name = "ImageTooLargeError";
  }
}

export function isImageTooLargeError(error: unknown): boolean {
  return error instanceof ImageTooLargeError;
}

/** The size to draw at, preserving the aspect ratio and never scaling up. */
export function scaledDimensions(
  width: number,
  height: number,
  edge: number,
): Dimensions {
  const longest = Math.max(width, height);
  if (longest <= edge || longest === 0) return { width, height };
  const ratio = edge / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/**
 * The file to upload for a file the editor chose.
 *
 * Throws {@link ImageTooLargeError} when nothing this can do brings the file
 * under the limit — an image far past what a cover needs to be, or a browser
 * that will not re-encode it at all. Every other failure falls back to the
 * editor's own bytes, so an upload never breaks because of this step.
 */
export async function compressImageForUpload(file: File): Promise<File> {
  // A flyer is a document; there is nothing to re-encode and no pixels to keep.
  if (!file.type.startsWith("image/")) return file;

  const candidate = await bestCandidate(file);
  // Some files are already smaller than anything this would produce — an
  // optimised WebP, or a flat PNG of a logo that lossy encoding only makes worse
  // and bigger. Keep what the editor chose.
  const chosen = candidate && candidate.size < file.size ? candidate : file;
  if (chosen.size > maxUploadBytes) throw new ImageTooLargeError();
  return chosen;
}

/** The smallest re-encoding available, or null when none could be made. */
async function bestCandidate(file: File): Promise<File | null> {
  try {
    // `from-image` applies the EXIF rotation while that metadata still exists,
    // so a photograph taken in portrait does not come back on its side once the
    // orientation tag has been dropped with the rest of the metadata.
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    try {
      if (bitmap.width * bitmap.height > maxPixels) return null;
      let smallest: File | null = null;
      for (const attempt of attempts) {
        const size = scaledDimensions(
          bitmap.width,
          bitmap.height,
          attempt.edge,
        );
        const blob = await drawToBlob(bitmap, size, attempt.quality);
        if (!blob) continue;
        const encoded = new File([blob], webpName(file.name), {
          type: outputType,
          lastModified: file.lastModified,
        });
        if (!smallest || encoded.size < smallest.size) smallest = encoded;
        if (encoded.size <= maxUploadBytes) return encoded;
      }
      return smallest;
    } finally {
      bitmap.close();
    }
  } catch {
    // A codec this browser will not decode, a canvas it will not read back, a
    // file that is not an image at all.
    return null;
  }
}

async function drawToBlob(
  bitmap: ImageBitmap,
  size: Dimensions,
  quality: number,
): Promise<Blob | null> {
  // No background is painted first: WebP keeps the alpha channel, and filling
  // white would put a card behind every transparent logo.
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(size.width, size.height);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    return canvas.convertToBlob({ type: outputType, quality });
  }
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  return new Promise((resolve) => {
    canvas.toBlob(resolve, outputType, quality);
  });
}

/** The uploaded file's name is a label in the console, not a storage key. */
function webpName(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, "").trim();
  return `${base === "" ? "image" : base}.webp`;
}
