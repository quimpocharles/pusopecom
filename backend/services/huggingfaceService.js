import { Client, handle_file } from '@gradio/client';

export const generateTryOn = async (userImageBase64, productImageBase64, productName) => {
  try {
    const hfToken = process.env.HF_TOKEN;

    // Connect to the IDM-VTON space on Hugging Face
    const client = await Client.connect("yisol/IDM-VTON", {
      hf_token: hfToken || undefined
    });

    // Convert base64 to blob for the Gradio client
    const userImageBlob = base64ToBlob(userImageBase64, 'image/jpeg');
    const productImageBlob = base64ToBlob(productImageBase64, 'image/jpeg');

    // Call the predict endpoint
    // IDM-VTON expects: human_img, garm_img, garment_des, is_checked, is_checked_crop, denoise_steps, seed
    const result = await client.predict("/tryon", {
      dict: {
        background: handle_file(userImageBlob),
        layers: [],
        composite: null
      },
      garm_img: handle_file(productImageBlob),
      garment_des: productName || "Sports jersey",
      is_checked: true,        // Use auto-mask
      is_checked_crop: false,  // Don't use auto-crop
      denoise_steps: 30,
      seed: 42
    });

    // Result should contain the generated image
    if (result && result.data && result.data[0]) {
      const outputImage = result.data[0];

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

      // If it's already base64 or data URL
      if (typeof outputImage === 'string') {
        return {
          success: true,
          image: outputImage.startsWith('data:') ? outputImage : `data:image/png;base64,${outputImage}`
        };
      }

      // If it's a file object with url
      if (outputImage.url) {
        const response = await fetch(outputImage.url);
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');

        return {
          success: true,
          image: `data:image/png;base64,${base64}`
        };
      }
    }

    throw new Error('No output image generated');

  } catch (error) {
    console.error('HuggingFace try-on error:', error);

    if (error.message?.includes('exceeded')) {
      throw new Error('Service is busy. Please try again in a few moments.');
    }
    if (error.message?.includes('queue')) {
      throw new Error('Service is processing other requests. Please wait and try again.');
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
