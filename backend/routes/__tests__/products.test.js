import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => {
    req.user = { _id: 'test-admin', role: 'admin', email: req.headers['x-test-email'] || 'admin@test.local' };
    next();
  },
  isAdmin: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
}));

const { default: productsRouter } = await import('../products.js');

const app = express();
app.use(express.json());
app.use('/api/products', productsRouter);

// Every fixture shares this team value so filter/search tests can scope
// their assertions to just this run's data — the live suite runs against
// the real Railway database, which already has real UAAP inventory in it.
const TEAM = `RouteTestTeam-${Date.now()}`;
const MARKER = `RouteTestMarker${Date.now()}`;
const createdIds = [];

async function makeProduct({ name, ...overrides } = {}) {
  const product = await prisma.product.create({
    data: {
      name: `${MARKER} ${name || 'Product'}`,
      slug: `route-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      description: `${MARKER} description`,
      price: 1000,
      category: 'jersey',
      sport: 'basketball',
      gender: 'unisex',
      team: TEAM,
      images: ['https://example.com/img.jpg'],
      active: true,
      totalStock: 10,
      sizes: { create: [{ size: 'M', stock: 10 }] },
      ...overrides,
    },
  });
  createdIds.push(product.id);
  return product;
}

let p1; // jersey, basketball, men, featured, no sale
let p2; // tshirt, volleyball, women, on sale
let p3; // jersey, basketball, men — INACTIVE
let p4; // cap, general sport, unisex — cheap, tests the general/unisex fallback
let p5; // shorts, basketball — complementary-category recommendation target

beforeAll(async () => {
  p1 = await makeProduct({ name: 'P1', category: 'jersey', sport: 'basketball', gender: 'men', price: 1000, featured: true });
  p2 = await makeProduct({ name: 'P2', category: 'tshirt', sport: 'volleyball', gender: 'women', price: 500, salePrice: 400 });
  p3 = await makeProduct({ name: 'P3', category: 'jersey', sport: 'basketball', gender: 'men', price: 2000, active: false });
  p4 = await makeProduct({ name: 'P4', category: 'cap', sport: 'general', gender: 'unisex', price: 300 });
  p5 = await makeProduct({ name: 'P5', category: 'shorts', sport: 'basketball', gender: 'unisex', price: 300 });
}, 30000);

afterAll(async () => {
  await prisma.product.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.$disconnect();
});

describe('GET /products (public listing)', () => {
  it('returns only active products for a plain team filter', async () => {
    const res = await request(app).get(`/api/products?team=${encodeURIComponent(TEAM)}&limit=50`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((p) => p._id);
    expect(ids).toEqual(expect.arrayContaining([p1.id, p2.id, p4.id, p5.id]));
    expect(ids).not.toContain(p3.id); // inactive, excluded
  });

  it('category filter', async () => {
    const res = await request(app).get(`/api/products?team=${encodeURIComponent(TEAM)}&category=jersey&limit=50`);
    const ids = res.body.data.map((p) => p._id);
    expect(ids).toEqual([p1.id]); // p3 is also jersey but inactive
  });

  it('sport filter also matches sport=general fallback items', async () => {
    const res = await request(app).get(`/api/products?team=${encodeURIComponent(TEAM)}&sport=volleyball&limit=50`);
    const ids = res.body.data.map((p) => p._id);
    expect(ids).toEqual(expect.arrayContaining([p2.id, p4.id])); // p4 is 'general'
    expect(ids).not.toContain(p1.id); // basketball, not volleyball or general
  });

  it('gender filter also matches gender=unisex fallback items', async () => {
    const res = await request(app).get(`/api/products?team=${encodeURIComponent(TEAM)}&gender=women&limit=50`);
    const ids = res.body.data.map((p) => p._id);
    expect(ids).toEqual(expect.arrayContaining([p2.id, p4.id, p5.id])); // p4, p5 are unisex
    expect(ids).not.toContain(p1.id); // men
  });

  it('sale=true filters to products with a positive salePrice', async () => {
    const res = await request(app).get(`/api/products?team=${encodeURIComponent(TEAM)}&sale=true&limit=50`);
    const ids = res.body.data.map((p) => p._id);
    expect(ids).toEqual([p2.id]);
  });

  it('featured=true filters to featured products', async () => {
    const res = await request(app).get(`/api/products?team=${encodeURIComponent(TEAM)}&featured=true&limit=50`);
    const ids = res.body.data.map((p) => p._id);
    expect(ids).toEqual([p1.id]);
  });

  it('price range matches effective price (salePrice when set, else price)', async () => {
    const res = await request(app)
      .get(`/api/products?team=${encodeURIComponent(TEAM)}&minPrice=250&maxPrice=600&limit=50`);
    const ids = res.body.data.map((p) => p._id);
    expect(ids).toEqual(expect.arrayContaining([p2.id, p4.id, p5.id])); // p2's effective price is 400 (salePrice)
    expect(ids).not.toContain(p1.id); // 1000, out of range
  });

  it('search= runs the full-text path and still respects the other filters and active flag', async () => {
    const res = await request(app)
      .get(`/api/products?team=${encodeURIComponent(TEAM)}&search=${encodeURIComponent(MARKER)}&limit=50`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((p) => p._id);
    expect(ids).toEqual(expect.arrayContaining([p1.id, p2.id, p4.id, p5.id]));
    expect(ids).not.toContain(p3.id); // inactive, excluded even via search
  });

  it('search= combined with a category filter narrows correctly', async () => {
    const res = await request(app)
      .get(`/api/products?team=${encodeURIComponent(TEAM)}&search=${encodeURIComponent(MARKER)}&category=shorts&limit=50`);
    const ids = res.body.data.map((p) => p._id);
    expect(ids).toEqual([p5.id]);
  });

  it('search= for a term that matches nothing returns an empty page, not an error', async () => {
    const res = await request(app).get(`/api/products?search=${encodeURIComponent('zzz-no-such-term-zzz-xyzzy')}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });
});

describe('GET /products/:slug (public detail)', () => {
  it('returns an active product by slug', async () => {
    const res = await request(app).get(`/api/products/${p1.slug}`);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(p1.id);
  });

  it('404s for an inactive product slug', async () => {
    const res = await request(app).get(`/api/products/${p3.slug}`);
    expect(res.status).toBe(404);
  });

  it('404s for a slug that does not exist', async () => {
    const res = await request(app).get('/api/products/not-a-real-slug');
    expect(res.status).toBe(404);
  });
});

describe('GET /products/search/suggestions', () => {
  it('returns matching suggestions for a partial name', async () => {
    const res = await request(app).get(`/api/products/search/suggestions?q=${encodeURIComponent(MARKER + ' P1')}`);
    expect(res.status).toBe(200);
    expect(res.body.data.some((s) => s.slug === p1.slug)).toBe(true);
  });

  it('returns an empty list for a too-short query', async () => {
    const res = await request(app).get('/api/products/search/suggestions?q=a');
    expect(res.body.data).toEqual([]);
  });
});

describe('GET /products/recommendations/cart', () => {
  it('recommends a complementary-category product in the same sport', async () => {
    // limit is generous — the real UAAP catalog already has plenty of real
    // basketball accessories, so a small limit makes whether p5 lands in
    // the top N nondeterministic against production data, not a real bug.
    const res = await request(app).get(`/api/products/recommendations/cart?cartProductIds=${p1.id}&limit=200`);
    expect(res.status).toBe(200);
    expect(res.body.data.some((p) => p._id === p5.id)).toBe(true); // shorts complements jersey
    expect(res.body.data.some((p) => p._id === p1.id)).toBe(false); // never recommends what's already in cart
  });

  it('returns an empty list with no cartProductIds', async () => {
    const res = await request(app).get('/api/products/recommendations/cart');
    expect(res.body.data).toEqual([]);
  });
});

describe('admin routes', () => {
  it('GET /admin/all includes inactive products and supports name/team search', async () => {
    const res = await request(app)
      .get(`/api/products/admin/all?search=${encodeURIComponent(MARKER + ' P3')}`);
    expect(res.status).toBe(200);
    expect(res.body.data.some((p) => p._id === p3.id)).toBe(true);
  });

  it('GET /admin/:id returns an inactive product (unlike the public :slug route)', async () => {
    const res = await request(app).get(`/api/products/admin/${p3.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(false);
  });

  it('GET /admin/:id 404s for a non-existent id', async () => {
    const res = await request(app).get('/api/products/admin/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('GET /admin/export returns CSV including a known test product', async () => {
    const res = await request(app).get('/api/products/admin/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain(`${MARKER} P1`);
  });

  it('GET /admin/stats is unreachable — a pre-existing route-ordering bug carried forward as-is, not fixed here', async () => {
    // /admin/:id is registered before /admin/stats (same order as the
    // original Mongoose route file), so Express matches /admin/:id first
    // and treats "stats" as the :id param. This means this endpoint has
    // never actually returned real stats in production — it's also
    // unused by the frontend today. Preserved exactly as found; flagged
    // separately rather than silently reordered as part of this migration.
    const res = await request(app).get('/api/products/admin/stats');
    expect(res.status).not.toBe(200);
  });

  it('POST / creates a product (admin only)', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({
        name: `${MARKER} Created`,
        description: 'x',
        price: 100,
        category: 'jersey',
        sport: 'basketball',
        images: ['https://example.com/a.jpg'],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBeTypeOf('string');
    createdIds.push(res.body.data._id);
  });

  it('POST / accepts the apparel categories added for the UAAP import (jacket/sweatshirt/hoodie)', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({
        name: `${MARKER} Hoodie`,
        description: 'x',
        price: 100,
        category: 'hoodie',
        sport: 'general',
        images: ['https://example.com/a.jpg'],
      });
    expect(res.status).toBe(201);
    createdIds.push(res.body.data._id);
  });

  it('POST / rejects an invalid category', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ name: 'x', description: 'x', price: 100, category: 'not-a-category', sport: 'basketball', images: ['a'] });
    expect(res.status).toBe(400);
  });

  it('POST / with a duplicate-generating name returns 400, not 500 (P2002 translated)', async () => {
    const payload = {
      name: `${MARKER} DupSlug`,
      description: 'x', price: 100, category: 'jersey', sport: 'basketball', images: ['a'],
    };
    const first = await request(app).post('/api/products').send(payload);
    expect(first.status).toBe(201);
    createdIds.push(first.body.data._id);

    const second = await request(app).post('/api/products').send(payload);
    expect(second.status).toBe(400);
    expect(second.body.message).toMatch(/slug already exists/i);
  });

  it('PUT /:id replaces sizes/colors wholesale', async () => {
    const res = await request(app)
      .put(`/api/products/${p2.id}`)
      .send({ colors: [{ color: 'Navy', hex: '#000080', sizes: [{ size: 'L', stock: 20 }] }] });
    expect(res.status).toBe(200);
    expect(res.body.data.colors).toHaveLength(1);
    expect(res.body.data.colors[0].color).toBe('Navy');
  }, 15000);

  it('PUT /:id 404s for a non-existent product (P2025 translated)', async () => {
    const res = await request(app).put('/api/products/00000000-0000-0000-0000-000000000000').send({ price: 1 });
    expect(res.status).toBe(404);
  });

  it('DELETE /:id soft-deletes — the product still exists but is excluded from the public listing', async () => {
    const target = await makeProduct({ name: 'ToSoftDelete' });
    const res = await request(app).delete(`/api/products/${target.id}`);
    expect(res.status).toBe(200);

    const slugRes = await request(app).get(`/api/products/${target.slug}`);
    expect(slugRes.status).toBe(404);

    const adminRes = await request(app).get(`/api/products/admin/${target.id}`);
    expect(adminRes.body.data.active).toBe(false);
  }, 15000);

  it('DELETE /:id/permanent requires the superadmin email, even for another admin', async () => {
    const target = await makeProduct({ name: 'ToHardDeleteDenied' });
    const res = await request(app).delete(`/api/products/${target.id}/permanent`);
    expect(res.status).toBe(403);

    const stillThere = await request(app).get(`/api/products/admin/${target.id}`);
    expect(stillThere.status).toBe(200);
  });

  it('DELETE /:id/permanent actually removes the row for the superadmin', async () => {
    const target = await makeProduct({ name: 'ToHardDelete' });
    const res = await request(app)
      .delete(`/api/products/${target.id}/permanent`)
      .set('x-test-email', 'quimpo.charles@gmail.com');
    expect(res.status).toBe(200);

    const gone = await request(app).get(`/api/products/admin/${target.id}`);
    expect(gone.status).toBe(404);
  }, 15000);
});
