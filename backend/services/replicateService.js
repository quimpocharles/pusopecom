import axios from 'axios';

const REPLICATE_API_URL = 'https://api.replicate.com/v1';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const generateTryOn = async (userImageBase64, productImageBase64, productName) => {
  try {
    const apiToken = process.env.REPLICATE_API_TOKEN;

    if (!apiToken) {
      throw new Error('REPLICATE_API_TOKEN is not configured');
    }

    // Ensure base64 images have proper data URL prefix
    const personImage = userImageBase64.startsWith('data:')
      ? userImageBase64
      : `data:image/jpeg;base64,${userImageBase64}`;

    const garmentImage = productImageBase64.startsWith('data:')
      ? productImageBase64
      : `data:image/png;base64,${productImageBase64}`;

    // Craft a detailed prompt for virtual try-on
    const prompt = `Virtual try-on: Take the person from the second image and dress them in the exact garment from the first image.

CRITICAL REQUIREMENTS:
- The garment is a ${productName || 'sports jersey'}
- PRESERVE EXACTLY all logos, text, numbers, patterns, and designs on the garment - do not alter, blur, or change any detail
- Keep the person's face, body shape, skin tone, and pose exactly as shown
- Make the garment fit naturally on the person's body with realistic folds and draping
- Maintain the person's original background
- The result should look like a professional product photo of the person wearing this exact garment

First image: The garment/jersey to put on the person (preserve ALL design details exactly)
Second image: The person who should wear the garment`;

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

    const predictionId = createResponse.data.id;

    if (!predictionId) {
      throw new Error('Failed to start try-on generation');
    }

    // Poll for completion (max 120 seconds)
    const maxAttempts = 40;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const statusResponse = await axios.get(
        `${REPLICATE_API_URL}/predictions/${predictionId}`,
        {
          headers: {
            'Authorization': `Bearer ${apiToken}`
          }
        }
      );

      const { status, output, error } = statusResponse.data;

      if (status === 'succeeded') {
        if (output) {
          // Output could be a single URL or array
          const imageUrl = Array.isArray(output) ? output[0] : output;

          // Fetch and convert to base64 for frontend
          const imageResponse = await axios.get(imageUrl, {
            responseType: 'arraybuffer'
          });
          const base64 = Buffer.from(imageResponse.data).toString('base64');
          const mimeType = imageResponse.headers['content-type'] || 'image/png';

          return {
            success: true,
            image: `data:${mimeType};base64,${base64}`
          };
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
      await sleep(3000);
    }

    throw new Error('Try-on generation timed out. Please try again.');

  } catch (error) {
    console.error('Replicate try-on error:', error.response?.data || error.message);

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

    throw new Error(error.message || 'Failed to generate virtual try-on');
  }
};

export default { generateTryOn };
