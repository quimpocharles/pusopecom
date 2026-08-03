import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => { req.user = { _id: 'test-admin', role: 'admin' }; next(); },
  isAdmin: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
}));

const { default: footerRouter } = await import('../footer.js');

const app = express();
app.use(express.json());
app.use('/api/footer', footerRouter);

const createdLinkIds = [];
const createdSocialIds = [];
const createdPaymentIds = [];

// FooterSettings is a real singleton (find-or-create, same as
// SiteSettings) — the PUT test below mutates the one real row rather than
// creating a fixture, so its prior values must be captured and restored,
// not just left overwritten with test data.
let originalSettings;

beforeAll(async () => {
  originalSettings = await prisma.footerSettings.findFirst();
});

afterAll(async () => {
  await prisma.footerLink.deleteMany({ where: { id: { in: createdLinkIds } } });
  await prisma.socialLink.deleteMany({ where: { id: { in: createdSocialIds } } });
  await prisma.paymentIcon.deleteMany({ where: { id: { in: createdPaymentIds } } });
  if (originalSettings) {
    await prisma.footerSettings.update({
      where: { id: originalSettings.id },
      data: { companyDescription: originalSettings.companyDescription, copyrightText: originalSettings.copyrightText },
    });
  }
  await prisma.$disconnect();
});

describe('GET /footer — composite public read', () => {
  it('returns settings, grouped links, social links, and payment icons', async () => {
    const res = await request(app).get('/api/footer');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('settings');
    expect(res.body.data).toHaveProperty('linkGroups');
    expect(res.body.data).toHaveProperty('socialLinks');
    expect(res.body.data).toHaveProperty('paymentIcons');
  });
});

describe('PUT /footer/settings', () => {
  it('updates the singleton', async () => {
    const res = await request(app).put('/api/footer/settings').send({ companyDescription: 'Test description', copyrightText: 'Test Co. All rights reserved.' });
    expect(res.status).toBe(200);
    expect(res.body.data.companyDescription).toBe('Test description');

    const publicRes = await request(app).get('/api/footer');
    expect(publicRes.body.data.settings.companyDescription).toBe('Test description');
  });
});

describe('Footer links CRUD and grouping', () => {
  it('creates links in two groups and the public read groups them correctly', async () => {
    const shop1 = await request(app).post('/api/footer/links').send({ groupLabel: 'Shop', label: 'Basketball', destination: '/products?sport=basketball' });
    const shop2 = await request(app).post('/api/footer/links').send({ groupLabel: 'Shop', label: 'Volleyball', destination: '/products?sport=volleyball' });
    const legal1 = await request(app).post('/api/footer/links').send({ groupLabel: 'Legal', label: 'Privacy', destination: '/privacy' });
    createdLinkIds.push(shop1.body.data._id, shop2.body.data._id, legal1.body.data._id);

    const res = await request(app).get('/api/footer');
    const shopGroup = res.body.data.linkGroups.find((g) => g.groupLabel === 'Shop');
    const legalGroup = res.body.data.linkGroups.find((g) => g.groupLabel === 'Legal');
    expect(shopGroup.links.map((l) => l.label)).toEqual(expect.arrayContaining(['Basketball', 'Volleyball']));
    expect(legalGroup.links.map((l) => l.label)).toContain('Privacy');
  }, 15000);

  it('PUT updates, DELETE soft-deletes, 404s for unknown id', async () => {
    const put = await request(app).put(`/api/footer/links/${createdLinkIds[0]}`).send({ label: 'Renamed' });
    expect(put.status).toBe(200);
    expect(put.body.data.label).toBe('Renamed');

    const del = await request(app).delete(`/api/footer/links/${createdLinkIds[0]}`);
    expect(del.status).toBe(200);
    const link = await prisma.footerLink.findUnique({ where: { id: createdLinkIds[0] } });
    expect(link.active).toBe(false);

    const notFound = await request(app).put('/api/footer/links/00000000-0000-0000-0000-000000000000').send({ label: 'x' });
    expect(notFound.status).toBe(404);
  });
});

describe('Social links CRUD', () => {
  it('creates, lists active-only publicly, updates, deletes', async () => {
    const created = await request(app).post('/api/footer/social').send({ platform: 'facebook', url: 'https://facebook.com/test' });
    createdSocialIds.push(created.body.data._id);

    const publicRes = await request(app).get('/api/footer');
    expect(publicRes.body.data.socialLinks.some((s) => s._id === created.body.data._id)).toBe(true);

    await request(app).delete(`/api/footer/social/${created.body.data._id}`);
    const afterDelete = await request(app).get('/api/footer');
    expect(afterDelete.body.data.socialLinks.some((s) => s._id === created.body.data._id)).toBe(false);
  }, 15000);
});

describe('Payment icons CRUD', () => {
  it('creates, lists active-only publicly, updates, deletes', async () => {
    const created = await request(app).post('/api/footer/payment-icons').send({ label: 'Maya' });
    createdPaymentIds.push(created.body.data._id);

    const publicRes = await request(app).get('/api/footer');
    expect(publicRes.body.data.paymentIcons.some((p) => p._id === created.body.data._id)).toBe(true);

    await request(app).delete(`/api/footer/payment-icons/${created.body.data._id}`);
    const afterDelete = await request(app).get('/api/footer');
    expect(afterDelete.body.data.paymentIcons.some((p) => p._id === created.body.data._id)).toBe(false);
  }, 15000);
});
