import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import * as venuePickupConfigRepository from '../repositories/venuePickupConfigRepository.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// All routes in this file require admin auth
router.use(authenticate, isAdmin);

// GET /api/admin/pickup
router.get('/', async (req, res) => {
  try {
    const config = await venuePickupConfigRepository.get();
    res.json({ success: true, data: config || { enabled: false, slots: [], deadlineHours: 6 } });
  } catch (error) {
    logger.error({ err: error }, 'Get pickup config error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to fetch pickup config' });
  }
});

// PUT /api/admin/pickup — replaces the entire VenuePickupConfig, slots included
router.put('/', async (req, res) => {
  try {
    const { enabled, deadlineHours, slots } = req.body;

    // Validate each slot
    if (Array.isArray(slots)) {
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (!s.venueName?.trim())       return res.status(400).json({ success: false, message: `Slot ${i + 1}: venue name is required` });
        if (!s.venueAddress?.trim())    return res.status(400).json({ success: false, message: `Slot ${i + 1}: venue address is required` });
        if (!s.pickupDate?.trim())      return res.status(400).json({ success: false, message: `Slot ${i + 1}: pick-up date is required` });
        if (!s.pickupHours?.trim())     return res.status(400).json({ success: false, message: `Slot ${i + 1}: pick-up hours are required` });
        if (!s.pickupStartTime?.trim()) return res.status(400).json({ success: false, message: `Slot ${i + 1}: start time is required` });
      }
    }

    const cleanSlots = (slots || []).map(s => ({
      venueName:           s.venueName?.trim()           || '',
      venueAddress:        s.venueAddress?.trim()        || '',
      pickupDate:          s.pickupDate?.trim()          || '',
      pickupHours:         s.pickupHours?.trim()         || '',
      pickupStartTime:     s.pickupStartTime?.trim()     || '',
      specialInstructions: s.specialInstructions?.trim() || '',
      enabled:             Boolean(s.enabled ?? true),
    }));

    // upsert() replaces slots wholesale (delete-then-recreate) — matches
    // the original findOneAndUpdate($set) behavior, which also replaced
    // the whole embedded array rather than merging it. updatedAt is set
    // automatically by Prisma's @updatedAt now, not manually.
    const config = await venuePickupConfigRepository.upsert({
      enabled: Boolean(enabled),
      deadlineHours: Number(deadlineHours) || 6,
      slots: cleanSlots,
    });

    res.json({ success: true, data: config });
  } catch (error) {
    logger.error({ err: error }, 'Update pickup config error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update pickup config' });
  }
});

export default router;
