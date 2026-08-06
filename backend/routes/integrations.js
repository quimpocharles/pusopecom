import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate, isAdmin);

/**
 * Settings IA redesign — a read-only status page for what's genuinely
 * .env-only today (Maya, Cloudinary, the AI provider, Redis, Email). Never
 * returns a secret value, never accepts a write — presence-only, the same
 * "connected or not" signal an ops person actually needs. AI provider
 * mirrors routes/tryon.js's own real selection logic (WAVESPEED_API_KEY
 * present -> WaveSpeed, else REPLICATE_API_TOKEN -> Replicate) rather than
 * reporting both independently, since only one is ever actually active.
 */
router.get('/status', (req, res) => {
  try {
    const aiProvider = process.env.WAVESPEED_API_KEY
      ? 'WaveSpeed'
      : process.env.REPLICATE_API_TOKEN
      ? 'Replicate'
      : null;

    const integrations = [
      {
        name: 'Maya',
        connected: Boolean(process.env.MAYA_PUBLIC_KEY && process.env.MAYA_SECRET_KEY),
        detail: 'Payment checkout & status polling',
      },
      {
        name: 'Cloudinary',
        connected: Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
        detail: 'Media storage, transformation & delivery',
      },
      {
        name: 'AI Provider',
        connected: Boolean(aiProvider),
        detail: aiProvider ? `Active: ${aiProvider}` : 'Fit Check generation has no provider configured',
      },
      {
        name: 'Redis',
        connected: Boolean(process.env.REDIS_URL),
        detail: 'Rate limiting, session cache, async jobs',
      },
      {
        name: 'Email',
        connected: Boolean(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD),
        detail: 'Transactional email (order, payment, notification)',
      },
    ];

    res.json({ success: true, data: integrations });
  } catch (error) {
    logger.error({ err: error }, 'Get integrations status error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to check integration status' });
  }
});

export default router;
