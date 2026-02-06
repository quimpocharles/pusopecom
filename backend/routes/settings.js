import express from 'express';
import SiteSettings from '../models/SiteSettings.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET /api/settings — public
router.get('/', async (req, res) => {
  try {
    const settings = await SiteSettings.get();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
});

// PUT /api/settings — admin only
router.put('/', authenticate, isAdmin, async (req, res) => {
  try {
    const settings = await SiteSettings.get();
    if (req.body.tryOn) {
      Object.assign(settings.tryOn, req.body.tryOn);
    }
    await settings.save();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
});

export default router;
