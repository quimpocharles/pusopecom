import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import * as promoMessageRepository from '../repositories/promoMessageRepository.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Active promo messages, optionally filtered by placement (public)
router.get('/', async (req, res) => {
  try {
    const { placement } = req.query;
    const messages = placement
      ? await promoMessageRepository.findActiveByPlacement(placement)
      : await promoMessageRepository.find({ where: { active: true }, orderBy: { displayOrder: 'asc' } });
    res.json({ success: true, data: messages });
  } catch (error) {
    logger.error({ err: error }, 'Get promo messages error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve promo messages' });
  }
});

// All promo messages including inactive (admin)
router.get('/admin/all', authenticate, isAdmin, async (req, res) => {
  try {
    const messages = await promoMessageRepository.find({ orderBy: { displayOrder: 'asc' } });
    res.json({ success: true, data: messages });
  } catch (error) {
    logger.error({ err: error }, 'Get admin promo messages error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve promo messages' });
  }
});

// Create promo message (admin)
router.post('/', authenticate, isAdmin, async (req, res) => {
  try {
    const message = await promoMessageRepository.create(req.body);
    res.status(201).json({ success: true, message: 'Promo message created successfully', data: message });
  } catch (error) {
    logger.error({ err: error }, 'Create promo message error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to create promo message' });
  }
});

// Update promo message (admin)
router.put('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const message = await promoMessageRepository.updateById(req.params.id, req.body);
    res.json({ success: true, message: 'Promo message updated successfully', data: message });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Promo message not found' });
    }
    logger.error({ err: error }, 'Update promo message error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update promo message' });
  }
});

// Soft-delete promo message (admin)
router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    await promoMessageRepository.deleteById(req.params.id);
    res.json({ success: true, message: 'Promo message deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Promo message not found' });
    }
    logger.error({ err: error }, 'Delete promo message error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to delete promo message' });
  }
});

export default router;
