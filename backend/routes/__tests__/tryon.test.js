import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

vi.mock('../../services/replicateService.js', () => ({ generateTryOn: vi.fn() }));
vi.mock('../../services/wavespeedService.js', () => ({ generateTryOn: vi.fn() }));
vi.mock('axios', () => ({ default: { get: vi.fn() } }));
vi.mock('../../config/cloudinary.js', () => ({
  default: { uploader: { upload: vi.fn() } },
}));

// Real quota enforcement is covered separately (lib/__tests__/fitCheckQuota.test.js
// and the dedicated tests below) — mocked here to a generous default so the
// rest of this file's tests (none of which send a real per-test sessionId)
// don't all collide on one shared "guest" Redis key and 429 each other out.
class FakeQuotaExceededError extends Error {
  constructor(status) {
    super("You've reached today's Fit Check limit.");
    this.name = 'QuotaExceededError';
    this.status = status;
  }
}
vi.mock('../../lib/fitCheckQuota.js', () => ({
  consume: vi.fn().mockResolvedValue({ limit: 5, used: 1, remaining: 4, resetsInSeconds: 3600 }),
  getStatus: vi.fn().mockResolvedValue({ limit: 5, used: 0, remaining: 5, resetsInSeconds: 3600 }),
  QuotaExceededError: FakeQuotaExceededError,
}));

// None of this file's existing tests send an Authorization header, so
// req.user stays undefined either way — this mock only exists to make the
// new admin-gated routes below testable without a real signed JWT, and
// matches the always-admin convention already used in
// routes/__tests__/settings.test.js.
vi.mock('../../middleware/auth.js', () => ({
  optionalAuth: (req, res, next) => next(),
  authenticate: (req, res, next) => { req.user = { _id: 'test-admin', role: 'admin' }; next(); },
  isAdmin: (req, res, next) => next(),
}));

vi.mock('../../repositories/bonusFitCheckGrantRepository.js', () => ({
  findByUser: vi.fn(),
  getBalance: vi.fn(),
  grant: vi.fn(),
}));

// Defaults to "nothing sponsors this product" so every existing test in
// this file (none of which involve a Sponsored Fit Check campaign) keeps
// going through the normal tier/bonus quota path unaffected.
vi.mock('../../repositories/fitCheckCampaignRepository.js', () => ({
  findActiveForProduct: vi.fn().mockResolvedValue(null),
}));

const { default: tryonRouter } = await import('../tryon.js');
const replicateService = await import('../../services/replicateService.js');
const wavespeedService = await import('../../services/wavespeedService.js');
const axios = (await import('axios')).default;
const cloudinary = (await import('../../config/cloudinary.js')).default;
const fitCheckQuota = await import('../../lib/fitCheckQuota.js');
const bonusFitCheckGrantRepository = await import('../../repositories/bonusFitCheckGrantRepository.js');
const fitCheckCampaignRepository = await import('../../repositories/fitCheckCampaignRepository.js');

const app = express();
// Only the new JSON admin routes (bonus grant) need this — the existing
// generation endpoint parses multipart form data itself via multer.
app.use(express.json());
app.use('/api/tryon', tryonRouter);

const originalWavespeedKey = process.env.WAVESPEED_API_KEY;
const originalWavespeedModel = process.env.WAVESPEED_MODEL;
const originalReplicateToken = process.env.REPLICATE_API_TOKEN;
const createdProductIds = [];
const createdCampaignIds = [];
// Each test uses its own productName so /tryon's fire-and-forget log write
// can be looked up unambiguously by name, rather than racing other tests'
// writes under a shared name.
const uniqueName = (label) => `TryOnTest-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

beforeEach(() => {
  vi.clearAllMocks();
  // Sane default so tests that don't care about the re-upload itself don't
  // each have to set it up — cleared call history via clearAllMocks above,
  // but mockResolvedValue (not *Once) survives it, so this holds per test.
  cloudinary.uploader.upload.mockResolvedValue({
    secure_url: 'https://res.cloudinary.com/test/puso-shop/tryon-results/fake.jpg',
    public_id: 'puso-shop/tryon-results/fake',
  });
});

afterAll(async () => {
  if (originalWavespeedKey === undefined) delete process.env.WAVESPEED_API_KEY;
  else process.env.WAVESPEED_API_KEY = originalWavespeedKey;
  if (originalWavespeedModel === undefined) delete process.env.WAVESPEED_MODEL;
  else process.env.WAVESPEED_MODEL = originalWavespeedModel;
  if (originalReplicateToken === undefined) delete process.env.REPLICATE_API_TOKEN;
  else process.env.REPLICATE_API_TOKEN = originalReplicateToken;
  await prisma.tryOnLog.deleteMany({ where: { productName: { startsWith: 'TryOnTest-' } } });
  await prisma.fitCheckCampaign.deleteMany({ where: { id: { in: createdCampaignIds } } });
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
    // Replicate is primary now — these tests exercise the "only WaveSpeed
    // configured" case, so REPLICATE_API_TOKEN must be off or every one of
    // these would route to Replicate instead.
    delete process.env.REPLICATE_API_TOKEN;
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
    expect(log.provider).toBe('wavespeed');
    expect(log.aiModel).toBe('nano-banana-2');
    expect(log.promptVersion).toBe('v1');
    expect(log.costUsd).toBeCloseTo(0.07);
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
    expect(log.provider).toBe('wavespeed');
    expect(log.aiModel).toBe('nano-banana-2');
    expect(log.durationMs).not.toBeNull();
    expect(log.generatedImageUrl).toBeNull(); // nothing to upload — generation itself failed
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
    expect(log.provider).toBe('wavespeed');
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
    expect(log.provider).toBe('wavespeed');
    expect(log.aiModel).toBe('seedream');
    expect(log.costUsd).toBeCloseTo(0.035);
  }, 15000);

  it('durably re-uploads the generated result to Cloudinary and stores the returned URL/publicId on the log row', async () => {
    const productName = uniqueName('image-persisted');
    wavespeedService.generateTryOn.mockResolvedValueOnce({ success: true, image: 'https://wavespeed.example/output.jpg' });

    await request(app)
      .post('/api/tryon')
      .field('productImageUrl', 'https://example.com/p.jpg')
      .field('productName', productName)
      .attach('userImage', png, 'me.png');

    // The upload happens inside the same fire-and-forget log write as the
    // DB row — wait for the row before asserting on either, or this races.
    const log = await waitForLog(productName);
    expect(cloudinary.uploader.upload).toHaveBeenCalledWith(
      'https://wavespeed.example/output.jpg',
      expect.objectContaining({ folder: 'puso-shop/tryon-results' })
    );
    expect(log.generatedImageUrl).toBe('https://res.cloudinary.com/test/puso-shop/tryon-results/fake.jpg');
    expect(log.generatedImagePublicId).toBe('puso-shop/tryon-results/fake');
  }, 15000);

  it('still writes the log row (with a null generatedImageUrl) when the Cloudinary re-upload itself fails', async () => {
    const productName = uniqueName('upload-fails');
    wavespeedService.generateTryOn.mockResolvedValueOnce({ success: true, image: 'https://wavespeed.example/output.jpg' });
    cloudinary.uploader.upload.mockRejectedValueOnce(new Error('cloudinary is down'));

    const res = await request(app)
      .post('/api/tryon')
      .field('productImageUrl', 'https://example.com/p.jpg')
      .field('productName', productName)
      .attach('userImage', png, 'me.png');
    expect(res.status).toBe(200); // the live response to the user is unaffected — upload is fire-and-forget

    const log = await waitForLog(productName);
    expect(log).not.toBeNull();
    expect(log.success).toBe(true);
    expect(log.generatedImageUrl).toBeNull();
  }, 15000);
});

describe('POST /tryon — Replicate path (primary; REPLICATE_API_TOKEN set, no WAVESPEED_API_KEY)', () => {
  beforeEach(() => {
    process.env.REPLICATE_API_TOKEN = 'test-token';
    delete process.env.WAVESPEED_API_KEY;
  });
  afterEach(() => { delete process.env.REPLICATE_API_TOKEN; }); // don't leak into later describe blocks that assume it's off

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
    expect(log.aiModel).toBeNull();
    expect(log.costUsd).toBeNull();
    expect(log.durationMs).not.toBeNull();
    expect(cloudinary.uploader.upload).toHaveBeenCalledWith(
      'data:image/png;base64,xyz',
      expect.objectContaining({ folder: 'puso-shop/tryon-results' })
    );
    expect(log.generatedImageUrl).toBe('https://res.cloudinary.com/test/puso-shop/tryon-results/fake.jpg');
  }, 15000);

  it('500s when the product image cannot be fetched and no WaveSpeed fallback is configured, logging provider "replicate"', async () => {
    axios.get.mockRejectedValueOnce(new Error('network error'));
    const productName = uniqueName('replicate-fetch-fails');

    const res = await request(app)
      .post('/api/tryon')
      .field('productImageUrl', 'https://example.com/p.jpg')
      .field('productName', productName)
      .attach('userImage', png, 'me.png');
    expect(res.status).toBe(500);
    expect(wavespeedService.generateTryOn).not.toHaveBeenCalled();

    const log = await waitForLog(productName);
    expect(log.success).toBe(false);
    expect(log.provider).toBe('replicate');
  }, 15000);
});

describe('POST /tryon — Replicate-primary, WaveSpeed-fallback', () => {
  beforeEach(() => {
    process.env.REPLICATE_API_TOKEN = 'test-token';
    process.env.WAVESPEED_API_KEY = 'test-key';
    process.env.WAVESPEED_MODEL = 'nano-banana-2';
  });
  afterEach(() => { delete process.env.REPLICATE_API_TOKEN; });

  it('tries Replicate first and never touches WaveSpeed when Replicate succeeds', async () => {
    axios.get.mockResolvedValueOnce({ data: png });
    replicateService.generateTryOn.mockResolvedValueOnce({ success: true, image: 'data:image/png;base64,xyz' });
    const productName = uniqueName('replicate-wins');

    const res = await request(app)
      .post('/api/tryon')
      .field('productImageUrl', 'https://example.com/p.jpg')
      .field('productName', productName)
      .attach('userImage', png, 'me.png');

    expect(res.status).toBe(200);
    expect(wavespeedService.generateTryOn).not.toHaveBeenCalled();

    const log = await waitForLog(productName);
    expect(log.provider).toBe('replicate');
  }, 15000);

  it('falls back to WaveSpeed and logs provider "wavespeed" when Replicate throws', async () => {
    axios.get.mockResolvedValueOnce({ data: png });
    replicateService.generateTryOn.mockRejectedValueOnce(new Error('Replicate is down'));
    wavespeedService.generateTryOn.mockResolvedValueOnce({ success: true, image: 'data:image/png;base64,xyz' });
    const productName = uniqueName('falls-back-to-wavespeed');

    const res = await request(app)
      .post('/api/tryon')
      .field('productImageUrl', 'https://example.com/p.jpg')
      .field('productName', productName)
      .attach('userImage', png, 'me.png');

    expect(res.status).toBe(200);
    expect(res.body.image).toBe('data:image/png;base64,xyz');
    expect(replicateService.generateTryOn).toHaveBeenCalled();
    expect(wavespeedService.generateTryOn).toHaveBeenCalled();

    const log = await waitForLog(productName);
    expect(log.success).toBe(true);
    expect(log.provider).toBe('wavespeed');
    expect(log.aiModel).toBe('nano-banana-2');
  }, 15000);

  it('falls back to WaveSpeed when fetching the product image for Replicate fails (WaveSpeed needs no local fetch)', async () => {
    axios.get.mockRejectedValueOnce(new Error('network error'));
    wavespeedService.generateTryOn.mockResolvedValueOnce({ success: true, image: 'data:image/png;base64,xyz' });
    const productName = uniqueName('image-fetch-falls-back');

    const res = await request(app)
      .post('/api/tryon')
      .field('productImageUrl', 'https://example.com/p.jpg')
      .field('productName', productName)
      .attach('userImage', png, 'me.png');

    expect(res.status).toBe(200);
    expect(wavespeedService.generateTryOn).toHaveBeenCalled();

    const log = await waitForLog(productName);
    expect(log.provider).toBe('wavespeed');
  }, 15000);

  it('500s and logs provider "wavespeed" when both Replicate and the WaveSpeed fallback fail', async () => {
    axios.get.mockResolvedValueOnce({ data: png });
    replicateService.generateTryOn.mockRejectedValueOnce(new Error('Replicate is down'));
    wavespeedService.generateTryOn.mockRejectedValueOnce(new Error('WaveSpeed is also down'));
    const productName = uniqueName('both-fail');

    const res = await request(app)
      .post('/api/tryon')
      .field('productImageUrl', 'https://example.com/p.jpg')
      .field('productName', productName)
      .attach('userImage', png, 'me.png');

    expect(res.status).toBe(500);

    const log = await waitForLog(productName);
    expect(log.success).toBe(false);
    // The last attempt made is what gets logged — that's the WaveSpeed
    // fallback, since it's the one whose error actually propagated.
    expect(log.provider).toBe('wavespeed');
  }, 15000);
});

describe('POST /tryon — neither provider configured', () => {
  beforeEach(() => {
    delete process.env.REPLICATE_API_TOKEN;
    delete process.env.WAVESPEED_API_KEY;
  });

  it('500s with a clear config error and never calls either service', async () => {
    const res = await request(app)
      .post('/api/tryon')
      .field('productImageUrl', 'https://example.com/p.jpg')
      .field('productName', uniqueName('no-provider'))
      .attach('userImage', png, 'me.png');

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/no ai fit check provider is configured/i);
    expect(replicateService.generateTryOn).not.toHaveBeenCalled();
    expect(wavespeedService.generateTryOn).not.toHaveBeenCalled();
  });
});

describe('POST /tryon — daily allowance', () => {
  beforeEach(() => {
    process.env.WAVESPEED_API_KEY = 'test-key';
  });

  it('429s and never calls the AI provider when the quota is already exhausted', async () => {
    fitCheckQuota.consume.mockRejectedValueOnce(
      new fitCheckQuota.QuotaExceededError({ limit: 5, used: 5, remaining: 0, resetsInSeconds: 3600 })
    );

    const res = await request(app)
      .post('/api/tryon')
      .field('productImageUrl', 'https://example.com/p.jpg')
      .field('productName', uniqueName('quota-exceeded'))
      .attach('userImage', png, 'me.png');

    expect(res.status).toBe(429);
    expect(res.body.quota).toMatchObject({ limit: 5, remaining: 0 });
    expect(wavespeedService.generateTryOn).not.toHaveBeenCalled();
  });

  it('passes the guest sessionId (not userId) through to the quota check for an unauthenticated request', async () => {
    wavespeedService.generateTryOn.mockResolvedValueOnce({ success: true, image: 'data:image/png;base64,xyz' });

    await request(app)
      .post('/api/tryon')
      .field('productImageUrl', 'https://example.com/p.jpg')
      .field('productName', uniqueName('guest-quota'))
      .field('sessionId', 'test-guest-session-123')
      .attach('userImage', png, 'me.png');

    expect(fitCheckQuota.consume).toHaveBeenCalledWith(
      expect.objectContaining({ userId: undefined, sessionId: 'test-guest-session-123' })
    );
  });
});

describe('GET /tryon/quota', () => {
  it('returns the current allowance status for a guest sessionId', async () => {
    fitCheckQuota.getStatus.mockResolvedValueOnce({ limit: 1, used: 1, remaining: 0, resetsInSeconds: 1800 });

    const res = await request(app).get('/api/tryon/quota').query({ sessionId: 'test-guest-session-456' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ limit: 1, used: 1, remaining: 0, resetsInSeconds: 1800 });
    expect(fitCheckQuota.getStatus).toHaveBeenCalledWith(
      expect.objectContaining({ userId: undefined, sessionId: 'test-guest-session-456' })
    );
  });
});

describe('GET /tryon/admin/bonus-grants/:userId', () => {
  it('returns the grant history and balance for a user (admin-gated)', async () => {
    const grants = [{ id: 'g1', reason: 'admin_grant', amount: 3, consumedCount: 1 }];
    bonusFitCheckGrantRepository.findByUser.mockResolvedValueOnce(grants);
    bonusFitCheckGrantRepository.getBalance.mockResolvedValueOnce(2);

    const res = await request(app).get('/api/tryon/admin/bonus-grants/user-123');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ grants, balance: 2 });
    expect(bonusFitCheckGrantRepository.findByUser).toHaveBeenCalledWith('user-123');
  });
});

describe('POST /tryon/admin/bonus-grant', () => {
  it('grants a positive whole-number amount with reason admin_grant', async () => {
    bonusFitCheckGrantRepository.grant.mockResolvedValueOnce({ id: 'g2', reason: 'admin_grant', amount: 3 });

    const res = await request(app)
      .post('/api/tryon/admin/bonus-grant')
      .send({ userId: 'user-123', amount: 3, note: 'giveaway' });

    expect(res.status).toBe(201);
    expect(bonusFitCheckGrantRepository.grant).toHaveBeenCalledWith('user-123', 'admin_grant', 3, { note: 'giveaway' });
  });

  it('400s on a missing userId or a non-positive amount, without touching the ledger', async () => {
    const noUser = await request(app).post('/api/tryon/admin/bonus-grant').send({ amount: 3 });
    expect(noUser.status).toBe(400);

    const zeroAmount = await request(app).post('/api/tryon/admin/bonus-grant').send({ userId: 'user-123', amount: 0 });
    expect(zeroAmount.status).toBe(400);

    const fractional = await request(app).post('/api/tryon/admin/bonus-grant').send({ userId: 'user-123', amount: 1.5 });
    expect(fractional.status).toBe(400);

    expect(bonusFitCheckGrantRepository.grant).not.toHaveBeenCalled();
  });
});

describe('POST /tryon — sponsored campaigns (Phase 3)', () => {
  it('bypasses the daily quota entirely and logs the campaign when an active campaign covers the product', async () => {
    const product = await prisma.product.create({
      data: {
        name: uniqueName('sponsored'),
        slug: `sponsored-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        description: 'x', price: 500, category: 'jersey', sport: 'basketball', images: [], active: true,
      },
    });
    createdProductIds.push(product.id);

    // A real row, not a fake id — TryOnLog.fitCheckCampaignId is a real FK,
    // so the fire-and-forget log write would otherwise fail its constraint.
    const campaign = await prisma.fitCheckCampaign.create({
      data: { name: 'Test Sponsorship', sponsorName: 'Playtime.ph', headline: 'Unlimited', productIds: [product.id] },
    });
    createdCampaignIds.push(campaign.id);

    fitCheckCampaignRepository.findActiveForProduct.mockResolvedValueOnce({ _id: campaign.id, sponsorName: 'Playtime.ph' });
    wavespeedService.generateTryOn.mockResolvedValueOnce({ success: true, image: 'data:image/png;base64,xyz' });

    const res = await request(app)
      .post('/api/tryon')
      .field('productImageUrl', 'https://example.com/p.jpg')
      .field('productId', product.id)
      .field('productName', product.name)
      .attach('userImage', png, 'me.png');

    expect(res.status).toBe(200);
    expect(fitCheckQuota.consume).not.toHaveBeenCalled();
    expect(fitCheckCampaignRepository.findActiveForProduct).toHaveBeenCalledWith({ productId: product.id, category: 'jersey' });

    const log = await waitForLog(product.name);
    expect(log.fitCheckCampaignId).toBe(campaign.id);
  });

  it('falls through to the normal daily quota when no product is resolved at all', async () => {
    // No productId, and productName matches nothing real — product stays
    // unresolved, so findActiveForProduct is never even reached (its
    // persistent mockResolvedValue(null) default covers this case; no
    // *Once needed, and queuing one here that's never consumed would leak
    // into whichever test runs next).
    wavespeedService.generateTryOn.mockResolvedValueOnce({ success: true, image: 'data:image/png;base64,xyz' });

    await request(app)
      .post('/api/tryon')
      .field('productImageUrl', 'https://example.com/p.jpg')
      .field('productName', uniqueName('unsponsored'))
      .attach('userImage', png, 'me.png');

    expect(fitCheckQuota.consume).toHaveBeenCalled();
    expect(fitCheckCampaignRepository.findActiveForProduct).not.toHaveBeenCalled();
  });
});

describe('GET /tryon/campaigns/active-for-product/:productId', () => {
  it('returns the active campaign covering a product', async () => {
    const product = await prisma.product.create({
      data: {
        name: uniqueName('active-campaign-read'),
        slug: `active-campaign-read-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        description: 'x', price: 500, category: 'jersey', sport: 'basketball', images: [], active: true,
      },
    });
    createdProductIds.push(product.id);
    fitCheckCampaignRepository.findActiveForProduct.mockResolvedValueOnce({ _id: 'campaign-2', sponsorName: 'Playtime.ph' });

    const res = await request(app).get(`/api/tryon/campaigns/active-for-product/${product.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.sponsorName).toBe('Playtime.ph');
  });

  it('returns null (not a 404) when nothing sponsors the product', async () => {
    const product = await prisma.product.create({
      data: {
        name: uniqueName('no-campaign-read'),
        slug: `no-campaign-read-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        description: 'x', price: 500, category: 'jersey', sport: 'basketball', images: [], active: true,
      },
    });
    createdProductIds.push(product.id);
    fitCheckCampaignRepository.findActiveForProduct.mockResolvedValueOnce(null);

    const res = await request(app).get(`/api/tryon/campaigns/active-for-product/${product.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it('404s for an unknown product id', async () => {
    const res = await request(app).get('/api/tryon/campaigns/active-for-product/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});

describe('GET /tryon/trending', () => {
  it('surfaces a recent successful Fit Check for a real product, with no identity fields in the response', async () => {
    const product = await prisma.product.create({
      data: {
        name: uniqueName('trending'),
        slug: `trending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        description: 'x', price: 500, category: 'jersey', sport: 'basketball', images: ['img.jpg'], active: true,
      },
    });
    createdProductIds.push(product.id);
    await prisma.tryOnLog.create({
      data: { productId: product.id, productName: product.name, success: true, sessionId: 'should-never-appear' },
    });

    const res = await request(app).get('/api/tryon/trending');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    const entry = res.body.data.find((p) => p.productId === product.id);
    expect(entry.count).toBeGreaterThan(0);
    expect(Object.keys(entry).sort()).toEqual(['count', 'image', 'name', 'price', 'productId', 'salePrice', 'slug'].sort());
  });
});
