import express from 'express';
import League from '../models/League.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all active leagues (public, for dropdowns)
router.get('/', async (req, res) => {
  try {
    const filter = { active: true };
    if (req.query.sport) filter.sport = req.query.sport;

    const leagues = await League.find(filter).sort('name');

    res.json({
      success: true,
      data: leagues
    });
  } catch (error) {
    console.error('Get leagues error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve leagues'
    });
  }
});

// Get all leagues including inactive (admin)
router.get('/admin/all', authenticate, isAdmin, async (req, res) => {
  try {
    const leagues = await League.find().sort('name');

    res.json({
      success: true,
      data: leagues
    });
  } catch (error) {
    console.error('Get admin leagues error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve leagues'
    });
  }
});

// Create league (admin)
router.post('/', authenticate, isAdmin, async (req, res) => {
  try {
    const { name, sport, teams } = req.body;

    const league = new League({ name, sport, teams: teams || [] });
    await league.save();

    res.status(201).json({
      success: true,
      message: 'League created successfully',
      data: league
    });
  } catch (error) {
    console.error('Create league error:', error);
    if (error.code === 11000) {
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
router.put('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const league = await League.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!league) {
      return res.status(404).json({
        success: false,
        message: 'League not found'
      });
    }

    res.json({
      success: true,
      message: 'League updated successfully',
      data: league
    });
  } catch (error) {
    console.error('Update league error:', error);
    if (error.code === 11000) {
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
router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const league = await League.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );

    if (!league) {
      return res.status(404).json({
        success: false,
        message: 'League not found'
      });
    }

    res.json({
      success: true,
      message: 'League deleted successfully'
    });
  } catch (error) {
    console.error('Delete league error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete league'
    });
  }
});

export default router;
