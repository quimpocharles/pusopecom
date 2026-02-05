import { Client, handle_file } from '@gradio/client';

export const generateTryOn = async (userImageBase64, productImageBase64, productName) => {
  try {
    // Connect to Kolors Virtual Try-On space on Hugging Face
    const client = await Client.connect("zhoujing204/Kolors-Virtual-Try-On", {
      hf_token: process.env.HF_TOKEN || undefined
    });

    // Convert base64 to blob
    const userImageBlob = base64ToBlob(userImageBase64, 'image/jpeg');
    const productImageBlob = base64ToBlob(productImageBase64, 'image/png');

    console.log('Calling Kolors Virtual Try-On...');

    // Call the tryon endpoint
    // Kolors expects: person_image, garment_image, seed, randomize_seed
    const result = await client.predict("/tryon", {
      person_img: handle_file(userImageBlob),
      garment_img: handle_file(productImageBlob),
      seed: 42,
      randomize_seed: false
    });

    console.log('Kolors result:', result);

    // Result should contain the generated image
    if (result && result.data) {
      // The output format may vary - handle different possibilities
      let outputImage = result.data[0];

      // If it's an array, get the first element (the try-on result)
      if (Array.isArray(outputImage)) {
        outputImage = outputImage[0];
      }

      // If it's a URL, fetch and convert to base64
      if (typeof outputImage === 'string' && outputImage.startsWith('http')) {
        const response = await fetch(outputImage);
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const mimeType = response.headers.get('content-type') || 'image/png';

        return {
          success: true,
          image: `data:${mimeType};base64,${base64}`
        };
      }

      // If it's a file object with url property
      if (outputImage && outputImage.url) {
        const response = await fetch(outputImage.url);
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');

        return {
          success: true,
          image: `data:image/png;base64,${base64}`
        };
      }

      // If it's already base64 or data URL
      if (typeof outputImage === 'string') {
        return {
          success: true,
          image: outputImage.startsWith('data:') ? outputImage : `data:image/png;base64,${outputImage}`
        };
      }
    }

    throw new Error('No output image generated');

  } catch (error) {
    console.error('Kolors try-on error:', error);

    if (error.message?.includes('exceeded') || error.message?.includes('queue')) {
      throw new Error('Service is busy. Please try again in a few moments.');
    }
    if (error.message?.includes('Could not connect')) {
      throw new Error('Kolors service is currently unavailable. Please try again later.');
    }

    throw new Error(error.message || 'Failed to generate virtual try-on');
  }
};

// Helper function to convert base64 to Blob
function base64ToBlob(base64, mimeType = 'image/jpeg') {
  // Remove data URL prefix if present
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');

  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

export default { generateTryOn };
