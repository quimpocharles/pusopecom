import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import * as promoCodeRepository from '../repositories/promoCodeRepository.js';
import * as passEventRepository from '../repositories/passEventRepository.js';
import { authenticate, isAdmin, optionalAuth, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../lib/permissions.js';

const router = express.Router();

const DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING'];
const SCOPES = ['ORDER', 'PRODUCT', 'EVENT'];

/**
 * Body-shape validation for create/update — kept local rather than pulled
 * into express-validator's chain style like orders.js, since this is a
 * small, admin-only surface with one obviously-related set of checks (which
 * fields a given discountType/scope combination requires), not a growing
 * list of independent per-field rules.
 */
function validatePromoCodeBody(body) {
  const { code, discountType, scope = 'ORDER', percentOff, amountOff, productIds, passEventIds } = body;

  if (!code || typeof code !== 'string' || !code.trim()) return 'Code is required.';
  if (!DISCOUNT_TYPES.includes(discountType)) return 'Invalid discount type.';
  if (!SCOPES.includes(scope)) return 'Invalid scope.';
  if (discountType === 'FREE_SHIPPING' && scope !== 'ORDER') return 'Free shipping codes must be order-scoped.';

  if (discountType === 'PERCENTAGE') {
    if (typeof percentOff !== 'number' || percentOff <= 0 || percentOff > 100) {
      return 'Percent off must be between 1 and 100.';
    }
  }
  if (discountType === 'FIXED_AMOUNT') {
    if (typeof amountOff !== 'number' || amountOff <= 0) return 'Amount off must be greater than 0.';
  }
  if (scope === 'PRODUCT' && (!Array.isArray(productIds) || productIds.length === 0)) {
    return 'Select at least one product for an item-scoped code.';
  }
  if (scope === 'EVENT' && (!Array.isArray(passEventIds) || passEventIds.length === 0)) {
    return 'Select at least one event for an event-scoped code.';
  }

  return null;
}

// All promo codes, including inactive (admin)
router.get('/admin/all', authenticate, isAdmin, requirePermission(PERMISSIONS.PROMOTIONS_MANAGE), async (req, res) => {
  try {
    const items = await promoCodeRepository.find({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: items });
  } catch (error) {
    logger.error({ err: error }, 'Get admin promo codes error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve promo codes' });
  }
});

// Lightweight event list for the promo-code "Applies To" picker (admin) —
// deliberately gated by PROMOTIONS_MANAGE, not PASSES_MANAGE: an admin who
// can create promo codes shouldn't need Pass/Event management rights just
// to pick an event to attach one to. Returns only what the picker's chip/
// result-row needs (id, name, venue name, date) — no organization, tiers,
// or other event-management fields a promo-code admin has no reason to see.
router.get('/admin/events', authenticate, isAdmin, requirePermission(PERMISSIONS.PROMOTIONS_MANAGE), async (req, res) => {
  try {
    const events = await passEventRepository.find({
      orderBy: { startsAt: 'desc' },
      include: { venue: { select: { name: true } } },
    });
    const data = events.map((event) => ({
      _id: event._id,
      name: event.name,
      venueName: event.venue?.name ?? null,
      startsAt: event.startsAt,
    }));
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ err: error }, 'Get promo-code event picker list error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve events' });
  }
});

// Create promo code (admin)
router.post('/', authenticate, isAdmin, requirePermission(PERMISSIONS.PROMOTIONS_MANAGE), async (req, res) => {
  try {
    const validationError = validatePromoCodeBody(req.body);
    if (validationError) return res.status(400).json({ success: false, message: validationError });

    const item = await promoCodeRepository.create(req.body);
    res.status(201).json({ success: true, message: 'Promo code created successfully', data: item });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'A promo code with this code already exists.' });
    }
    logger.error({ err: error }, 'Create promo code error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to create promo code' });
  }
});

// Update promo code (admin)
router.put('/:id', authenticate, isAdmin, requirePermission(PERMISSIONS.PROMOTIONS_MANAGE), async (req, res) => {
  try {
    const validationError = validatePromoCodeBody(req.body);
    if (validationError) return res.status(400).json({ success: false, message: validationError });

    const item = await promoCodeRepository.updateById(req.params.id, req.body);
    res.json({ success: true, message: 'Promo code updated successfully', data: item });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Promo code not found' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'A promo code with this code already exists.' });
    }
    logger.error({ err: error }, 'Update promo code error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update promo code' });
  }
});

// Soft-delete promo code (admin)
router.delete('/:id', authenticate, isAdmin, requirePermission(PERMISSIONS.PROMOTIONS_MANAGE), async (req, res) => {
  try {
    await promoCodeRepository.deleteById(req.params.id);
    res.json({ success: true, message: 'Promo code deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Promo code not found' });
    }
    logger.error({ err: error }, 'Delete promo code error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to delete promo code' });
  }
});

// Validate a code against the current cart (public) — used by the checkout
// page's Apply button. Non-mutating: does not reserve/increment anything.
// The authoritative check (and the only one that actually claims a
// redemption slot) happens again inside order creation's own transaction.
router.post('/validate', optionalAuth, async (req, res) => {
  try {
    const { code, items, passes, subtotal, shippingFee, email } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, message: 'Promo code is required.' });
    }
    if (typeof subtotal !== 'number' || typeof shippingFee !== 'number') {
      return res.status(400).json({ success: false, message: 'Cart subtotal and shipping fee are required.' });
    }

    // This is the checkout page's own live preview, not the authoritative
    // check (see this route's header comment) — items/passes/subtotal here
    // are client-reported cart state, same trust level items already had
    // before EVENT scope existed. The real order-creation call in
    // routes/orders.js is what recomputes everything server-side and
    // actually claims a redemption slot.
    const { promoCode, discountAmount, freeShipping } = await promoCodeRepository.validate({
      code,
      userId: req.user?._id,
      email: req.user?.email || email,
      items: Array.isArray(items) ? items : [],
      passes: Array.isArray(passes) ? passes : [],
      subtotal,
      shippingFee,
    });

    res.json({
      success: true,
      data: {
        code: promoCode.code,
        discountType: promoCode.discountType,
        scope: promoCode.scope,
        discountAmount,
        freeShipping,
      },
    });
  } catch (error) {
    if (error instanceof promoCodeRepository.PromoCodeInvalidError) {
      return res.status(400).json({ success: false, message: error.message, reason: error.reason });
    }
    logger.error({ err: error }, 'Validate promo code error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to validate promo code' });
  }
});

export default router;
