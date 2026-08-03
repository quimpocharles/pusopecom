import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import * as footerSettingsRepository from '../repositories/footerSettingsRepository.js';
import * as footerLinkRepository from '../repositories/footerLinkRepository.js';
import * as socialLinkRepository from '../repositories/socialLinkRepository.js';
import * as paymentIconRepository from '../repositories/paymentIconRepository.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Everything the public footer needs, in one call (public)
router.get('/', async (req, res) => {
  try {
    const [settings, linkGroups, socialLinks, paymentIcons] = await Promise.all([
      footerSettingsRepository.get(),
      footerLinkRepository.findActiveGrouped(),
      socialLinkRepository.findActive(),
      paymentIconRepository.findActive(),
    ]);
    res.json({ success: true, data: { settings, linkGroups, socialLinks, paymentIcons } });
  } catch (error) {
    logger.error({ err: error }, 'Get footer content error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve footer content' });
  }
});

// ── Settings (company description / copyright) ─────────────────────────
router.get('/settings', authenticate, isAdmin, async (req, res) => {
  try {
    const settings = await footerSettingsRepository.get();
    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error({ err: error }, 'Get footer settings error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve footer settings' });
  }
});

router.put('/settings', authenticate, isAdmin, async (req, res) => {
  try {
    const settings = await footerSettingsRepository.update(req.body);
    res.json({ success: true, message: 'Footer settings updated successfully', data: settings });
  } catch (error) {
    logger.error({ err: error }, 'Update footer settings error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update footer settings' });
  }
});

// ── Footer links (grouped by groupLabel, e.g. "Shop" / "Legal") ────────
router.get('/links/admin/all', authenticate, isAdmin, async (req, res) => {
  try {
    const links = await footerLinkRepository.find({ orderBy: [{ groupLabel: 'asc' }, { displayOrder: 'asc' }] });
    res.json({ success: true, data: links });
  } catch (error) {
    logger.error({ err: error }, 'Get admin footer links error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve footer links' });
  }
});

router.post('/links', authenticate, isAdmin, async (req, res) => {
  try {
    const link = await footerLinkRepository.create(req.body);
    res.status(201).json({ success: true, message: 'Footer link created successfully', data: link });
  } catch (error) {
    logger.error({ err: error }, 'Create footer link error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to create footer link' });
  }
});

router.put('/links/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const link = await footerLinkRepository.updateById(req.params.id, req.body);
    res.json({ success: true, message: 'Footer link updated successfully', data: link });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Footer link not found' });
    logger.error({ err: error }, 'Update footer link error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update footer link' });
  }
});

router.delete('/links/:id', authenticate, isAdmin, async (req, res) => {
  try {
    await footerLinkRepository.deleteById(req.params.id);
    res.json({ success: true, message: 'Footer link deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Footer link not found' });
    logger.error({ err: error }, 'Delete footer link error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to delete footer link' });
  }
});

// ── Social links ─────────────────────────────────────────────────────
router.get('/social/admin/all', authenticate, isAdmin, async (req, res) => {
  try {
    const links = await socialLinkRepository.find({ orderBy: { displayOrder: 'asc' } });
    res.json({ success: true, data: links });
  } catch (error) {
    logger.error({ err: error }, 'Get admin social links error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve social links' });
  }
});

router.post('/social', authenticate, isAdmin, async (req, res) => {
  try {
    const link = await socialLinkRepository.create(req.body);
    res.status(201).json({ success: true, message: 'Social link created successfully', data: link });
  } catch (error) {
    logger.error({ err: error }, 'Create social link error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to create social link' });
  }
});

router.put('/social/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const link = await socialLinkRepository.updateById(req.params.id, req.body);
    res.json({ success: true, message: 'Social link updated successfully', data: link });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Social link not found' });
    logger.error({ err: error }, 'Update social link error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update social link' });
  }
});

router.delete('/social/:id', authenticate, isAdmin, async (req, res) => {
  try {
    await socialLinkRepository.deleteById(req.params.id);
    res.json({ success: true, message: 'Social link deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Social link not found' });
    logger.error({ err: error }, 'Delete social link error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to delete social link' });
  }
});

// ── Payment icons ────────────────────────────────────────────────────
router.get('/payment-icons/admin/all', authenticate, isAdmin, async (req, res) => {
  try {
    const icons = await paymentIconRepository.find({ orderBy: { displayOrder: 'asc' } });
    res.json({ success: true, data: icons });
  } catch (error) {
    logger.error({ err: error }, 'Get admin payment icons error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve payment icons' });
  }
});

router.post('/payment-icons', authenticate, isAdmin, async (req, res) => {
  try {
    const icon = await paymentIconRepository.create(req.body);
    res.status(201).json({ success: true, message: 'Payment icon created successfully', data: icon });
  } catch (error) {
    logger.error({ err: error }, 'Create payment icon error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to create payment icon' });
  }
});

router.put('/payment-icons/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const icon = await paymentIconRepository.updateById(req.params.id, req.body);
    res.json({ success: true, message: 'Payment icon updated successfully', data: icon });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Payment icon not found' });
    logger.error({ err: error }, 'Update payment icon error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update payment icon' });
  }
});

router.delete('/payment-icons/:id', authenticate, isAdmin, async (req, res) => {
  try {
    await paymentIconRepository.deleteById(req.params.id);
    res.json({ success: true, message: 'Payment icon deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Payment icon not found' });
    logger.error({ err: error }, 'Delete payment icon error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to delete payment icon' });
  }
});

export default router;
