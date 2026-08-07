import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import * as faqItemRepository from '../repositories/faqItemRepository.js';
import { authenticate, isAdmin, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../lib/permissions.js';

const router = express.Router();

// Active FAQ items, in display order (public)
router.get('/', async (req, res) => {
  try {
    const items = await faqItemRepository.findActive();
    res.json({ success: true, data: items });
  } catch (error) {
    logger.error({ err: error }, 'Get FAQ items error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve FAQ items' });
  }
});

// All FAQ items including inactive (admin)
router.get('/admin/all', authenticate, isAdmin, requirePermission(PERMISSIONS.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const items = await faqItemRepository.find({ orderBy: { displayOrder: 'asc' } });
    res.json({ success: true, data: items });
  } catch (error) {
    logger.error({ err: error }, 'Get admin FAQ items error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve FAQ items' });
  }
});

// Create FAQ item (admin)
router.post('/', authenticate, isAdmin, requirePermission(PERMISSIONS.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const item = await faqItemRepository.create(req.body);
    res.status(201).json({ success: true, message: 'FAQ item created successfully', data: item });
  } catch (error) {
    logger.error({ err: error }, 'Create FAQ item error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to create FAQ item' });
  }
});

// Update FAQ item (admin)
router.put('/:id', authenticate, isAdmin, requirePermission(PERMISSIONS.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const item = await faqItemRepository.updateById(req.params.id, req.body);
    res.json({ success: true, message: 'FAQ item updated successfully', data: item });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'FAQ item not found' });
    }
    logger.error({ err: error }, 'Update FAQ item error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update FAQ item' });
  }
});

// Soft-delete FAQ item (admin)
router.delete('/:id', authenticate, isAdmin, requirePermission(PERMISSIONS.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    await faqItemRepository.deleteById(req.params.id);
    res.json({ success: true, message: 'FAQ item deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'FAQ item not found' });
    }
    logger.error({ err: error }, 'Delete FAQ item error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to delete FAQ item' });
  }
});

export default router;
