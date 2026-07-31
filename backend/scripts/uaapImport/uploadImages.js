import cloudinary from '../../config/cloudinary.js';

/**
 * Uploads each row's extracted image buffer to the same Cloudinary folder
 * the app's own upload route already uses (routes/upload.js:
 * `puso-shop/products`), so these live alongside every other product
 * image rather than in a separate, inconsistent location.
 *
 * Uploads sequentially, not in parallel — this is a one-time, 100-image
 * import script, not a latency-sensitive request path, and sequential
 * uploads make a failure partway through trivial to diagnose (you know
 * exactly which row failed) rather than debugging a burst of 100
 * concurrent requests against Cloudinary's API.
 */
export async function uploadRowImages(rowToBuffer, { onProgress } = {}) {
  const rowToUrl = {};
  const failures = [];
  const rows = Object.keys(rowToBuffer);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'puso-shop/products', resource_type: 'image' },
          (error, uploadResult) => (error ? reject(error) : resolve(uploadResult))
        );
        stream.end(rowToBuffer[row]);
      });
      rowToUrl[row] = result.secure_url;
    } catch (error) {
      // Cloudinary's SDK sometimes rejects with a plain string rather than
      // an Error instance (confirmed directly: a missing-credentials
      // failure came back as the bare string "Must supply api_key", not
      // an Error with a .message) — normalize both shapes here rather
      // than risk logging `undefined` again.
      const message = typeof error === 'string' ? error : error?.message || String(error);
      failures.push({ row, message });
    }
    onProgress?.(i + 1, rows.length);
  }

  return { rowToUrl, failures };
}
