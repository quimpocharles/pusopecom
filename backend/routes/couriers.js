import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import * as courierAccountRepository from '../repositories/courierAccountRepository.js';
import * as courierService from '../services/courierService.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate, isAdmin);

/**
 * Enterprise Fulfillment Blueprint §6/Phase 3 — the account-registry CRUD
 * behind the courier dropdown in AdminOrderDetail.jsx. `courierName` on a
 * new account must match a real key in courierService.js's GATEWAYS
 * registry — an account can't be created for a gateway that doesn't exist,
 * the same way a Payment.provider is never a gateway paymentService.js
 * can't resolve.
 */

router.get('/', async (req, res) => {
  try {
    // Self-healing, same idiom as warehouseRepository — ensures the one
    // real gateway (manual) always has a listable account, with no
    // separate seed step required.
    await courierAccountRepository.getOrCreateDefault();

    const { active } = req.query;
    const where = active !== undefined ? { active: active === 'true' } : undefined;
    const accounts = await courierAccountRepository.find({ where });
    res.json({ success: true, data: accounts });
  } catch (error) {
    logger.error({ err: error }, 'List courier accounts error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to list courier accounts' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { courierName, displayName, config } = req.body;
    if (!courierName || !displayName) {
      return res.status(400).json({ success: false, message: 'courierName and displayName are required' });
    }
    if (!courierService.isSupportedCourier(courierName)) {
      return res.status(400).json({ success: false, message: `"${courierName}" has no matching courierService gateway implemented yet` });
    }
    const account = await courierAccountRepository.create({ courierName, displayName, config });
    res.status(201).json({ success: true, data: account });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'A courier account with that courierName already exists' });
    logger.error({ err: error }, 'Create courier account error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to create courier account' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { displayName, config, active } = req.body;
    const account = await courierAccountRepository.updateById(req.params.id, {
      ...(displayName !== undefined && { displayName }),
      ...(config !== undefined && { config }),
      ...(active !== undefined && { active }),
    });
    res.json({ success: true, data: account });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Courier account not found' });
    logger.error({ err: error }, 'Update courier account error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update courier account' });
  }
});

export default router;
