import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import * as featuredTeamRepository from '../repositories/featuredTeamRepository.js';
import { authenticate, isAdmin, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../lib/permissions.js';

const router = express.Router();

// The single active, in-window Featured Team (public)
router.get('/active', async (req, res) => {
  try {
    const team = await featuredTeamRepository.findActive();
    res.json({ success: true, data: team });
  } catch (error) {
    logger.error({ err: error }, 'Get active featured team error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve featured team' });
  }
});

// List all (admin)
router.get('/', authenticate, isAdmin, requirePermission(PERMISSIONS.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const teams = await featuredTeamRepository.find({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: teams });
  } catch (error) {
    logger.error({ err: error }, 'List featured teams error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve featured teams' });
  }
});

router.get('/:id', authenticate, isAdmin, requirePermission(PERMISSIONS.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const team = await featuredTeamRepository.findById(req.params.id);
    if (!team) return res.status(404).json({ success: false, message: 'Featured team not found' });
    res.json({ success: true, data: team });
  } catch (error) {
    logger.error({ err: error }, 'Get featured team error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve featured team' });
  }
});

router.post('/', authenticate, isAdmin, requirePermission(PERMISSIONS.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const team = await featuredTeamRepository.create(req.body);
    res.status(201).json({ success: true, message: 'Featured team created successfully', data: team });
  } catch (error) {
    logger.error({ err: error }, 'Create featured team error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to create featured team' });
  }
});

router.put('/:id', authenticate, isAdmin, requirePermission(PERMISSIONS.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const team = await featuredTeamRepository.updateById(req.params.id, req.body);
    res.json({ success: true, message: 'Featured team updated successfully', data: team });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Featured team not found' });
    }
    logger.error({ err: error }, 'Update featured team error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update featured team' });
  }
});

router.delete('/:id', authenticate, isAdmin, requirePermission(PERMISSIONS.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    await featuredTeamRepository.deleteById(req.params.id);
    res.json({ success: true, message: 'Featured team deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Featured team not found' });
    }
    logger.error({ err: error }, 'Delete featured team error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to delete featured team' });
  }
});

export default router;
