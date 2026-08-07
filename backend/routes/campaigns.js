import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import * as campaignRepository from '../repositories/campaignRepository.js';
import { authenticate, isAdmin, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../lib/permissions.js';

const router = express.Router();

const VALID_PLACEMENTS = ['hero', 'tryOn'];

// The single active, in-window, homepage-flagged campaign for a placement, or
// null (public). ?placement=hero powers the Hero once wired; ?placement=tryOn
// powers the AI Try-On section. Required — silently defaulting to one
// placement would be an easy way to serve the wrong campaign to the wrong slot.
router.get('/active', async (req, res) => {
  try {
    const { placement } = req.query;
    if (!VALID_PLACEMENTS.includes(placement)) {
      return res.status(400).json({ success: false, message: `placement must be one of: ${VALID_PLACEMENTS.join(', ')}` });
    }
    const campaign = await campaignRepository.findActiveHomepageCampaign({ placement });
    res.json({ success: true, data: campaign });
  } catch (error) {
    logger.error({ err: error }, 'Get active campaign error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve active campaign' });
  }
});

// List all campaigns (admin)
router.get('/', authenticate, isAdmin, requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE), async (req, res) => {
  try {
    const campaigns = await campaignRepository.find({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: campaigns });
  } catch (error) {
    logger.error({ err: error }, 'Get campaigns error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve campaigns' });
  }
});

// Get single campaign (admin)
router.get('/:id', authenticate, isAdmin, requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE), async (req, res) => {
  try {
    const campaign = await campaignRepository.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    res.json({ success: true, data: campaign });
  } catch (error) {
    logger.error({ err: error }, 'Get campaign error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve campaign' });
  }
});

// Create campaign (admin)
router.post('/', authenticate, isAdmin, requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE), async (req, res) => {
  try {
    const campaign = await campaignRepository.create(req.body);
    res.status(201).json({ success: true, message: 'Campaign created successfully', data: campaign });
  } catch (error) {
    logger.error({ err: error }, 'Create campaign error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to create campaign' });
  }
});

// Update campaign (admin)
router.put('/:id', authenticate, isAdmin, requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE), async (req, res) => {
  try {
    const campaign = await campaignRepository.updateById(req.params.id, req.body);
    res.json({ success: true, message: 'Campaign updated successfully', data: campaign });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    logger.error({ err: error }, 'Update campaign error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update campaign' });
  }
});

// Soft-delete campaign (admin)
router.delete('/:id', authenticate, isAdmin, requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE), async (req, res) => {
  try {
    await campaignRepository.deleteById(req.params.id);
    res.json({ success: true, message: 'Campaign deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    logger.error({ err: error }, 'Delete campaign error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to delete campaign' });
  }
});

export default router;
