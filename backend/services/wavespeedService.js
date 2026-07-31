import axios from 'axios';
import cloudinary from '../config/cloudinary.js';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';

const WAVESPEED_API_URL = 'https://api.wavespeed.ai/api/v3';

// Switch models via WAVESPEED_MODEL env var. Options:
//   seedream      → bytedance/seedream-v5.0-lite/edit  (~40s, $0.035)
//   nano-banana-2 → google/nano-banana-2/edit           (fast, $0.07 at 1K)
//   nano-banana-pro → google/nano-banana-pro/edit       (~2-3s, $0.14 at 1K)
const MODELS = {
  'seedream': {
    endpoint: 'bytedance/seedream-v5.0-lite/edit',
    params: () => ({}),
  },
  'nano-banana-2': {
    endpoint: 'google/nano-banana-2/edit',
    params: () => ({ resolution: '0.5k', output_format: 'jpeg', aspect_ratio: '2:3' }),
  },
  'nano-banana-pro': {
    endpoint: 'google/nano-banana-pro/edit',
    params: () => ({ resolution: '1k', output_format: 'jpeg', aspect_ratio: '2:3' }),
  },
};

const getModel = () => {
  const key = (process.env.WAVESPEED_MODEL || 'seedream').toLowerCase();
  return MODELS[key] || MODELS['seedream'];
};

// Upload buffer to Cloudinary to get a publicly accessible URL.
// WaveSpeed requires URLs, not base64 — Cloudinary is already configured.
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'tryon-temp', resource_type: 'image' },
      (error, result) => {
        if (error) reject(error);
        else resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    uploadStream.end(buffer);
  });
};

// Fire-and-forget cleanup — user photos shouldn't linger in Cloudinary
const deleteFromCloudinary = (publicId) => {
  cloudinary.uploader.destroy(publicId).catch(() => {});
};

export const generateTryOn = async (userImageBuffer, userImageMimeType, productImageUrl, productName) => {
  const apiKey = process.env.WAVESPEED_API_KEY;
  if (!apiKey) throw new Error('WAVESPEED_API_KEY is not configured');

  const model = getModel();
  const startTime = Date.now();
  let userPublicId = null;

  try {
    // Upload user photo to Cloudinary for a public URL
    const uploadStart = Date.now();
    const { url: userImageUrl, publicId } = await uploadToCloudinary(userImageBuffer);
    userPublicId = publicId;
    logger.debug({ durationMs: Date.now() - uploadStart }, '[WaveSpeed] Cloudinary upload');

    const prompt = `Virtual try-on: Take the person from Figure 2 and dress them in the wearable exterior of the garment from Figure 1.

CRITICAL REQUIREMENTS:
- The garment is a ${productName || 'shirt or jersey'}
- Use ONLY the exterior wearable fabric of the garment
- IGNORE, REMOVE, or HIDE any internal elements such as:
  - neck tags
  - size tags
  - wash/care labels
  - brand tags located inside the collar or seams
- Internal tags MUST NOT appear on the outside of the garment

- PRESERVE EXACTLY all exterior logos, text, numbers, patterns, prints, embroidery, and designs
- Do NOT alter, blur, stretch, mirror, or recreate any exterior design detail
- Keep the person's face, body shape, skin tone, hairstyle, and pose exactly as shown
- Make the garment fit naturally with realistic folds, drape, and fabric tension
- Ensure the collar, sleeves, and hem align naturally with the body
- Maintain the person's original background
- The final output must look like a professional product photo of a real person wearing this exact garment

IMAGE DEFINITIONS:
- Figure 1: Garment reference (design reference only; internal tags are NOT part of the design)
- Figure 2: Person to wear the garment`;

    logger.debug({ endpoint: model.endpoint }, '[WaveSpeed] Using model');

    const submitResponse = await axios.post(
      `${WAVESPEED_API_URL}/${model.endpoint}`,
      {
        images: [productImageUrl, userImageUrl],
        prompt,
        enable_sync_mode: true,
        enable_base64_output: false,
        ...model.params(),
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 75000, // 75s — covers observed 28-44s generation + buffer
      }
    );

    const { status, outputs, id: taskId } = submitResponse.data?.data || {};
    logger.debug({ taskId, status }, '[WaveSpeed] Task status');

    if (status !== 'completed' || !outputs) {
      throw new Error('WaveSpeed: generation did not complete successfully');
    }

    const imageUrl = Array.isArray(outputs) ? outputs[0] : outputs;
    if (!imageUrl) throw new Error('WaveSpeed: completed but no output URL');

    const totalMs = Date.now() - startTime;
    logger.info({ durationMs: totalMs }, '[WaveSpeed] Generation done');

    if (userPublicId) deleteFromCloudinary(userPublicId);
    return { success: true, image: imageUrl };

  } catch (error) {
    if (userPublicId) deleteFromCloudinary(userPublicId);

    logger.error({ err: error }, '[WaveSpeed] Error');
    Sentry.captureException(error);

    if (error.response?.status === 401) throw new Error('Invalid WaveSpeed API key.');
    if (error.response?.status === 402) throw new Error('WaveSpeed: insufficient credits.');
    if (error.response?.status === 429) throw new Error('Rate limit exceeded. Please try again later.');
    if (error.response?.data?.message) throw new Error(error.response.data.message);

    throw new Error(error.message || 'Failed to generate virtual try-on');
  }
};

export default { generateTryOn };
