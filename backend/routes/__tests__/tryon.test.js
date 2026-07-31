import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

vi.mock('../../services/replicateService.js', () => ({ generateTryOn: vi.fn() }));
vi.mock('../../services/wavespeedService.js', () => ({ generateTryOn: vi.fn() }));
vi.mock('axios', () => ({ default: { get: vi.fn() } }));

const { default: tryonRouter } = await import('../tryon.js');
const replicateService = await import('../../services/replicateService.js');
const wavespeedService = await import('../../services/wavespeedService.js');
const axios = (await import('axios')).default;

const app = express();
app.use('/api/tryon', tryonRouter);

const originalWavespeedKey = process.env.WAVESPEED_API_KEY;
const originalWavespeedModel = process.env.WAVESPEED_MODEL;
const createdProductIds = [];
// Each test uses its own productName so /tryon's fire-and-forget log write
// can be looked up unambiguously by name, rather than racing other tests'
// writes under a shared name.
const uniqueName = (label) => `TryOnTest-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(async () => {
  if (originalWavespeedKey === undefined) delete process.env.WAVESPEED_API_KEY;
  else process.env.WAVESPEED_API_KEY = originalWavespeedKey;
  if (originalWavespeedModel === undefined) delete process.env.WAVESPEED_MODEL;
  else process.env.WAVESPEED_MODEL = originalWavespeedModel;
  await prisma.tryOnLog.deleteMany({ where: { productName: { startsWith: 'TryOnTest-' } } });
  await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
  await prisma.$disconnect();
});

const png = Buffer.from('89504e470d0a1a0a', 'hex');

async function waitForLog(productName) {
  // logging is fire-and-forget — poll briefly rather than a fixed sleep
  for (let i = 0; i < 20; i++) {
    const log = await prisma.tryOnLog.findFirst({ where: { productName } });
    if (log) return log;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

describe('POST /tryon — validation', () => {
  it('400s when no image file is attached', async () => {
    const res = await request(app).post('/api/tryon').field('productImageUrl', 'https://example.com/p.jpg');
    expect(res.status).toBe(400);
  });

  it('400s when productImageUrl is missing', async () => {
    const res = await request(app).post('/api/tryon').attach('userImage', png, 'me.png');
    expect(res.status).toBe(400);
  });
});

describe('POST /tryon — WaveSpeed path', () => {
  beforeEach(() => {
    process.env.WAVESPEED_API_KEY = 'test-key';
    process.env.WAVESPEED_MODEL = 'nano-banana-2'; // fixed, so the provider-label assertions below are deterministic
  });

  it('returns the generated image on success and logs the attempt against a valid productId, with provider and duration', async () => {
    const productName = uniqueName('valid-id');
    const product = await prisma.product.create({
      data: {
        name: productName, slug: `tryon-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        description: 'x', price: 500, category: 'jersey', sport: 'basketball', images: [],
      },
    });
    createdProductIds.push(product.id);

    wavespeedService.generateTryOn.mockImplementationOnce(async () => {
      await new Promise((r) => setTimeout(r, 20)); // ensures durationMs is measurably > 0
      return { success: true, image: 'data:image/png;base64,xyz' };
    });

    const res = await request(app)
      .post('/api/tryon')
      .field('productImageUrl', 'https://example.com/p.jpg')
      .field('productName', productName)
      .field('productId', product.id)
      .attach('userImage', png, 'me.png');

    expect(res.status).toBe(200);
    expect(res.body.image).toBe('data:image/png;base64,xyz');
    expect(replicateService.generateTryOn).not.toHaveBeenCalled();

    const log = await waitForLog(productName);
    expect(log).not.toBeNull();
    expect(log.success).toBe(true);
    expect(log.productId).toBe(product.id);
    expect(log.provider).toBe('wavespeed:nano-banana-2');
    expect(log.durationMs).toBeGreaterThan(0);
  }, 15000);

  it('ignores a malformed productId and falls back to a name lookup', async () => {
    const productName = uniqueName('fallback-lookup');
    const realProduct = await prisma.product.create({
      data: {
        name: productName, slug: `tryon-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        description: 'x', price: 500, category: 'jersey', sport: 'basketball', images: [],
      },
    });
    createdProductIds.push(realProduct.id);

    wavespeedService.generateTryOn.mockResolvedValueOnce({ success: true, image: 'data:image/png;base64,xyz' });

    const res = await request(app)
      .post('/api/tryon')
      .field('productImageUrl', 'https://example.com/p.jpg')
      .field('productName', productName)
      .field('productId', 'not-a-real-uuid')
      .attach('userImage', png, 'me.png');
    expect(res.status).toBe(200);

    const log = await waitForLog(productName);
    expect(log.productId).toBe(realProduct.id);
  }, 15000);

  it('returns 422 and logs a failed attempt when generation fails, still recording provider and duration', async () => {
    const productName = uniqueName('generation-fails');
    wavespeedService.generateTryOn.mockResolvedValueOnce({ success: false, message: 'Could not generate' });

    const res = await request(app)
      .post('/api/tryon')
      .field('productImageUrl', 'https://example.com/p.jpg')
      .field('productName', productName)
      .attach('userImage', png, 'me.png');
    expect(res.status).toBe(422);
    expect(res.body.message).toBe('Could not generate');

    const log = await waitForLog(productName);
    expect(log.success).toBe(false);
    expect(log.provider).toBe('wavespeed:nano-banana-2');
    expect(log.durationMs).not.toBeNull();
  }, 15000);

  it('returns 500 (or 429 for a rate-limit message) and logs a failed attempt when generation throws, still recording provider and duration', async () => {
    const productName = uniqueName('generation-throws');
    wavespeedService.generateTryOn.mockRejectedValueOnce(new Error('boom'));

    const res = await request(app)
      .post('/api/tryon')
      .field('productImageUrl', 'https://example.com/p.jpg')
      .field('productName', productName)
      .attach('userImage', png, 'me.png');
    expect(res.status).toBe(500);

    const log = await waitForLog(productName);
    expect(log.success).toBe(false);
    expect(log.provider).toBe('wavespeed:nano-banana-2');
    expect(log.durationMs).not.toBeNull(); // the throw happens after genStart is set — duration is still known
  }, 15000);

  it('labels the log with whichever WAVESPEED_MODEL was active for that request', async () => {
    process.env.WAVESPEED_MODEL = 'seedream';
    const productName = uniqueName('seedream-label');
    wavespeedService.generateTryOn.mockResolvedValueOnce({ success: true, image: 'data:image/png;base64,xyz' });

    await request(app)
      .post('/api/tryon')
      .field('productImageUrl', 'https://example.com/p.jpg')
      .field('productName', productName)
      .attach('userImage', png, 'me.png');

    const log = await waitForLog(productName);
    expect(log.provider).toBe('wavespeed:seedream');
  }, 15000);
});

describe('POST /tryon — Replicate path (no WAVESPEED_API_KEY)', () => {
  beforeEach(() => { delete process.env.WAVESPEED_API_KEY; });

  it('fetches the product image, calls the Replicate service, and logs provider "replicate"', async () => {
    axios.get.mockResolvedValueOnce({ data: png });
    replicateService.generateTryOn.mockResolvedValueOnce({ success: true, image: 'data:image/png;base64,xyz' });
    const productName = uniqueName('replicate-path');

    const res = await request(app)
      .post('/api/tryon')
      .field('productImageUrl', 'https://example.com/p.jpg')
      .field('productName', productName)
      .attach('userImage', png, 'me.png');

    expect(res.status).toBe(200);
    expect(wavespeedService.generateTryOn).not.toHaveBeenCalled();
    expect(replicateService.generateTryOn).toHaveBeenCalled();

    const log = await waitForLog(productName);
    expect(log.provider).toBe('replicate');
    expect(log.durationMs).not.toBeNull();
  }, 15000);

  it('400s when the product image cannot be fetched', async () => {
    axios.get.mockRejectedValueOnce(new Error('network error'));

    const res = await request(app)
      .post('/api/tryon')
      .field('productImageUrl', 'https://example.com/p.jpg')
      .attach('userImage', png, 'me.png');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/failed to fetch product image/i);
  });
});
