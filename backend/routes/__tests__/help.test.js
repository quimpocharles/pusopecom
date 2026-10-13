import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { HELP_CATEGORIES, HELP_ARTICLES } from '../../data/helpCenterContent.js';

// Content is static (no Prisma model), so unlike most route tests this one
// needs no database at all. Only `authenticate` is mocked, to make
// req.user's staffProfile controllable — `isAdmin` is the REAL middleware,
// same convention as routes/__tests__/returnsPermissions.test.js. The
// generic "no token" / "deactivated account" behavior of authenticate+
// isAdmin themselves is already proven end-to-end by
// middleware/__tests__/staffActiveIntegration.test.js against the real DB;
// this file's job is the one thing specific to help.js: that NO
// requirePermission() gates any route here — every department, including
// one with no help-related permission at all, gets the same content.

let currentUser;

vi.mock('../../middleware/auth.js', async () => {
  const actual = await vi.importActual('../../middleware/auth.js');
  return {
    ...actual,
    authenticate: (req, res, next) => { req.user = currentUser; next(); },
  };
});

const { default: helpRouter } = await import('../help.js');
const app = express();
app.use(express.json());
app.use('/api/admin/help', helpRouter);

function asDept(department, extra = {}) {
  currentUser = { _id: 'help-test-admin', role: 'admin', staffProfile: { department, active: true, permissions: [], ...extra } };
}

function asCustomer() {
  currentUser = { _id: 'help-test-customer', role: 'customer' };
}

describe('routes/help.js', () => {
  it('a non-admin (customer) role is rejected with 403, even for this non-sensitive content', async () => {
    asCustomer();
    const res = await request(app).get('/api/admin/help/categories');
    expect(res.status).toBe(403);
  });

  it('a deactivated staff account is rejected with 403', async () => {
    asDept('warehouse', { active: false });
    const res = await request(app).get('/api/admin/help/categories');
    expect(res.status).toBe(403);
  });

  it('GET /categories returns every category with a positive article count, for ANY department — no permission required', async () => {
    for (const dept of ['finance', 'operations', 'warehouse', 'marketing', 'support', 'scanner', 'order_management']) {
      asDept(dept);
      const res = await request(app).get('/api/admin/help/categories');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(HELP_CATEGORIES.length);
      for (const category of res.body.data) {
        expect(typeof category.articleCount).toBe('number');
        expect(category.articleCount).toBeGreaterThan(0);
      }
    }
  });

  it('GET /articles returns the full list for a narrow department with no other admin permissions at all', async () => {
    asDept('scanner'); // scanner's only permission is passes.checkin — nothing help-related
    const res = await request(app).get('/api/admin/help/articles');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(HELP_ARTICLES.length);
  });

  it('GET /articles?category= filters to that category only', async () => {
    asDept('finance');
    const res = await request(app).get('/api/admin/help/articles').query({ category: 'returns-refunds' });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((a) => a.categoryId === 'returns-refunds')).toBe(true);
  });

  it('GET /articles?q= searches title, summary, keywords, and body text', async () => {
    asDept('finance');
    const res = await request(app).get('/api/admin/help/articles').query({ q: 'ePayGames' });
    expect(res.status).toBe(200);
    expect(res.body.data.some((a) => a.slug === 'recording-and-adjusting-refunds')).toBe(true);
  });

  it('GET /articles?q= is case-insensitive and returns an empty list gracefully for no matches', async () => {
    asDept('finance');
    const res = await request(app).get('/api/admin/help/articles').query({ q: 'ZZZ_NO_MATCH_ZZZ' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('GET /articles/:slug returns the full article body', async () => {
    asDept('finance');
    const res = await request(app).get('/api/admin/help/articles/recording-and-adjusting-refunds');
    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe('recording-and-adjusting-refunds');
    expect(Array.isArray(res.body.data.body)).toBe(true);
    expect(res.body.data.body.length).toBeGreaterThan(0);
  });

  it('GET /articles/:slug 404s for an unknown slug', async () => {
    asDept('finance');
    const res = await request(app).get('/api/admin/help/articles/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('every article belongs to a real category (content integrity)', () => {
    const categoryIds = new Set(HELP_CATEGORIES.map((c) => c.id));
    for (const article of HELP_ARTICLES) {
      expect(categoryIds.has(article.categoryId)).toBe(true);
    }
  });

  it('every slug is unique (content integrity)', () => {
    const slugs = HELP_ARTICLES.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
