import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import * as campaignRepository from '../repositories/campaignRepository.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// The single active, in-window, homepage-flagged campaign, or null (public — Milestone 3's Hero data source)
router.get('/active', async (req, res) => {
  try {
    const campaign = await campaignRepository.findActiveHomepageCampaign();
    res.json({ success: true, data: campaign });
  } catch (error) {
    logger.error({ err: error }, 'Get active campaign error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve active campaign' });
  }
});

// List all campaigns (admin)
router.get('/', authenticate, isAdmin, async (req, res) => {
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
router.get('/:id', authenticate, isAdmin, async (req, res) => {
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
router.post('/', authenticate, isAdmin, async (req, res) => {
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
router.put('/:id', authenticate, isAdmin, async (req, res) => {
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
router.delete('/:id', authenticate, isAdmin, async (req, res) => {
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
