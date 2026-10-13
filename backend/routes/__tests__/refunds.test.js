import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

/**
 * The legacy automated refund route POST /admin/refunds/:id/process was retired
 * in Stage 2, Step 6 (see docs/decisions/0000-decision-log.md, ADR-012). Manual
 * refunds are recorded through POST /:id/record — covered by
 * refundsRecord.test.js and refundsRecordHardening.test.js. This file guards
 * that the old route cannot silently come back without its safeguards.
 */
vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => { req.user = { _id: 'test-admin', role: 'admin' }; next(); },
  isAdmin: (req, res, next) => next(),
  requirePermission: () => (req, res, next) => next(),
  requireAnyPermission: () => (req, res, next) => next(),
}));

const { default: refundsRouter } = await import('../refunds.js');

const app = express();
app.use(express.json());
app.use('/api/admin/refunds', refundsRouter);

describe('POST /admin/refunds/:id/process — retired', () => {
  it('is no longer registered and returns 404', async () => {
    const res = await request(app).post('/api/admin/refunds/00000000-0000-0000-0000-000000000000/process');
    expect(res.status).toBe(404);
  });

  it('returns 404 for any refund id — there is no automated processing route to match', async () => {
    const res = await request(app).post('/api/admin/refunds/any-refund-id/process');
    expect(res.status).toBe(404);
  });
});
