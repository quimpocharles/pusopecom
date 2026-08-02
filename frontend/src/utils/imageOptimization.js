/**
 * Client-side image pipeline run on every photo before it's sent to the AI
 * Try-On endpoint, regardless of source (camera capture or file upload):
 * EXIF-orientation-correct, strip metadata (a side effect of re-encoding
 * through canvas — canvas exports never carry the source's EXIF block),
 * resize to a sane max dimension, and compress. The caller is expected to
 * fall back to the original file untouched if this throws (see
 * VirtualTryOn.jsx's handleUsePhoto) — the feature must never block a fan
 * from trying on a jersey because their phone's photo didn't optimize
 * cleanly.
 */

const MAX_DIMENSION = 1600;
const TARGET_MAX_BYTES = 2 * 1024 * 1024; // 2MB
const INITIAL_QUALITY = 0.88;
const MIN_QUALITY = 0.5;

export class ImageOptimizationError extends Error {}

/**
 * createImageBitmap with imageOrientation:'from-image' handles EXIF
 * rotation natively in every current evergreen browser. Safari <15 and a
 * few older Android WebViews don't support that option (some don't support
 * createImageBitmap at all) — those fall back to a plain <img> decode. The
 * fallback path may leave orientation uncorrected when drawn to canvas
 * (browsers auto-orient on *display* but not necessarily when the pixels
 * are read into a canvas on very old engines) — an acceptable degradation
 * given how small that browser population is today; the photo still gets
 * used, just possibly not re-oriented.
 */
async function decodeOriented(blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      // fall through to the <img> path below
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImageOptimizationError('Could not decode image'));
    img.src = URL.createObjectURL(blob);
  });
}

function drawResized(source, maxDimension) {
  const sourceWidth = source.width ?? source.naturalWidth;
  const sourceHeight = source.height ?? source.naturalHeight;
  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  const width = Math.round(sourceWidth * scale);
  const height = Math.round(sourceHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(source, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new ImageOptimizationError('Encoding failed'))),
      'image/jpeg',
      quality
    );
  });
}

/**
 * Returns { blob, width, height, canvas } — canvas is kept around so the
 * validation step (imageValidation.js) can read pixel data without
 * re-decoding the compressed output. Throws ImageOptimizationError (or
 * whatever decodeOriented/canvasToBlob threw) if the pipeline can't
 * complete at all — callers should catch and fall back to the raw file.
 */
export async function optimizeImage(fileOrBlob) {
  const source = await decodeOriented(fileOrBlob);
  const canvas = drawResized(source, MAX_DIMENSION);
  if (source.close) source.close(); // release the ImageBitmap

  let quality = INITIAL_QUALITY;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > TARGET_MAX_BYTES && quality > MIN_QUALITY) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, quality);
  }

  return { blob, width: canvas.width, height: canvas.height, canvas };
}
