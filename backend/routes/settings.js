import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import * as siteSettingsRepository from '../repositories/siteSettingsRepository.js';
import * as venuePickupConfigRepository from '../repositories/venuePickupConfigRepository.js';
import { authenticate, isAdmin, requireAnyPermission } from '../middleware/auth.js';
import { PERMISSIONS, hasPermission } from '../lib/permissions.js';

const router = express.Router();

// GET /api/settings — public
router.get('/', async (req, res) => {
  try {
    const settings = await siteSettingsRepository.get();
    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error({ err: error }, 'Get settings error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
});

// PUT /api/settings — covers { tryOnAd, fitCheck, payment } in one merged
// object, so it's gated by "any of" rather than one specific permission —
// both Marketing (Fit Check tab) and Operations (Commerce tab) legitimately
// hit this same endpoint for their own slice of it.
router.put('/', authenticate, isAdmin, requireAnyPermission(PERMISSIONS.SETTINGS_FITCHECK_MANAGE, PERMISSIONS.SETTINGS_COMMERCE_MANAGE), async (req, res) => {
  try {
    // Launch-readiness audit fix — `payment` also carries
    // defaultPaymentGateway, which of Operations/Marketing's shared
    // permissions above should NOT be enough to change: which gateway new
    // orders are created against is an integrations decision, not a
    // Commerce/Fit Check settings one. Checked on the key's mere presence
    // (not its value, and not diffed against the current setting) so a
    // resubmit of an unrelated field can never accidentally carry this one
    // through, and a crafted request naming it is rejected outright rather
    // than silently dropped.
    if (req.body.payment && Object.prototype.hasOwnProperty.call(req.body.payment, 'defaultPaymentGateway')) {
      if (!hasPermission(req.user, PERMISSIONS.SETTINGS_INTEGRATIONS_MANAGE)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Changing the payment gateway requires settings.integrations.manage.',
        });
      }
    }

    // siteSettingsRepository.update() accepts the same { tryOnAd, fitCheck,
    // payment } shape the request body already has, and does the
    // partial-merge + flatten-to-columns + reshape-back internally — this
    // route doesn't need to know the database storage shape changed at all.
    // updatedByUserId always comes from the authenticated admin, never the
    // client — the same discipline every other "who did this" field in
    // this codebase already follows.
    const settings = await siteSettingsRepository.update({
      tryOnAd: req.body.tryOnAd,
      fitCheck: req.body.fitCheck,
      payment: req.body.payment,
    }, { updatedByUserId: req.user._id });
    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error({ err: error }, 'Update settings error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
});

// GET /api/settings/venue-pickup — public
router.get('/venue-pickup', async (req, res) => {
  try {
    const config = await venuePickupConfigRepository.get();
    res.json({ success: true, data: config || { enabled: false } });
  } catch (error) {
    logger.error({ err: error }, 'Get venue pickup error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to fetch venue pickup config' });
  }
});

export default router;
