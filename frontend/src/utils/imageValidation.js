/**
 * Deterministic, local quality checks that run on the optimized image
 * before it's sent to the AI Try-On endpoint. Resolution, darkness, and
 * blur are real, measured signals (pixel dimensions / mean luminance /
 * Laplacian-variance sharpness) — all classic, dependency-free techniques
 * that need no ML model.
 *
 * Framing checks (face visible, upper body visible, single subject) are
 * deliberately NOT implemented here: reliably detecting a face or a body
 * requires an actual vision model — client-side ML (bundle size, model
 * hosting) or a backend vision call (latency, cost) — a real
 * infrastructure decision, not something to fake with a brightness/blur
 * heuristic. A heuristic that claims "no face detected" when it can't
 * actually tell would misinform fans more often than it helps, which is
 * worse than not checking at all. checkFraming() below is a named,
 * documented extension point for wiring a real model/service later — it
 * always passes today. Flagged explicitly rather than silently omitted.
 */

const MIN_DIMENSION = 400;
const DARK_LUMINANCE_THRESHOLD = 40; // 0-255 scale, sampled mean
const BLUR_VARIANCE_THRESHOLD = 25; // Laplacian variance; lower = blurrier — starting point, not yet tuned against a real photo set

function getGrayscale(canvas) {
  const { width, height } = canvas;
  const { data } = canvas.getContext('2d').getImageData(0, 0, width, height);
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return { gray, width, height };
}

function meanLuminance(gray) {
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i];
  return sum / gray.length;
}

// Laplacian variance: convolve a simple edge kernel, take the variance of
// the response. A sharp photo has strong edges throughout → high variance;
// a blurry one has almost none → low variance.
function laplacianVariance(gray, width, height) {
  const responses = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const value = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width];
      responses.push(value);
    }
  }
  const mean = responses.reduce((a, b) => a + b, 0) / responses.length;
  const variance = responses.reduce((a, b) => a + (b - mean) ** 2, 0) / responses.length;
  return variance;
}

// Documented no-op — see file header. Always resolves valid until a real
// vision model/service is wired in.
// eslint-disable-next-line no-unused-vars
async function checkFraming(canvas) {
  return { valid: true };
}

export async function validateImage(canvas) {
  if (canvas.width < MIN_DIMENSION || canvas.height < MIN_DIMENSION) {
    return {
      valid: false,
      message: 'This photo is too small to use. Try a higher-resolution photo.',
    };
  }

  // Downscale for the pixel-math checks — a 1600px canvas is 2.5M+
  // pixels, far more than needed to estimate brightness/sharpness, and
  // doing this at full resolution is needless work on every photo.
  const sampleCanvas = document.createElement('canvas');
  const sampleScale = Math.min(1, 300 / Math.max(canvas.width, canvas.height));
  sampleCanvas.width = Math.round(canvas.width * sampleScale);
  sampleCanvas.height = Math.round(canvas.height * sampleScale);
  sampleCanvas.getContext('2d').drawImage(canvas, 0, 0, sampleCanvas.width, sampleCanvas.height);

  const { gray, width, height } = getGrayscale(sampleCanvas);

  if (meanLuminance(gray) < DARK_LUMINANCE_THRESHOLD) {
    return {
      valid: false,
      message: 'This photo looks a bit dark. Try retaking it somewhere with more light.',
    };
  }

  if (laplacianVariance(gray, width, height) < BLUR_VARIANCE_THRESHOLD) {
    return {
      valid: false,
      message: 'This photo looks a little blurry. Try holding the camera steady and retaking it.',
    };
  }

  const framing = await checkFraming(canvas);
  if (!framing.valid) return framing;

  return { valid: true };
}
