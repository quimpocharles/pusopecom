import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import * as homepageSectionRepository from '../repositories/homepageSectionRepository.js';
import { authenticate, isAdmin, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../lib/permissions.js';

const router = express.Router();

// List every homepage section, in display order (public — Home.jsx will read this from Milestone 3 onward)
router.get('/', async (req, res) => {
  try {
    const sections = await homepageSectionRepository.list();
    res.json({ success: true, data: sections });
  } catch (error) {
    logger.error({ err: error }, 'Get homepage sections error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve homepage sections' });
  }
});

// Bulk reorder / bulk visibility update (admin) — body: [{ key, displayOrder, active? }, ...]
router.put('/', authenticate, isAdmin, requirePermission(PERMISSIONS.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const sections = Array.isArray(req.body?.sections) ? req.body.sections : req.body;
    if (!Array.isArray(sections)) {
      return res.status(400).json({ success: false, message: 'Expected an array of sections' });
    }
    const updated = await homepageSectionRepository.upsertMany(sections);
    res.json({ success: true, message: 'Homepage sections updated successfully', data: updated });
  } catch (error) {
    logger.error({ err: error }, 'Update homepage sections error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update homepage sections' });
  }
});

// Toggle a single section's visibility (admin)
router.patch('/:key', authenticate, isAdmin, requirePermission(PERMISSIONS.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const { active } = req.body;
    const section = await homepageSectionRepository.setActive(req.params.key, active);
    res.json({ success: true, message: 'Homepage section updated successfully', data: section });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Homepage section not found' });
    }
    logger.error({ err: error }, 'Toggle homepage section error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update homepage section' });
  }
});

export default router;
