import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import * as partnerLogoRepository from '../repositories/partnerLogoRepository.js';
import { authenticate, isAdmin, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../lib/permissions.js';

const router = express.Router();

// Every active logo (public)
router.get('/', async (req, res) => {
  try {
    const logos = await partnerLogoRepository.findActive();
    res.json({ success: true, data: logos });
  } catch (error) {
    logger.error({ err: error }, 'Get partner logos error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve partner logos' });
  }
});

// All logos including inactive (admin)
router.get('/admin/all', authenticate, isAdmin, requirePermission(PERMISSIONS.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const logos = await partnerLogoRepository.find({ orderBy: [{ priority: 'desc' }, { displayOrder: 'asc' }] });
    res.json({ success: true, data: logos });
  } catch (error) {
    logger.error({ err: error }, 'Get admin partner logos error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve partner logos' });
  }
});

router.post('/', authenticate, isAdmin, requirePermission(PERMISSIONS.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const logo = await partnerLogoRepository.create(req.body);
    res.status(201).json({ success: true, message: 'Partner logo created successfully', data: logo });
  } catch (error) {
    logger.error({ err: error }, 'Create partner logo error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to create partner logo' });
  }
});

router.put('/:id', authenticate, isAdmin, requirePermission(PERMISSIONS.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const logo = await partnerLogoRepository.updateById(req.params.id, req.body);
    res.json({ success: true, message: 'Partner logo updated successfully', data: logo });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Partner logo not found' });
    }
    logger.error({ err: error }, 'Update partner logo error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update partner logo' });
  }
});

router.delete('/:id', authenticate, isAdmin, requirePermission(PERMISSIONS.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    await partnerLogoRepository.deleteById(req.params.id);
    res.json({ success: true, message: 'Partner logo deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Partner logo not found' });
    }
    logger.error({ err: error }, 'Delete partner logo error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to delete partner logo' });
  }
});

export default router;
