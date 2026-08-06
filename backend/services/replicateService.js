import axios from 'axios';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import { buildTryOnPrompt } from '../lib/tryOnPrompt.js';

const REPLICATE_API_URL = 'https://api.replicate.com/v1';

// Switch models via REPLICATE_MODEL env var. All three verified in real
// side-by-side generations against actual product images (not just their
// published example run times) — see the model comparison this session:
//   nano-banana        → google/nano-banana        (~10s) — the default.
//     Reliable face/body/logo fidelity in every test; tighter/flatter crop
//     than the -2 tier, but no known fidelity issues.
//   nano-banana-2       → google/nano-banana-2       (~14s) — best
//     composition/drape of the three, needs resolution set (no default).
//     Ruled out as the default on cost, not quality (confirmed against
//     real Replicate billing — Replicate's API/docs never expose per-image
//     price for any of these, so that check can only happen there).
//   nano-banana-2-lite → google/nano-banana-2-lite (~8s, fastest) —
//     DISQUALIFIED. Confirmed unreliable on real product photos across
//     three independent failure modes: garbled small secondary-logo text,
//     changed face identity, and mismatched body/head proportions. A more
//     emphatic face-preservation prompt measurably helped the face-identity
//     case specifically but did not fix the other two — this is a model
//     capability limit of the lite tier, not a prompt-wording problem.
//     Left in MODELS for reference; never the default.
const MODELS = {
  'nano-banana': { endpoint: 'google/nano-banana', params: () => ({}) },
  'nano-banana-2': { endpoint: 'google/nano-banana-2', params: () => ({ resolution: '1K' }) },
  'nano-banana-2-lite': { endpoint: 'google/nano-banana-2-lite', params: () => ({}) },
};

const getModel = () => {
  const key = (process.env.REPLICATE_MODEL || 'nano-banana').toLowerCase();
  return MODELS[key] || MODELS['nano-banana'];
};

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
    const prompt = buildTryOnPrompt(productName, {
      garment: { inline: 'the first image', label: 'First image' },
      person: { inline: 'the second image', label: 'Second image' },
    });

    const model = getModel();

    // Called via the model-scoped endpoint (not a pinned version hash) so
    // it always runs the model's current latest version, same as browsing
    // to replicate.com/google/<model> directly.
    const createResponse = await axios.post(
      `${REPLICATE_API_URL}/models/${model.endpoint}/predictions`,
      {
        input: {
          prompt: prompt,
          image_input: [garmentImage, personImage],
          aspect_ratio: '3:4',
          ...model.params(),
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

    // Poll for completion — 30 attempts × 2s = 60s max, well above every
    // model above's observed real-world worst case (~14s).
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
