import axios from 'axios';

const FASHN_API_URL = 'https://api.fashn.ai/v1';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const generateTryOn = async (userImageBase64, productImageBase64, productName) => {
  try {
    const apiKey = process.env.FASHN_API_KEY;

    if (!apiKey) {
      throw new Error('FASHN_API_KEY is not configured');
    }

    // Ensure base64 images have proper prefix
    const modelImage = userImageBase64.startsWith('data:')
      ? userImageBase64
      : `data:image/jpeg;base64,${userImageBase64}`;

    const garmentImage = productImageBase64.startsWith('data:')
      ? productImageBase64
      : `data:image/jpeg;base64,${productImageBase64}`;

    // Start the try-on job
    const runResponse = await axios.post(
      `${FASHN_API_URL}/run`,
      {
        model_name: 'tryon-v1.6',
        model_image: modelImage,
        garment_image: garmentImage,
        category: 'tops', // jerseys are tops
        mode: 'balanced', // good balance of speed/quality
        output_format: 'jpeg',
        return_base64: true,
        num_samples: 1
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    const predictionId = runResponse.data.id;

    if (!predictionId) {
      throw new Error('Failed to start try-on generation');
    }

    // Poll for completion (max 60 seconds)
    const maxAttempts = 20;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const statusResponse = await axios.get(
        `${FASHN_API_URL}/status/${predictionId}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        }
      );

      const { status, output, error } = statusResponse.data;

      if (status === 'completed') {
        if (output && output.length > 0) {
          // If return_base64 is true, output contains base64 strings
          const imageData = output[0];

          // Check if it's already a data URL or just base64
          const finalImage = imageData.startsWith('data:')
            ? imageData
            : `data:image/jpeg;base64,${imageData}`;

          return {
            success: true,
            image: finalImage
          };
        }
        throw new Error('No output image generated');
      }

      if (status === 'failed') {
        throw new Error(error || 'Try-on generation failed');
      }

      // Status is 'starting', 'in_queue', or 'processing'
      attempts++;
      await sleep(3000); // Wait 3 seconds before next poll
    }

    throw new Error('Try-on generation timed out. Please try again.');

  } catch (error) {
    console.error('Fashn try-on error:', error.response?.data || error.message);

    // Handle specific error cases
    if (error.response?.status === 401) {
      throw new Error('Invalid API key. Please check your Fashn.ai API key.');
    }
    if (error.response?.status === 402) {
      throw new Error('Insufficient credits. Please add credits to your Fashn.ai account.');
    }
    if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    throw new Error(error.message || 'Failed to generate virtual try-on');
  }
};

export default { generateTryOn };
