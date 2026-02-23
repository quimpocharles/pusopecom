import express from 'express';
import VenuePickupConfig from '../models/VenuePickupConfig.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// All routes in this file require admin auth
router.use(authenticate, isAdmin);

// GET /api/admin/pickup
router.get('/', async (req, res) => {
  try {
    const config = await VenuePickupConfig.findOne().lean();
    res.json({ success: true, data: config || { enabled: false } });
  } catch (error) {
    console.error('Get pickup config error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pickup config' });
  }
});

// PUT /api/admin/pickup — upserts the single VenuePickupConfig document
router.put('/', async (req, res) => {
  try {
    const { enabled, venueName, venueAddress, pickupDate, pickupHours, specialInstructions } = req.body;

    // Required-field validation when pick-up is enabled
    if (enabled) {
      if (!venueName?.trim())    return res.status(400).json({ success: false, message: 'Venue name is required when pick-up is enabled' });
      if (!venueAddress?.trim()) return res.status(400).json({ success: false, message: 'Venue address is required when pick-up is enabled' });
      if (!pickupDate)           return res.status(400).json({ success: false, message: 'Pick-up date is required when pick-up is enabled' });
      if (!pickupHours?.trim())  return res.status(400).json({ success: false, message: 'Pick-up hours are required when pick-up is enabled' });
    }

    const config = await VenuePickupConfig.findOneAndUpdate(
      {},
      {
        $set: {
          enabled:             Boolean(enabled),
          venueName:           venueName?.trim()           || '',
          venueAddress:        venueAddress?.trim()        || '',
          pickupDate:          pickupDate ? new Date(pickupDate) : null,
          pickupHours:         pickupHours?.trim()         || '',
          specialInstructions: specialInstructions?.trim() || '',
          updatedAt:           new Date(),
        },
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, data: config });
  } catch (error) {
    console.error('Update pickup config error:', error);
    res.status(500).json({ success: false, message: 'Failed to update pickup config' });
  }
});

export default router;
