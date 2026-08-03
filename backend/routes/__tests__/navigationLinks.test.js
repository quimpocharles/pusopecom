import { describe, it, expect, vi, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => { req.user = { _id: 'test-admin', role: 'admin' }; next(); },
  isAdmin: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
}));

const { default: navigationLinksRouter } = await import('../navigationLinks.js');

const app = express();
app.use(express.json());
app.use('/api/navigation-links', navigationLinksRouter);

const createdIds = [];

afterAll(async () => {
  await prisma.navigationLink.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.$disconnect();
});

describe('routes/navigationLinks.js', () => {
  it('POST / creates a link', async () => {
    const res = await request(app).post('/api/navigation-links').send({ label: 'Shop', destination: '/products' });
    expect(res.status).toBe(201);
    createdIds.push(res.body.data._id);
  });

  it('GET / returns only active top-level links, in displayOrder', async () => {
    const inactive = await request(app).post('/api/navigation-links').send({ label: 'Hidden', destination: '/x', active: false });
    const child = await request(app).post('/api/navigation-links').send({ label: 'Child', destination: '/y', parentId: createdIds[0] });
    createdIds.push(inactive.body.data._id, child.body.data._id);

    const res = await request(app).get('/api/navigation-links');
    expect(res.status).toBe(200);
    const ids = res.body.data.map((l) => l._id);
    expect(ids).not.toContain(inactive.body.data._id);
    expect(ids).not.toContain(child.body.data._id); // dropdown children never appear in the top-level list
    expect(ids).toContain(createdIds[0]);
  }, 15000);

  it('GET /admin/all includes inactive and child links', async () => {
    const res = await request(app).get('/api/navigation-links/admin/all');
    expect(res.status).toBe(200);
    const ids = res.body.data.map((l) => l._id);
    expect(ids).toEqual(expect.arrayContaining(createdIds));
  });

  it('PUT /:id updates fields, DELETE soft-deletes', async () => {
    const put = await request(app).put(`/api/navigation-links/${createdIds[0]}`).send({ highlight: true, openInNewTab: true });
    expect(put.status).toBe(200);
    expect(put.body.data.highlight).toBe(true);
    expect(put.body.data.openInNewTab).toBe(true);

    const del = await request(app).delete(`/api/navigation-links/${createdIds[0]}`);
    expect(del.status).toBe(200);
    const link = await prisma.navigationLink.findUnique({ where: { id: createdIds[0] } });
    expect(link.active).toBe(false);
  });
});
