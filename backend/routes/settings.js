import express from 'express';
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
    console.error('Get settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
});

// PUT /api/settings — admin only
router.put('/', authenticate, isAdmin, async (req, res) => {
  try {
    // siteSettingsRepository.update() accepts the same { tryOn, tryOnAd }
    // shape the request body already has, and does the partial-merge +
    // flatten-to-columns + reshape-back internally — this route doesn't
    // need to know the database storage shape changed at all.
    const settings = await siteSettingsRepository.update({
      tryOn: req.body.tryOn,
      tryOnAd: req.body.tryOnAd,
    });
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
});

// GET /api/settings/venue-pickup — public
router.get('/venue-pickup', async (req, res) => {
  try {
    const config = await venuePickupConfigRepository.get();
    res.json({ success: true, data: config || { enabled: false } });
  } catch (error) {
    console.error('Get venue pickup error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch venue pickup config' });
  }
});

export default router;
