import sharp from 'sharp';

export const generateTryOn = async (userImageBase64, productImageBase64, productName) => {
  try {
    // Remove data URL prefix if present
    const userBase64Clean = userImageBase64.replace(/^data:image\/\w+;base64,/, '');
    const productBase64Clean = productImageBase64.replace(/^data:image\/\w+;base64,/, '');

    // Convert base64 to buffers
    const userBuffer = Buffer.from(userBase64Clean, 'base64');
    const productBuffer = Buffer.from(productBase64Clean, 'base64');

    // Get dimensions of user image
    const userMeta = await sharp(userBuffer).metadata();
    const userWidth = userMeta.width;
    const userHeight = userMeta.height;

    // Calculate jersey size and position (centered on upper body)
    // Jersey should cover roughly 40-50% of the image width
    // and be positioned in the upper-middle area (chest region)
    const jerseyWidth = Math.round(userWidth * 0.55);
    const jerseyHeight = Math.round(jerseyWidth * 1.1); // Slightly taller than wide

    // Position: horizontally centered, vertically around 15-20% from top
    const jerseyLeft = Math.round((userWidth - jerseyWidth) / 2);
    const jerseyTop = Math.round(userHeight * 0.18);

    // Resize the product image to fit
    const resizedProduct = await sharp(productBuffer)
      .resize(jerseyWidth, jerseyHeight, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();

    // Composite the jersey onto the user image
    const result = await sharp(userBuffer)
      .composite([
        {
          input: resizedProduct,
          left: jerseyLeft,
          top: jerseyTop,
          blend: 'over'
        }
      ])
      .jpeg({ quality: 90 })
      .toBuffer();

    const resultBase64 = result.toString('base64');

    return {
      success: true,
      image: `data:image/jpeg;base64,${resultBase64}`
    };

  } catch (error) {
    console.error('Overlay try-on error:', error);
    throw new Error(error.message || 'Failed to generate virtual try-on');
  }
};

export default { generateTryOn };
