import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => { req.user = { _id: 'test-admin', role: 'admin' }; next(); },
  isAdmin: (req, res, next) => next(),
}));

const { default: integrationsRouter } = await import('../integrations.js');

const app = express();
app.use(express.json());
app.use('/api/admin/integrations', integrationsRouter);

const ENV_KEYS = [
  'MAYA_PUBLIC_KEY', 'MAYA_SECRET_KEY',
  'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET',
  'WAVESPEED_API_KEY', 'REPLICATE_API_TOKEN',
  'REDIS_URL',
  'EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASSWORD',
];
let originalEnv;

beforeEach(() => {
  originalEnv = {};
  for (const key of ENV_KEYS) { originalEnv[key] = process.env[key]; delete process.env[key]; }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

describe('GET /admin/integrations/status', () => {
  it('reports every integration as not connected when no env vars are set, and never leaks a value', async () => {
    const res = await request(app).get('/api/admin/integrations/status');
    expect(res.status).toBe(200);
    expect(res.body.data.every((i) => i.connected === false)).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/dummy-|test-key/); // sanity: no leaked secret-shaped value
    const names = res.body.data.map((i) => i.name);
    expect(names).toEqual(['Maya', 'Cloudinary', 'AI Provider', 'Redis', 'Email']);
  });

  it('reports Maya connected only when both keys are present', async () => {
    process.env.MAYA_PUBLIC_KEY = 'x';
    const partial = await request(app).get('/api/admin/integrations/status');
    expect(partial.body.data.find((i) => i.name === 'Maya').connected).toBe(false);

    process.env.MAYA_SECRET_KEY = 'y';
    const complete = await request(app).get('/api/admin/integrations/status');
    expect(complete.body.data.find((i) => i.name === 'Maya').connected).toBe(true);
  });

  it('prefers WaveSpeed over Replicate when both are configured, matching routes/tryon.js\'s real selection', async () => {
    process.env.WAVESPEED_API_KEY = 'w';
    process.env.REPLICATE_API_TOKEN = 'r';
    const res = await request(app).get('/api/admin/integrations/status');
    const ai = res.body.data.find((i) => i.name === 'AI Provider');
    expect(ai.connected).toBe(true);
    expect(ai.detail).toMatch(/WaveSpeed/);
  });

  it('falls back to Replicate when only it is configured', async () => {
    process.env.REPLICATE_API_TOKEN = 'r';
    const res = await request(app).get('/api/admin/integrations/status');
    const ai = res.body.data.find((i) => i.name === 'AI Provider');
    expect(ai.connected).toBe(true);
    expect(ai.detail).toMatch(/Replicate/);
  });
});
