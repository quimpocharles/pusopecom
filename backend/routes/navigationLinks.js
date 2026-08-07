import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import * as navigationLinkRepository from '../repositories/navigationLinkRepository.js';
import { authenticate, isAdmin, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../lib/permissions.js';

const router = express.Router();

// Active top-level links, in order (public)
router.get('/', async (req, res) => {
  try {
    const links = await navigationLinkRepository.findActive();
    res.json({ success: true, data: links });
  } catch (error) {
    logger.error({ err: error }, 'Get navigation links error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve navigation links' });
  }
});

// All links including inactive (admin)
router.get('/admin/all', authenticate, isAdmin, requirePermission(PERMISSIONS.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const links = await navigationLinkRepository.find({ orderBy: { displayOrder: 'asc' } });
    res.json({ success: true, data: links });
  } catch (error) {
    logger.error({ err: error }, 'Get admin navigation links error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve navigation links' });
  }
});

router.post('/', authenticate, isAdmin, requirePermission(PERMISSIONS.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const link = await navigationLinkRepository.create(req.body);
    res.status(201).json({ success: true, message: 'Navigation link created successfully', data: link });
  } catch (error) {
    logger.error({ err: error }, 'Create navigation link error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to create navigation link' });
  }
});

router.put('/:id', authenticate, isAdmin, requirePermission(PERMISSIONS.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const link = await navigationLinkRepository.updateById(req.params.id, req.body);
    res.json({ success: true, message: 'Navigation link updated successfully', data: link });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Navigation link not found' });
    }
    logger.error({ err: error }, 'Update navigation link error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update navigation link' });
  }
});

router.delete('/:id', authenticate, isAdmin, requirePermission(PERMISSIONS.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    await navigationLinkRepository.deleteById(req.params.id);
    res.json({ success: true, message: 'Navigation link deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Navigation link not found' });
    }
    logger.error({ err: error }, 'Delete navigation link error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to delete navigation link' });
  }
});

export default router;
