import { describe, it, expect } from 'vitest';
import { validateImage } from '../imageValidation';

// The darkness/blur checks need a real CanvasRenderingContext2D
// (getImageData), which jsdom doesn't implement without the `canvas` npm
// package — not a dependency this change should add unilaterally. The
// resolution check runs first and only reads canvas.width/height, so it's
// exercised here with a plain stub rather than a real <canvas> element.
describe('validateImage', () => {
  it('rejects an image below the minimum dimension with a plain-language message', async () => {
    const result = await validateImage({ width: 200, height: 200 });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/too small/i);
  });

  it('does not reject on width alone if height is also below the minimum', async () => {
    const result = await validateImage({ width: 1600, height: 300 });
    expect(result.valid).toBe(false);
  });
});
