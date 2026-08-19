import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import * as venueRepository from '../repositories/venueRepository.js';
import { authenticate, isAdmin, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../lib/permissions.js';

const router = express.Router();
router.use(authenticate, isAdmin, requirePermission(PERMISSIONS.PASSES_MANAGE));

// Venue admin management is fully admin-gated — unlike Product, a Venue has
// no public browse page of its own; fans only ever see one through a
// PassEvent (routes/passEvents.js), which is where the public read lives.

router.get('/', async (req, res) => {
  try {
    const venues = await venueRepository.find({ orderBy: { name: 'asc' } });
    res.json({ success: true, data: venues });
  } catch (error) {
    logger.error({ err: error }, 'Get venues error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve venues' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const venue = await venueRepository.findById(req.params.id);
    if (!venue) return res.status(404).json({ success: false, message: 'Venue not found' });
    res.json({ success: true, data: venue });
  } catch (error) {
    logger.error({ err: error }, 'Get venue error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve venue' });
  }
});

router.post('/', async (req, res) => {
  try {
    const venue = await venueRepository.create(req.body);
    res.status(201).json({ success: true, message: 'Venue created successfully', data: venue });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'A venue with this slug already exists.' });
    }
    logger.error({ err: error }, 'Create venue error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to create venue' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const venue = await venueRepository.updateById(req.params.id, req.body);
    res.json({ success: true, message: 'Venue updated successfully', data: venue });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Venue not found' });
    logger.error({ err: error }, 'Update venue error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update venue' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await venueRepository.deleteById(req.params.id);
    res.json({ success: true, message: 'Venue deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Venue not found' });
    logger.error({ err: error }, 'Delete venue error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to delete venue' });
  }
});

// --- VenueSection ---

router.post('/:id/sections', async (req, res) => {
  try {
    const section = await venueRepository.createSection({ ...req.body, venueId: req.params.id });
    res.status(201).json({ success: true, message: 'Section created successfully', data: section });
  } catch (error) {
    logger.error({ err: error }, 'Create venue section error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to create section' });
  }
});

router.put('/sections/:sectionId', async (req, res) => {
  try {
    const section = await venueRepository.updateSection(req.params.sectionId, req.body);
    res.json({ success: true, message: 'Section updated successfully', data: section });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Section not found' });
    logger.error({ err: error }, 'Update venue section error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update section' });
  }
});

router.delete('/sections/:sectionId', async (req, res) => {
  try {
    await venueRepository.deleteSection(req.params.sectionId);
    res.json({ success: true, message: 'Section deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Section not found' });
    logger.error({ err: error }, 'Delete venue section error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to delete section' });
  }
});

export default router;
