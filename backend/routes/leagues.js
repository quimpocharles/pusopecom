import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import * as leagueRepository from '../repositories/leagueRepository.js';
import { authenticate, isAdmin, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../lib/permissions.js';

const router = express.Router();

// Get all active leagues (public, for dropdowns)
router.get('/', async (req, res) => {
  try {
    const where = { active: true };
    // Mongoose treated `filter.sports = value` on an array field as a
    // containment check; Prisma's equivalent on a native array column is
    // `{ has: value }`.
    if (req.query.sport) where.sports = { has: req.query.sport };

    const leagues = await leagueRepository.find({ where, orderBy: { name: 'asc' } });

    res.json({
      success: true,
      data: leagues
    });
  } catch (error) {
    logger.error({ err: error }, 'Get leagues error');
    Sentry.captureException(error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve leagues'
    });
  }
});

// Get all leagues including inactive (admin)
router.get('/admin/all', authenticate, isAdmin, requirePermission(PERMISSIONS.LEAGUES_MANAGE), async (req, res) => {
  try {
    const leagues = await leagueRepository.find({ orderBy: { name: 'asc' } });

    res.json({
      success: true,
      data: leagues
    });
  } catch (error) {
    logger.error({ err: error }, 'Get admin leagues error');
    Sentry.captureException(error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve leagues'
    });
  }
});

// Create league (admin)
router.post('/', authenticate, isAdmin, requirePermission(PERMISSIONS.LEAGUES_MANAGE), async (req, res) => {
  try {
    const { name, sports, teams } = req.body;

    const league = await leagueRepository.create({ name, sports, teams: teams || [] });

    res.status(201).json({
      success: true,
      message: 'League created successfully',
      data: league
    });
  } catch (error) {
    logger.error({ err: error }, 'Create league error');
    Sentry.captureException(error);
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'A league with this name and sport already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create league'
    });
  }
});

// Update league (admin)
router.put('/:id', authenticate, isAdmin, requirePermission(PERMISSIONS.LEAGUES_MANAGE), async (req, res) => {
  try {
    const league = await leagueRepository.updateById(req.params.id, req.body);

    res.json({
      success: true,
      message: 'League updated successfully',
      data: league
    });
  } catch (error) {
    // Prisma's update() throws (P2025) rather than returning null when the
    // record doesn't exist — Mongoose's findByIdAndUpdate returned null,
    // handled with a plain if-check. Same 404 outcome, different signal.
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'League not found'
      });
    }
    logger.error({ err: error }, 'Update league error');
    Sentry.captureException(error);
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'A league with this name and sport already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to update league'
    });
  }
});

// Soft-delete league (admin)
router.delete('/:id', authenticate, isAdmin, requirePermission(PERMISSIONS.LEAGUES_MANAGE), async (req, res) => {
  try {
    await leagueRepository.updateById(req.params.id, { active: false });

    res.json({
      success: true,
      message: 'League deleted successfully'
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'League not found'
      });
    }
    logger.error({ err: error }, 'Delete league error');
    Sentry.captureException(error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete league'
    });
  }
});

export default router;
