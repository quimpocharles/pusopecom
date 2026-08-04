import axios from 'axios';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';

const REPLICATE_API_URL = 'https://api.replicate.com/v1';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const cancelPrediction = async (apiToken, predictionId) => {
  // Retry cancel up to 5 times with 3s delay — Replicate may be temporarily overloaded
  for (let i = 0; i < 5; i++) {
    try {
      await axios.post(
        REPLICATE_API_URL + '/predictions/' + predictionId + '/cancel',
        {},
        { headers: { Authorization: 'Bearer ' + apiToken }, timeout: 5000 }
      );
      return; // cancelled successfully
    } catch (_) {
      if (i < 4) await sleep(3000);
    }
  }
  logger.warn({ predictionId }, 'Failed to cancel Replicate prediction after retries');
};

export const generateTryOn = async (userImageBase64, productImageBase64, productName) => {
  const apiToken = process.env.REPLICATE_API_TOKEN;

  if (!apiToken) {
    throw new Error('REPLICATE_API_TOKEN is not configured');
  }


  let predictionId = null;

  try {
    // Ensure base64 images have proper data URL prefix
    const personImage = userImageBase64.startsWith('data:')
      ? userImageBase64
      : `data:image/jpeg;base64,${userImageBase64}`;

    const garmentImage = productImageBase64.startsWith('data:')
      ? productImageBase64
      : `data:image/png;base64,${productImageBase64}`;

    // Craft a detailed prompt for virtual try-on
    const prompt = `Virtual try-on: Take the person from the second image and dress them in the wearable exterior of the garment from the first image.

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
- First image: Garment reference (design reference only; internal tags are NOT part of the design)
- Second image: Person to wear the garment`;

    // Create prediction using Seedream 4.5
    const createResponse = await axios.post(
      `${REPLICATE_API_URL}/predictions`,
      {
        version: '8356ab00a2acd0f79338ecf1ffa0e32493c6f7cdfc7178b5cfbdb1461202fdc2',
        input: {
          prompt: prompt,
          image_input: [garmentImage, personImage],
          aspect_ratio: '3:4',
          size: '2K'
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    predictionId = createResponse.data.id;

    if (!predictionId) {
      throw new Error('Failed to start try-on generation');
    }

    // Poll for completion — based on Replicate data: successful runs take 28–44s.
    // 30 attempts × 2s = 60s max (gives ~16s buffer above the observed worst case).
    const maxAttempts = 30;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const statusResponse = await axios.get(
        `${REPLICATE_API_URL}/predictions/${predictionId}`,
        {
          headers: { 'Authorization': `Bearer ${apiToken}` }
        }
      );

      const { status, output, error } = statusResponse.data;

      if (status === 'succeeded') {
        if (output) {
          const imageUrl = Array.isArray(output) ? output[0] : output;
          const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
          const base64 = Buffer.from(imageResponse.data).toString('base64');
          const mimeType = imageResponse.headers['content-type'] || 'image/png';
          return { success: true, image: `data:${mimeType};base64,${base64}` };
        }
        throw new Error('No output image generated');
      }

      if (status === 'failed') {
        throw new Error(error || 'Try-on generation failed');
      }

      if (status === 'canceled') {
        throw new Error('Try-on generation was canceled');
      }

      // Status is 'starting' or 'processing'
      attempts++;
      await sleep(2000);
    }

    // Timed out — cancel the prediction on Replicate before throwing
    await cancelPrediction(apiToken, predictionId);
    throw new Error('Try-on generation timed out. Please try again.');

  } catch (error) {
    // Cancel any in-flight prediction when we bail out due to an error
    if (predictionId) {
      await cancelPrediction(apiToken, predictionId);
    }

    logger.error({ err: error }, 'Replicate try-on error');
    Sentry.captureException(error);

    if (error.response?.status === 401) {
      throw new Error('Invalid API token. Please check your Replicate API token.');
    }
    if (error.response?.status === 402) {
      throw new Error('Insufficient credits. Please add billing to your Replicate account.');
    }
    if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }

    throw new Error(error.message || 'Failed to generate Fit Check');
  }
};

export default { generateTryOn };
