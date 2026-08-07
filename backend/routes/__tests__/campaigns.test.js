import { describe, it, expect, vi, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => { req.user = { _id: 'test-admin', role: 'admin' }; next(); },
  isAdmin: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
  requirePermission: () => (req, res, next) => next(),
  requireAnyPermission: () => (req, res, next) => next(),
}));

const { default: campaignsRouter } = await import('../campaigns.js');

const app = express();
app.use(express.json());
app.use('/api/campaigns', campaignsRouter);

let createdId;
let tryOnCampaignId;
let productId;

afterAll(async () => {
  if (createdId) {
    await prisma.campaign.delete({ where: { id: createdId } }).catch(() => {});
  }
  if (tryOnCampaignId) {
    await prisma.campaign.delete({ where: { id: tryOnCampaignId } }).catch(() => {});
  }
  if (productId) {
    await prisma.product.delete({ where: { id: productId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe('routes/campaigns.js', () => {
  it('POST / creates a campaign', async () => {
    const res = await request(app).post('/api/campaigns').send({
      name: 'Test Campaign',
      headline: 'Game Day Ready',
      featuredOnHomepage: false,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.headline).toBe('Game Day Ready');
    createdId = res.body.data._id;
  });

  it('GET /:id returns the created campaign (admin)', async () => {
    const res = await request(app).get(`/api/campaigns/${createdId}`);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(createdId);
  });

  it('GET /active requires a placement query param', async () => {
    const res = await request(app).get('/api/campaigns/active');
    expect(res.status).toBe(400);
  });

  it('GET /active rejects an unrecognized placement', async () => {
    const res = await request(app).get('/api/campaigns/active?placement=footer');
    expect(res.status).toBe(400);
  });

  it('GET /active?placement=hero does not return this campaign before it is flagged featuredOnHomepage', async () => {
    // Asserting the response is outright null would be fragile against a
    // shared dev database that may legitimately have its own real active
    // hero campaign already — the actual guarantee this test proves is that
    // *this* still-unflagged campaign specifically isn't the one returned.
    const res = await request(app).get('/api/campaigns/active?placement=hero');
    expect(res.status).toBe(200);
    expect(res.body.data?._id).not.toBe(createdId);
  });

  it('GET /active?placement=hero returns the campaign once flagged and in-window (defaults placement=hero)', async () => {
    await request(app).put(`/api/campaigns/${createdId}`).send({ featuredOnHomepage: true });

    const res = await request(app).get('/api/campaigns/active?placement=hero');
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(createdId);
  });

  it('GET /active?placement=tryOn does not return a placement=hero campaign', async () => {
    // Same reasoning as above: a real active tryOn campaign may genuinely
    // exist in the shared dev database (it does — this is what broke CI).
    // The invariant under test is placement isolation, not "nothing active
    // exists" — so assert the hero-flagged campaign specifically doesn't
    // leak into a tryOn query, not that the query returns nothing at all.
    const res = await request(app).get('/api/campaigns/active?placement=tryOn');
    expect(res.status).toBe(200);
    expect(res.body.data?._id).not.toBe(createdId);
    if (res.body.data) {
      expect(res.body.data.placement).toBe('tryOn');
    }
  });

  it('DELETE /:id soft-deletes (active: false), not a real row delete', async () => {
    const res = await request(app).delete(`/api/campaigns/${createdId}`);
    expect(res.status).toBe(200);

    const row = await prisma.campaign.findUnique({ where: { id: createdId } });
    expect(row).not.toBeNull();
    expect(row.active).toBe(false);
  });

  it('PUT /:id on a nonexistent id returns 404', async () => {
    const res = await request(app).put('/api/campaigns/00000000-0000-0000-0000-000000000000').send({ headline: 'x' });
    expect(res.status).toBe(404);
  });

  it('a placement=tryOn campaign resolves its featuredProduct in the active response', async () => {
    const product = await prisma.product.create({
      data: {
        name: 'Campaign Test Jersey',
        slug: `campaign-test-jersey-${Date.now()}`,
        description: 'fixture',
        price: 1000,
        category: 'jersey',
        sport: 'basketball',
        images: ['https://example.com/img.jpg'],
        active: true,
      },
    });
    productId = product.id;

    const created = await request(app).post('/api/campaigns').send({
      placement: 'tryOn',
      name: 'Try-On Test Campaign',
      headline: 'WEAR THE PUSO.',
      beforeImage: 'https://example.com/before.jpg',
      afterImage: 'https://example.com/after.jpg',
      featuredProductId: product.id,
      featuredOnHomepage: true,
    });
    expect(created.status).toBe(201);
    tryOnCampaignId = created.body.data._id;

    const res = await request(app).get('/api/campaigns/active?placement=tryOn');
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(tryOnCampaignId);
    expect(res.body.data.beforeImage).toBe('https://example.com/before.jpg');
    expect(res.body.data.featuredProduct._id).toBe(product.id);
    expect(res.body.data.featuredProduct.slug).toBe(product.slug);
  });
});
