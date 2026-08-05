import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import * as fitCheckCampaignRepository from '../repositories/fitCheckCampaignRepository.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// List all Fit Check campaigns (admin)
router.get('/', authenticate, isAdmin, async (req, res) => {
  try {
    const campaigns = await fitCheckCampaignRepository.find({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: campaigns });
  } catch (error) {
    logger.error({ err: error }, 'Get Fit Check campaigns error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve Fit Check campaigns' });
  }
});

// Get single Fit Check campaign (admin)
router.get('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const campaign = await fitCheckCampaignRepository.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Fit Check campaign not found' });
    }
    res.json({ success: true, data: campaign });
  } catch (error) {
    logger.error({ err: error }, 'Get Fit Check campaign error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve Fit Check campaign' });
  }
});

// Create Fit Check campaign (admin)
router.post('/', authenticate, isAdmin, async (req, res) => {
  try {
    const campaign = await fitCheckCampaignRepository.create(req.body);
    res.status(201).json({ success: true, message: 'Fit Check campaign created successfully', data: campaign });
  } catch (error) {
    logger.error({ err: error }, 'Create Fit Check campaign error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to create Fit Check campaign' });
  }
});

// Update Fit Check campaign (admin)
router.put('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const campaign = await fitCheckCampaignRepository.updateById(req.params.id, req.body);
    res.json({ success: true, message: 'Fit Check campaign updated successfully', data: campaign });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Fit Check campaign not found' });
    }
    logger.error({ err: error }, 'Update Fit Check campaign error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update Fit Check campaign' });
  }
});

// Soft-delete Fit Check campaign (admin)
router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    await fitCheckCampaignRepository.deleteById(req.params.id);
    res.json({ success: true, message: 'Fit Check campaign deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Fit Check campaign not found' });
    }
    logger.error({ err: error }, 'Delete Fit Check campaign error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to delete Fit Check campaign' });
  }
});

export default router;
