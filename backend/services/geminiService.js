import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const TRYON_PROMPT = `You are a virtual try-on assistant. I'm providing two images:
1. A photo of a person (first image)
2. A photo of a clothing item - jersey/shirt (second image)

Your task: Generate a NEW realistic image showing the person wearing the clothing item.

Requirements:
- Keep the person's face, body shape, and pose exactly as in their original photo
- Dress them in the clothing item from the second image
- Maintain realistic lighting, shadows, and fabric draping
- The result should look like a natural photograph
- Preserve the background from the person's original photo
- Make sure the clothing fits naturally on the person's body

Generate the image now.`;

export const generateTryOn = async (userImageBase64, productImageBase64, productName) => {
  try {
    // Use Gemini 2.0 Flash Image Generation model
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp-image-generation',
    });

    const customPrompt = `${TRYON_PROMPT}\n\nThe clothing item is: ${productName}`;

    const imageParts = [
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: userImageBase64
        }
      },
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: productImageBase64
        }
      }
    ];

    const result = await model.generateContent([customPrompt, ...imageParts]);
    const response = await result.response;

    // Check for image in response
    if (response.candidates && response.candidates[0]?.content?.parts) {
      const parts = response.candidates[0].content.parts;

      for (const part of parts) {
        if (part.inlineData) {
          return {
            success: true,
            image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
          };
        }
      }

      // If no image generated, return the text explanation
      const textPart = parts.find(p => p.text);
      if (textPart) {
        return {
          success: false,
          message: textPart.text || 'Unable to generate image. The AI provided a text response instead.'
        };
      }
    }

    // Fallback - get text response
    const text = response.text();
    return {
      success: false,
      message: text || 'Failed to generate try-on image. Please try again.'
    };

  } catch (error) {
    console.error('Gemini try-on error:', error.message);

    // More specific error messages
    if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('API key not valid')) {
      throw new Error('Invalid API key. Please verify your Gemini API key is correct and active.');
    }
    if (error.message?.includes('not found') || error.message?.includes('404')) {
      throw new Error('Model not available. Please try again later.');
    }
    if (error.message?.includes('quota') || error.message?.includes('429')) {
      throw new Error('API quota exceeded. Please try again later.');
    }
    if (error.message?.includes('SAFETY')) {
      throw new Error('Image was blocked by safety filters. Please try a different photo.');
    }

    throw new Error(error.message || 'Failed to generate virtual try-on');
  }
};

export default { generateTryOn };
