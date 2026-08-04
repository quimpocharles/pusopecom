import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import * as siteSettingsRepository from '../repositories/siteSettingsRepository.js';
import * as venuePickupConfigRepository from '../repositories/venuePickupConfigRepository.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET /api/settings — public
router.get('/', async (req, res) => {
  try {
    const settings = await siteSettingsRepository.get();
    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error({ err: error }, 'Get settings error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
});

// PUT /api/settings — admin only
router.put('/', authenticate, isAdmin, async (req, res) => {
  try {
    // siteSettingsRepository.update() accepts the same { tryOn, tryOnAd,
    // fitCheck } shape the request body already has, and does the partial-
    // merge + flatten-to-columns + reshape-back internally — this route
    // doesn't need to know the database storage shape changed at all.
    const settings = await siteSettingsRepository.update({
      tryOn: req.body.tryOn,
      tryOnAd: req.body.tryOnAd,
      fitCheck: req.body.fitCheck,
    });
    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error({ err: error }, 'Update settings error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
});

// GET /api/settings/venue-pickup — public
router.get('/venue-pickup', async (req, res) => {
  try {
    const config = await venuePickupConfigRepository.get();
    res.json({ success: true, data: config || { enabled: false } });
  } catch (error) {
    logger.error({ err: error }, 'Get venue pickup error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to fetch venue pickup config' });
  }
});

export default router;
