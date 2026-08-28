import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma.js';
import * as orderRepository from '../repositories/orderRepository.js';
import * as orderEventRepository from '../repositories/orderEventRepository.js';
import * as paymentRepository from '../repositories/paymentRepository.js';
import * as productRepository from '../repositories/productRepository.js';
import * as promoCodeRepository from '../repositories/promoCodeRepository.js';
import * as passEventRepository from '../repositories/passEventRepository.js';
import * as passRepository from '../repositories/passRepository.js';
import { ensurePassQrCode, getPassQrCodeDataUrl } from '../lib/passQrCode.js';
import * as shippingEventRepository from '../repositories/shippingEventRepository.js';
import * as venuePickupConfigRepository from '../repositories/venuePickupConfigRepository.js';
import * as siteSettingsRepository from '../repositories/siteSettingsRepository.js';
import { getDomesticRate, getInternationalRate, isSlotActive } from '../lib/shipping/calculateShipping.js';
import { authenticate, isAdmin, optionalAuth, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../lib/permissions.js';
import { mayaWebhookIpAllowlist } from '../middleware/mayaWebhookIpAllowlist.js';
import { xenditWebhookVerify } from '../middleware/xenditWebhookVerify.js';
import { epaygamesWebhookVerify } from '../middleware/epaygamesWebhookVerify.js';
import * as paymentService from '../services/paymentService.js';
import { sendPaymentFailedEmail } from '../services/emailService.js';
import { sendOrderConfirmation } from '../lib/orderConfirmationEmail.js';
import * as notificationRepository from '../repositories/notificationRepository.js';
import * as accountCache from '../lib/accountCache.js';
import * as fitCheckBonus from '../lib/fitCheckBonus.js';
import * as shipmentRepository from '../repositories/shipmentRepository.js';
import * as shipmentEventRepository from '../repositories/shipmentEventRepository.js';
import { escapeCsvCell } from '../lib/csv.js';
import { normalizePagination } from '../lib/pagination.js';

const router = express.Router();

/**
 * Order ownership check shared by GET /:orderNumber, POST /:orderNumber/pay,
 * and POST /:orderNumber/verify-payment. `userId` is read first so raw
 * (non-serialized) orders work too  — withRelationFallback deletes `userId`
 * and copies it into `user`. An ownerless (guest) order is always allowed:
 * the order number is the bearer secret. A user-owned order needs an
 * authenticated owner, or an admin.
 */
function canAccessOrder(order, req) {
  const orderUserId = order.userId ?? order.user;
  if (orderUserId) {
    return Boolean(req.user) && (orderUserId.toString() === req.user._id.toString() || req.user.role === 'admin');
  }
  return true;
}

// Merchandise Quantity Validation (security remediation — a negative
// quantity previously turned decrementStock's conditional UPDATE into a
// silent stock/totalStock increase and let subtotal go negative, letting
// an attacker pair a real item with a fabricated negative-quantity line to
// zero out — or even clamp-to-zero — the order total). There is no
// existing product/order business rule capping quantity anywhere in this
// codebase (confirmed: no max on the admin stock input, no server-side
// cap today) — the storefront's own quantity stepper already self-limits
// to "never more than the variant's current stock"
// (ProductDetail.jsx's `Math.min(selectedSizeStock, quantity + 1)`), which
// is exactly what the atomic `stock: { gte: quantity }` check already
// enforces correctly once quantity itself is a valid positive integer.
// MAX_ITEM_QUANTITY is therefore not modeling a discovered business limit
// — it's a generous technical sanity ceiling, set far above any
// legitimate cart (real seeded stock per variant tops out in the
// low tens/twenties — see seed.js/seed-100.js) so it never interferes
// with a real purchase, while still bounding request payloads against
// pathological/overflow-adjacent values.
const MAX_ITEM_QUANTITY = 1000;

// Every OrderStatus value an admin may set manually, via PATCH /:id/status —
// deliberately excludes 'confirmed', the legacy value Payment Platform
// Redesign Phase 2 superseded with 'paid'; nothing should set it again,
// including a manual admin edit.
//
// Enterprise Fulfillment Blueprint, Phase 1 — also deliberately excludes
// every post-payment fulfillment value ('processing', 'packed', 'shipped',
// 'delivered', 'cancelled', 'returned'). Those used to be independently
// editable here with zero consequence — no stock release or refund on
// cancel/return (the Fulfillment Audit's #1 finding), and no connection at
// all to the real fulfillment pipeline for the others. All six now live
// exclusively behind routes/shipments.js: Order.orderStatus for a paid
// order is derived from Shipment.status by SHIPMENT_TO_ORDER_STATUS there,
// not set directly, so the two can never silently disagree with each
// other the way two independently-editable copies of "what stage is this
// order at" always eventually would. What's left settable here is
// genuinely still Order's own domain — the payment-side states.
const VALID_ORDER_STATUSES = ['awaiting_payment', 'paid', 'expired', 'failed_payment'];

/**
 * Restores stock for every item on an order inside one transaction — the
 * symmetric inverse of the atomic reservation made at order creation.
 * Used both when Maya checkout creation itself fails (the reservation was
 * never going to be paid for) and when a payment later resolves to
 * failed/expired — the Commerce Engine rule that stock reserved at Order
 * placement releases automatically when checkout doesn't complete.
 */
async function releaseStock(order) {
  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      await productRepository.restoreStock(
        { productId: item.productId ?? item.product, size: item.size, color: item.color, quantity: item.quantity },
        { client: tx }
      );
    }
    // Promo Code Discounts — a redemption is claimed at Order placement
    // exactly like a stock reservation, so it releases the same way and on
    // the same trigger. Every releaseStock caller (gateway-session failure
    // below, applyPaymentResolution's failed/expired branch, and
    // transitively the stale-order sweep) gets this for free.
    if (order.promoCodeId) await promoCodeRepository.releaseRedemption(order.promoCodeId, { client: tx });

    // A Pass is claimed at Order placement exactly like stock and a promo
    // redemption, so it releases on the same trigger. Every releaseStock
    // caller gets this for free, same as the two releases above.
    for (const pass of order.passes ?? []) {
      await passRepository.restoreTierCapacity({ passTierId: pass.passTierId, quantity: 1 }, { client: tx });
      await passRepository.transition(pass._id, 'cancelled', {
        actor: 'system',
        message: 'Payment failed — pass reservation released',
        client: tx,
      });
    }
    // Multiple round trips per item; Prisma's 5s default interactive-
    // transaction timeout has been observed to be too tight under this
    // deployment's real network latency (see the matching timeout on the
    // order-creation transaction below).
  }, { timeout: 15000 });
}

/**
 * Applies the consequences of a resolved payment status. Shared by both
 * /verify-payment (the customer's browser polling after returning from
 * checkout) and the webhook — the two paths converge here so a payment is
 * only ever resolved once, via tryResolvePayment's atomic guard,
 * regardless of which path notices first.
 *
 * `gatewayStatus` is the normalized, gateway-agnostic status paymentService
 * returns ('succeeded'|'failed'|'expired'|'pending') — never a
 * gateway-specific string like Maya's 'PAYMENT_SUCCESS'.
 *
 * `source` is who prompted this resolution check — 'customer' (browser
 * poll) or 'webhook' — recorded as the audit event's actor so the Admin
 * Order Timeline can show which path actually noticed the outcome first.
 * Only meaningful when `applied` is true; tryResolvePayment's guard means
 * whichever caller loses the race never gets to attribute the event.
 */
/**
 * Payment Platform Redesign, Phase 1 — dual-write: resolves the matching
 * Payment attempt row alongside Order.paymentStatus, via the same
 * conditional-update idempotency shape (paymentRepository.resolve), just
 * scoped to one attempt instead of the whole order. Deliberately best-
 * effort and never thrown from — Order.paymentStatus/tryResolvePayment
 * remains the real idempotency gate every side effect in
 * applyPaymentResolution already depends on; a Payment write failing here
 * must never block a customer's payment from actually resolving.
 */
async function dualWritePaymentResolution(order, status, extra, logContext) {
  try {
    const payment = await paymentRepository.findLatestForOrder(order._id);
    if (payment) await paymentRepository.resolve(payment._id, status, extra);
  } catch (paymentError) {
    logger.error({ err: paymentError, ...logContext }, 'Failed to dual-write Payment resolution');
    Sentry.captureException(paymentError);
  }
}

// Named-exported (not just used internally) so lib/expireStaleOrders.js's
// hourly sweep (Payment Platform Redesign, Phase 4) can drive the exact
// same atomic-resolve + releaseStock + dual-write Payment + OrderEvent
// sequence for a stale order as a real gateway 'expired' report already
// does — one resolution path, not two copies of it that could drift.
export async function applyPaymentResolution(order, gatewayStatus, source = 'system') {
  const logContext = { orderNumber: order.orderNumber, paymentId: order.mayaPaymentId, gateway: order.paymentMethod };

  if (gatewayStatus === 'succeeded') {
    // applied is false only when a concurrent request already resolved
    // this order — the gateway's answer is still authoritative either
    // way, so the caller can trust 'paid' as the return value regardless.
    // orderStatus: 'paid', not the legacy 'confirmed' — Payment Platform
    // Redesign, Phase 2.
    const applied = await orderRepository.tryResolvePayment(order._id, 'paid', { orderStatus: 'paid' });
    if (applied) {
      logger.info(logContext, 'Payment verified — order marked paid');

      await dualWritePaymentResolution(order, 'succeeded', {
        paidAt: new Date(),
        ...(source === 'webhook' && { webhookProcessedAt: new Date() }),
      }, logContext);

      await orderEventRepository.create({
        orderId: order._id,
        type: 'payment_succeeded',
        actor: source,
        message: `Payment confirmed via ${order.paymentMethod}`,
        metadata: { paymentId: order.mayaPaymentId, gateway: order.paymentMethod },
      });

      try {
        await shippingEventRepository.create({
          orderId: order.orderNumber,
          shippingMethod: order.shippingMethod || 'unknown',
          orderTotal: order.total,
          region: order.shippingRegion || null,
        });
      } catch (shippingEventError) {
        logger.error({ err: shippingEventError, ...logContext }, 'Failed to record shipping event');
        Sentry.captureException(shippingEventError);
      }

      // Enterprise Fulfillment Blueprint, Phase 1 — a Shipment is the real
      // staff-facing fulfillment record (queue-driven, one per Order today
      // — see the schema comment on Shipment for why this is not just
      // another Order field). Created the moment payment resolves, not
      // before: there is nothing to pick until the order is actually paid
      // for. Fire-and-forget, not awaited: nothing in this request/
      // response cycle (webhook ack, customer poll response) depends on
      // the Shipment existing synchronously, and awaiting it here was
      // measured adding two more sequential round trips to an already
      // request-heavy code path — the exact kind of latency this branch's
      // other non-critical side effects (fitCheckBonus grant) already
      // avoid by not being awaited either.
      shipmentRepository.create({ orderId: order._id })
        .then((shipment) => shipmentEventRepository.create({
          shipmentId: shipment._id,
          type: 'created',
          actor: source,
          message: 'Shipment created — awaiting picking',
          toStatus: 'awaiting_picking',
        }))
        .catch((shipmentError) => {
          logger.error({ err: shipmentError, ...logContext }, 'Failed to create Shipment for paid order');
          Sentry.captureException(shipmentError);
        });

      // The frontend renders from its order read before reconciliation, so
      // this bounded post-payment side effect can be awaited here. Keeping
      // the request open prevents a sleeping host from dropping the SMTP
      // attempt, while the delivery marker and retry sweep cover failures.
      try {
        const delivery = await sendOrderConfirmation(order);
        logger.info({ ...logContext, delivery }, delivery === 'sent'
          ? 'Confirmation email sent'
          : 'Confirmation email skipped — already claimed or sent');
      } catch (emailError) {
        logger.error({ err: emailError, ...logContext }, 'Failed to send confirmation email');
        Sentry.captureException(emailError);
      }

      // Guest checkouts have no account to grant against. orderRepository's
      // Mongoose-compatibility layer (withRelationFallback) collapses the
      // raw userId scalar into `order.user` (a bare id string here, since
      // `user` isn't in this repo's DEFAULT_INCLUDE) and deletes `userId`
      // outright — `order.user` is the field that actually exists on this
      // object, not `order.userId`. grantEventBonus's own once-per-user
      // idempotency (not an order-history query) is what makes this
      // correctly a "first purchase only" bonus.
      if (order.user) {
        fitCheckBonus.grantEventBonus(order.user, 'first_purchase').catch((err) =>
          logger.error({ err, ...logContext }, 'Fit Check first-purchase bonus grant failed')
        );
        // This order just left 'awaiting_payment' — the Home feed's Resume
        // Checkout module (Phase 5) would otherwise show a stale/paid order
        // for up to accountCache's 60s TTL.
        await accountCache.invalidateHome(order.user);

        // Payment Platform Redesign, Phase 6 — the dormant Notification
        // system's first real write-side trigger. Guest orders have no
        // account/bell to notify, same guard as the bonus grant above.
        notificationRepository.create({
          userId: order.user,
          type: 'order',
          title: 'Payment confirmed',
          body: `Order #${order.orderNumber} — payment received.`,
          link: `/order/${order.orderNumber}`,
        }).catch((err) => logger.error({ err, ...logContext }, 'Failed to create payment-succeeded notification'));
      }
    }
    return 'paid';
  }

  if (gatewayStatus === 'failed' || gatewayStatus === 'expired') {
    // Previously left orderStatus untouched on this branch — paymentStatus
    // alone carried "this didn't work," with no orderStatus signal at all.
    // Payment Platform Redesign, Phase 2 gives it one of its own.
    const applied = await orderRepository.tryResolvePayment(order._id, 'failed', {
      orderStatus: gatewayStatus === 'expired' ? 'expired' : 'failed_payment',
    });
    if (applied) {
      logger.info({ ...logContext, reason: gatewayStatus }, 'Payment did not succeed — order marked failed, stock released');
      await releaseStock(order);

      await dualWritePaymentResolution(order, gatewayStatus === 'expired' ? 'expired' : 'failed', {
        ...(source === 'webhook' && { webhookProcessedAt: new Date() }),
      }, logContext);

      await orderEventRepository.create({
        orderId: order._id,
        type: gatewayStatus === 'expired' ? 'payment_expired' : 'payment_failed',
        actor: source,
        message: `Payment ${gatewayStatus} via ${order.paymentMethod} — stock released`,
        metadata: { paymentId: order.mayaPaymentId, gateway: order.paymentMethod },
      });

      // Same reasoning as the succeeded branch above — this order just left
      // 'awaiting_payment', so Resume Checkout needs a fresh read.
      if (order.user) await accountCache.invalidateHome(order.user);

      // Payment Platform Redesign, Phase 6 — fires for every trigger of
      // this branch, including Phase 4's hourly sweep: a customer whose
      // order quietly expired with nobody watching is exactly who most
      // needs telling "your order wasn't lost, here's how to finish it."
      const failureReason = gatewayStatus === 'expired' ? 'expired' : 'failed';
      try {
        await sendPaymentFailedEmail(order.email, order, failureReason);
      } catch (emailError) {
        logger.error({ err: emailError, ...logContext }, 'Failed to send payment-failed email');
        Sentry.captureException(emailError);
      }

      if (order.user) {
        notificationRepository.create({
          userId: order.user,
          type: 'order',
          title: failureReason === 'expired' ? 'Payment session expired' : 'Payment failed',
          body: `Order #${order.orderNumber} — ${failureReason === 'expired' ? 'your payment session expired' : "payment didn't go through"}. Your order is still here.`,
          link: `/order/${order.orderNumber}`,
        }).catch((err) => logger.error({ err, ...logContext }, 'Failed to create payment-failed notification'));
      }
    }
    return 'failed';
  }

  return order.paymentStatus; // still pending — the gateway hasn't resolved it yet
}

// Create order and initiate Maya checkout
router.post('/',
  optionalAuth,
  [
    body('email').isEmail().normalizeEmail(),
    // Merchandise (items) and Pass admission (passes) are each individually
    // optional but never both at once — a Pass-only order (no shipping to
    // speak of, ADR-011 addendum) and a Merchandise-only order are the only
    // two valid shapes. Mixed-category Orders were a deliberate feature at
    // first (Commerce Engine Stage 9) but reversed once Pass's own checkout
    // needed to stop looking like a shipment: see the ADR-011 addendum.
    body('items').isArray(),
    body('items.*.product').isString().trim().notEmpty(),
    body('items.*.size').isString().trim().notEmpty(),
    body('items.*.quantity').isInt({ min: 1, max: MAX_ITEM_QUANTITY }).toInt(),
    body('passes').optional().isArray(),
    body('passes.*.passTierId').isString().trim().notEmpty(),
    body('passes.*.quantity').optional().isInt({ min: 1 }).toInt()
      .custom((value) => Number.isSafeInteger(value))
      .withMessage('Pass quantity must be a positive safe integer'),
    body().custom((value) => (value.items?.length ?? 0) + (value.passes?.length ?? 0) > 0)
      .withMessage('An order must contain at least one item or pass'),
    body().custom((value) => !((value.items?.length ?? 0) > 0 && (value.passes?.length ?? 0) > 0))
      .withMessage('An order cannot mix Merchandise items and Passes — check out each separately'),
    body('shippingAddress').isObject(),
    body('shippingAddress.fullName').trim().notEmpty(),
    body('shippingAddress.phone').trim().notEmpty(),
    // Only meaningful for a Merchandise order — a Pass is never shipped, so
    // these are required exclusively when the order actually has items.
    body('shippingAddress.address').if((value, { req }) => (req.body.items?.length ?? 0) > 0).trim().notEmpty(),
    body('shippingAddress.city').if((value, { req }) => (req.body.items?.length ?? 0) > 0).trim().notEmpty(),
    body('shippingAddress.province').if((value, { req }) => (req.body.items?.length ?? 0) > 0).trim().notEmpty(),
    body('shippingAddress.zipCode').if((value, { req }) => (req.body.items?.length ?? 0) > 0).trim().notEmpty(),
    body('shippingAddress.country').optional().trim(),
    body('shippingAddress.region').optional().trim(),
    body('shippingAddress.barangay').optional().trim(),
    body('promoCode').optional({ nullable: true }).trim().isLength({ max: 40 }),
    // Chosen in our own checkout UI before redirect, not on the gateway's
    // hosted page — required so the processing fee shown to the fan (and
    // included in `total`) is exact for the channel they'll actually be
    // charged on, never a blended guess. See ADR-010. Whether this specific
    // string is actually a real channel FOR THE SELECTED GATEWAY can't be
    // checked here (Phase 4, ePayGames evaluation) — which gateway is
    // active is an async site-setting lookup the validator array can't
    // await, so that check now happens in the handler body, via
    // paymentService.calculateFee's own per-gateway validation.
    body('paymentChannel').trim().notEmpty().withMessage('A payment channel is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { email, items, passes, shippingAddress, notes, shippingMethod, shippingRegion, slotId, promoCode, paymentChannel } = req.body;

      // Normalization/deduplication — deterministic, before any pricing or
      // reservation logic runs. Two request entries for the same
      // (product, size, color) are merged into one line by summing their
      // quantities, keyed in first-seen order, rather than reserved/priced
      // as two separate lines — this is what closes the duplicate-line
      // trick (submitting the same variant twice, once positive once
      // negative, to cancel its price while netting zero stock change)
      // independently of the positive-integer check above, since two
      // *positive* duplicate entries need merging too (to reserve/price
      // the combined quantity atomically as one line, not race two
      // separate partial reservations against each other).
      const normalizedItems = [];
      const normalizedIndexByKey = new Map();
      for (const item of items) {
        const key = `${item.product}\u0000${item.size}\u0000${item.color || ''}`;
        const existingIndex = normalizedIndexByKey.get(key);
        if (existingIndex === undefined) {
          normalizedIndexByKey.set(key, normalizedItems.length);
          normalizedItems.push({ ...item });
        } else {
          normalizedItems[existingIndex].quantity += item.quantity;
        }
      }

      // Re-validate the SAME bound the express-validator chain already
      // applied per raw request line — merging can push a combined
      // quantity above MAX_ITEM_QUANTITY even when every individual entry
      // was within bounds (e.g. two entries of 600 each for the same
      // variant), so the normalized quantity must be checked again here,
      // strictly after normalization and strictly before pricing/
      // reservation.
      for (const item of normalizedItems) {
        if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_ITEM_QUANTITY) {
          return res.status(400).json({
            success: false,
            message: `Combined quantity for ${item.product}/${item.size}${item.color ? `/${item.color}` : ''} must be between 1 and ${MAX_ITEM_QUANTITY} after merging duplicate line items (got ${item.quantity})`
          });
        }
      }

      // Pass 1 — structural validation and price/image resolution. Not
      // itself the stock-sufficiency check (that's the atomic
      // decrementStock call below); this only confirms the product and
      // the requested size/color combination exist at all.
      let subtotal = 0;
      const orderItems = [];
      const productNames = {};

      for (const item of normalizedItems) {
        const product = await productRepository.findById(item.product);

        if (!product || !product.active) {
          return res.status(400).json({
            success: false,
            message: `Product not found: ${item.name}`
          });
        }
        productNames[product._id] = product.name;

        let itemImage = product.images[0];
        let sizeExists;

        if (item.color && product.colors?.length > 0) {
          const colorVariant = product.colors.find(c => c.color === item.color);
          if (!colorVariant) {
            return res.status(400).json({
              success: false,
              message: `Color ${item.color} not found for ${product.name}`
            });
          }
          if (colorVariant.image) itemImage = colorVariant.image;
          sizeExists = colorVariant.sizes.some(s => s.size === item.size);
        } else {
          sizeExists = product.sizes.some(s => s.size === item.size);
        }

        if (!sizeExists) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.name}${item.color ? ` - ${item.color}` : ''} - Size ${item.size}`
          });
        }

        const price = product.effectivePrice;
        subtotal += price * item.quantity;

        orderItems.push({
          product: product._id,
          name: product.name,
          price,
          quantity: item.quantity,
          size: item.size,
          color: item.color || undefined,
          image: itemImage
        });
      }

      // Pass 1b — Pass (event admission) resolution. Mirrors the Merchandise
      // loop above: structural validation and price resolution here, the
      // atomic capacity reservation happens in the transaction below. Every
      // tier is quantity/capacity-based (ADR-011 addendum — per-seat
      // selection was scrapped) — one request entry can expand into several
      // individual Passes, since each admission credential is independently
      // scannable (see the schema comment on the Pass model for why).
      const passUnits = [];
      // passTierId -> { quantity, capacity } — capacity carried alongside
      // quantity so decrementTierCapacity never has to re-read it inside
      // the transaction (see that function's own comment for why).
      const tierDecrements = new Map();
      const requestedPassQuantityByTierId = new Map();

      for (const p of passes || []) {
        const quantity = p.quantity ?? 1;
        const combinedQuantity = (requestedPassQuantityByTierId.get(p.passTierId) || 0) + quantity;
        if (!Number.isSafeInteger(combinedQuantity)) {
          return res.status(400).json({ success: false, message: 'Combined Pass quantity must be a positive safe integer' });
        }
        requestedPassQuantityByTierId.set(p.passTierId, combinedQuantity);
      }

      for (const [passTierId, quantity] of requestedPassQuantityByTierId) {
        const tier = await passEventRepository.findTierById(passTierId);
        if (!tier) {
          return res.status(400).json({ success: false, message: `Pass tier not found: ${passTierId}` });
        }
        if (tier.capacity == null) {
          return res.status(400).json({ success: false, message: `Pass tier ${passTierId} has no capacity configured` });
        }
        if (quantity > tier.capacity - (tier.sold ?? 0)) {
          return res.status(400).json({ success: false, message: `Insufficient capacity remaining on pass tier ${passTierId}` });
        }

        for (let i = 0; i < quantity; i++) {
          passUnits.push({ passEventId: tier.passEventId, passTierId: tier._id, price: tier.price });
        }
        tierDecrements.set(tier._id, { quantity, capacity: tier.capacity });
      }

      subtotal += passUnits.reduce((sum, unit) => sum + unit.price, 0);

      // Recalculate shipping fee server-side — never trust the client value.
      // A Pass-only order (no items — enforced above, items and passes
      // never mix) has nothing to ship, full stop; the domestic/
      // international rate lookup below is Merchandise-specific and would
      // be meaningless here.
      const country = shippingAddress?.country || 'Philippines';
      let shippingFee;

      if (orderItems.length === 0) {
        shippingFee = 0;
      } else if (shippingMethod === 'venue_pickup' && country === 'Philippines') {
        // Verify the specific slot is still active at time of order
        const venue = await venuePickupConfigRepository.get();
        const targetSlot = venue?.slots?.find(s => s._id === slotId);
        const slotValid =
          venue?.enabled &&
          targetSlot &&
          isSlotActive(targetSlot, venue.deadlineHours ?? 6);
        shippingFee = slotValid ? 0 : getDomesticRate(shippingRegion || '', subtotal).fee;
      } else if (country === 'Philippines') {
        shippingFee = getDomesticRate(shippingRegion || '', subtotal).fee;
      } else {
        const intl = getInternationalRate(country);
        shippingFee = intl.fee ?? 0;
      }

      // Promo Code Discounts — validated after pricing/shipping resolve (it
      // needs the real subtotal/shippingFee, not the client's) and before
      // total is computed, same style as the size/color checks above: a
      // synchronous 400 with a clear reason, not a generic 500.
      let promoCodeRecord = null;
      let discountAmount = 0;
      if (promoCode) {
        try {
          const result = await promoCodeRepository.validate({
            code: promoCode,
            userId: req.user?._id,
            email,
            items: orderItems,
            subtotal,
            shippingFee,
          });
          promoCodeRecord = result.promoCode;
          discountAmount = result.discountAmount;
        } catch (error) {
          if (error instanceof promoCodeRepository.PromoCodeInvalidError) {
            return res.status(400).json({ success: false, message: error.message });
          }
          throw error;
        }
      }

      // Admin-configurable (siteSettingsRepository) instead of hardcoded, so
      // the operational gateway can change without a deploy — e.g. while
      // Xendit's business verification is pending. Defaults to 'xendit',
      // preserving today's behavior exactly when never explicitly set.
      // Determined BEFORE the fee calculation below (Phase 4) — which
      // gateway's channel catalog/fee formula applies depends on it.
      const { payment: paymentSettings } = await siteSettingsRepository.get();
      const paymentMethod = paymentSettings.defaultPaymentGateway;

      // Gateway fee — dispatched per-gateway (Phase 4, ePayGames
      // evaluation) rather than always assuming Xendit's own fee table.
      // Xendit's and Maya's real behavior are both unchanged: Xendit's
      // dispatch still resolves to lib/payments/xenditFees.js's exact
      // existing channel list and formula; Maya's resolves to its own
      // historical "no per-channel fee ever surfaced" reality. Computed
      // server-side either way, never trusted off the client, against the
      // amount after the discount and before the fee itself is added
      // (never a base that includes its own fee).
      let gatewayFeeAmount;
      try {
        gatewayFeeAmount = await paymentService.calculateFee(paymentMethod, paymentChannel, subtotal + shippingFee - discountAmount);
      } catch (error) {
        return res.status(400).json({ success: false, message: error.message || 'Invalid payment channel for the selected gateway' });
      }

      const total = Math.max(0, subtotal + shippingFee - discountAmount + gatewayFeeAmount);

      // Pass 2 — atomic: reserve stock for every item and create the order
      // together, or none of it happens. This is the direct fix for the
      // original per-item read-then-write loop, which could both oversell
      // (two checkouts racing for the last unit) and leave partial stock
      // decrements behind if a later item in the same order failed
      // validation after earlier items had already been decremented.
      let order;
      try {
        order = await prisma.$transaction(async (tx) => {
          for (const item of orderItems) {
            await productRepository.decrementStock(
              { productId: item.product, size: item.size, color: item.color, quantity: item.quantity },
              { client: tx }
            );
            await productRepository.updateById(
              item.product,
              { totalSold: { increment: item.quantity } },
              { client: tx }
            );
          }

          // Same atomic unit as the stock reservation above — either both
          // the last unit and the last redemption slot are claimed
          // together, or neither is (transaction rolls back on either
          // error), per the Commerce Engine's "checkout is atomic" rule.
          if (promoCodeRecord) {
            await promoCodeRepository.tryRedeem(
              { promoCodeId: promoCodeRecord._id, maxRedemptions: promoCodeRecord.maxRedemptions },
              { client: tx }
            );
          }

          // Same atomic unit again — Pass tier capacity succeeds or fails
          // together with everything else above.
          for (const [passTierId, { quantity, capacity }] of tierDecrements) {
            await passRepository.decrementTierCapacity({ passTierId, quantity, capacity }, { client: tx });
          }

          const createdOrder = await orderRepository.create(
            {
              userId: req.user?._id,
              email,
              items: orderItems,
              shippingAddress,
              subtotal,
              shippingFee,
              promoCodeId: promoCodeRecord?._id,
              discountAmount,
              paymentMethod,
              paymentChannel,
              gatewayFeeAmount,
              total,
              shippingMethod: shippingMethod || undefined,
              shippingRegion: shippingRegion || undefined,
              notes
            },
            { client: tx }
          );

          // Issued directly (no separate pre-status) the moment the order
          // itself commits — by this point the capacity reservation above
          // has already succeeded, same "reserved at placement, not
          // payment confirmation" rule Merchandise stock already follows.
          for (const unit of passUnits) {
            await passRepository.issuePass(
              {
                orderId: createdOrder._id,
                passEventId: unit.passEventId,
                passTierId: unit.passTierId,
                price: unit.price,
              },
              { client: tx }
            );
          }

          await orderEventRepository.create(
            {
              orderId: createdOrder._id,
              type: 'created',
              actor: req.user ? 'customer' : 'system',
              message: `Order placed with ${orderItems.length} item${orderItems.length === 1 ? '' : 's'}${passUnits.length ? ` and ${passUnits.length} pass${passUnits.length === 1 ? '' : 'es'}` : ''}`,
              metadata: {
                total,
                itemCount: orderItems.length,
                passCount: passUnits.length,
                paymentChannel,
                gatewayFeeAmount,
                ...(promoCodeRecord && { promoCode: promoCodeRecord.code, discountAmount }),
              },
            },
            { client: tx }
          );

          // orderRepository.create's own returned object was fetched before
          // the Pass rows above existed (they're issued via separate
          // queries afterward, unlike Merchandise's OrderItems which nest
          // inside the same .create() call) — so createdOrder.passes would
          // otherwise be permanently stale-empty on the object this
          // function returns. Re-fetch once passes exist so the immediate
          // gateway-failure path below (releaseStock(order), same request,
          // no webhook/re-fetch involved) sees them — the webhook/expiry
          // release path was already safe, since it always re-fetches the
          // order fresh before calling releaseStock.
          return passUnits.length > 0 ? orderRepository.findById(createdOrder._id, { client: tx }) : createdOrder;
        }, { timeout: 15000 }); // 2 round trips per item plus the order create — see releaseStock's matching note
      } catch (error) {
        if (error instanceof productRepository.InsufficientStockError) {
          const name = productNames[error.productId] || 'item';
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${name}${error.color ? ` - ${error.color}` : ''} - Size ${error.size}`
          });
        }
        if (error instanceof passRepository.InsufficientPassCapacityError) {
          return res.status(400).json({
            success: false,
            message: 'Not enough passes remaining at that tier.'
          });
        }
        if (error instanceof promoCodeRepository.PromoCodeExhaustedError) {
          return res.status(400).json({
            success: false,
            message: 'This promo code just reached its redemption limit. Please remove it and try again.'
          });
        }
        throw error;
      }

      if (req.user) await accountCache.invalidateHome(req.user._id);

      // Gateway checkout session creation is an external call —
      // deliberately outside the DB transaction above, both because an
      // external call can't be rolled back and because holding a
      // transaction open across a slow network call would hold row locks
      // far longer than necessary.
      try {
        const { paymentReference, redirectUrl } = await paymentService.createCheckoutSession(order);

        await orderRepository.updateById(order._id, { mayaPaymentId: paymentReference, mayaCheckoutUrl: redirectUrl });

        // Payment Platform Redesign, Phase 1 — dual-write the first attempt
        // row. Best-effort: the customer's checkout must not fail because
        // this insert did, since Order's own paymentMethod/mayaPaymentId/
        // mayaCheckoutUrl fields above already carry everything the rest
        // of the app reads today.
        const sessionDurationMs = paymentService.getSessionDurationMs(order.paymentMethod);
        paymentRepository.create({
          orderId: order._id,
          provider: order.paymentMethod,
          checkoutReference: paymentReference,
          checkoutUrl: redirectUrl,
          expiresAt: sessionDurationMs ? new Date(Date.now() + sessionDurationMs) : null,
        }).catch((paymentError) => {
          logger.error({ err: paymentError, orderNumber: order.orderNumber }, 'Failed to dual-write initial Payment row');
          Sentry.captureException(paymentError);
        });

        await orderEventRepository.create({
          orderId: order._id,
          type: 'payment_pending',
          actor: 'system',
          message: `Checkout session created via ${order.paymentMethod}`,
          metadata: { paymentId: paymentReference, gateway: order.paymentMethod },
        });

        logger.info(
          { orderNumber: order.orderNumber, paymentId: paymentReference, gateway: order.paymentMethod, customerId: req.user?._id },
          'Order created'
        );

        // Payment Platform Redesign, Phase 6 originally sent a "Complete
        // Your Payment" email unconditionally right here, immediately after
        // this response — but that fires before the customer's browser has
        // even redirected to the gateway, so a customer who pays in one
        // sitting got it and "Order Confirmed" seconds apart. Pending-
        // Payment Email UX Revision moved this to a delayed reminder
        // instead: lib/sendPaymentReminders.js's hourly sweep now sends the
        // same "Complete Your Payment" content (sendPaymentPendingEmail),
        // but only to an order still genuinely `awaiting_payment` 30+
        // minutes after this moment — never to one that already resolved.
        // The `payment_pending` OrderEvent above still records this moment
        // for the audit trail regardless of whether any email follows it.

        res.status(201).json({
          success: true,
          message: 'Order created successfully',
          data: {
            orderNumber: order.orderNumber,
            checkoutUrl: redirectUrl
          }
        });
      } catch (gatewayError) {
        // Checkout could never be paid for — release the reservation
        // (Commerce Engine: stock reserved at placement releases
        // automatically when checkout doesn't complete) rather than
        // leaving it permanently decremented with no way to pay for it.
        logger.error(
          { err: gatewayError, orderNumber: order.orderNumber, gateway: order.paymentMethod },
          'Gateway checkout session creation failed'
        );
        Sentry.captureException(gatewayError);
        await releaseStock(order);
        await orderRepository.updateById(order._id, { paymentStatus: 'failed' });
        await orderEventRepository.create({
          orderId: order._id,
          type: 'payment_failed',
          actor: 'system',
          message: `Gateway checkout session creation failed (${order.paymentMethod}) — stock released`,
          metadata: { gateway: order.paymentMethod, error: gatewayError.message },
        });

        return res.status(500).json({
          success: false,
          message: 'Failed to initialize payment. Please try again.',
          orderNumber: order.orderNumber
        });
      }
    } catch (error) {
      logger.error({ err: error, email: req.body?.email, customerId: req.user?._id }, 'Create order error');
      Sentry.captureException(error);
      res.status(500).json({
        success: false,
        message: 'Failed to create order'
      });
    }
  }
);

// Get admin dashboard stats
router.get('/admin/stats',
  authenticate,
  isAdmin,
  requirePermission(PERMISSIONS.ORDERS_VIEW),
  async (req, res) => {
    try {
      const [revenueStats, topSellingProducts, ordersByStatus, lowStockProducts] = await Promise.all([
        orderRepository.getRevenueStats(),
        orderRepository.getTopSellingProducts(5),
        orderRepository.getOrdersByStatus(),
        productRepository.find({
          where: { active: true, totalStock: { lte: 5 } },
          orderBy: { totalStock: 'asc' },
          take: 10,
        }),
      ]);

      res.json({
        success: true,
        data: {
          totalRevenue: revenueStats.totalRevenue,
          paidOrdersCount: revenueStats.paidOrdersCount,
          revenueThisMonth: revenueStats.revenueThisMonth,
          monthlyOrdersCount: revenueStats.monthlyOrdersCount,
          topSellingProducts,
          ordersByStatus,
          lowStockProducts
        }
      });
    } catch (error) {
      logger.error({ err: error }, 'Get admin stats error');
      Sentry.captureException(error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve admin stats'
      });
    }
  }
);

// Export orders as CSV (Admin only)
router.get('/admin/export',
  authenticate,
  isAdmin,
  requirePermission(PERMISSIONS.ORDERS_VIEW),
  async (req, res) => {
    try {
      const { period = 'all' } = req.query;

      const now = new Date();
      let startDate = null;

      if (period === 'daily') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (period === 'weekly') {
        const day = now.getDay(); // 0=Sun
        const diffToMon = (day === 0 ? -6 : 1 - day);
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon);
      } else if (period === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (period === 'yearly') {
        startDate = new Date(now.getFullYear(), 0, 1);
      }

      const where = startDate ? { createdAt: { gte: startDate } } : {};

      const orders = await orderRepository.find({
        where,
        orderBy: { createdAt: 'desc' },
        include: { items: true, user: true },
      });

      const fmt = (d) => {
        const dt = new Date(d);
        return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
      };

      const reportStart = startDate ? fmt(startDate) : fmt(orders.length ? orders[orders.length - 1].createdAt : now);
      const reportEnd = fmt(now);

      const meta = [
        `Report Start Date,${reportStart}`,
        `Report End Date,${reportEnd}`,
        ''
      ];

      const headers = [
        'Order #', 'Date', 'Customer', 'Email',
        'Items', 'Subtotal', 'Shipping Fee', 'Total',
        'Payment Status', 'Order Status', 'Courier', 'Tracking #'
      ];

      const rows = orders.map((o) => {
        const customer = o.user
          ? `${o.user.firstName} ${o.user.lastName}`
          : o.shippingAddress?.fullName || '';
        const email = o.user ? o.user.email : o.email;
        const items = (o.items || [])
          .map(i => `${i.name}${i.color ? ` (${i.color})` : ''} ${i.size} x${i.quantity}`)
          .join('; ');
        return [
          escapeCsvCell(o.orderNumber),
          escapeCsvCell(fmt(o.createdAt)),
          escapeCsvCell(customer),
          escapeCsvCell(email),
          escapeCsvCell(items),
          escapeCsvCell(o.subtotal?.toFixed(2)),
          escapeCsvCell(o.shippingFee?.toFixed(2)),
          escapeCsvCell(o.total?.toFixed(2)),
          escapeCsvCell(o.paymentStatus),
          escapeCsvCell(o.orderStatus),
          escapeCsvCell(o.courier || ''),
          escapeCsvCell(o.trackingNumber || '')
        ].join(',');
      });

      const csv = [...meta, headers.join(','), ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="transaction-report.csv"');
      res.send(csv);
    } catch (error) {
      logger.error({ err: error }, 'Export orders error');
      Sentry.captureException(error);
      res.status(500).json({ success: false, message: 'Failed to export orders' });
    }
  }
);

// Get order by order number
// Verify payment status with Maya (called when user returns from checkout)
router.post('/:orderNumber/verify-payment', optionalAuth, async (req, res) => {
  try {
    const order = await orderRepository.findByOrderNumber(req.params.orderNumber);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!canAccessOrder(order, req)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Already resolved — no need to check again
    if (order.paymentStatus === 'paid' || order.paymentStatus === 'failed') {
      return res.json({ success: true, data: { paymentStatus: order.paymentStatus } });
    }

    if (!order.mayaPaymentId) {
      return res.json({ success: true, data: { paymentStatus: order.paymentStatus } });
    }

    // Poll the gateway for checkout status
    const { status } = await paymentService.getPaymentStatus(order.mayaPaymentId, order.paymentMethod);
    const paymentStatus = await applyPaymentResolution(order, status, 'customer');

    res.json({ success: true, data: { paymentStatus } });
  } catch (error) {
    logger.error({ err: error, orderNumber: req.params.orderNumber }, 'Verify payment error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to verify payment' });
  }
});

router.get('/:orderNumber', optionalAuth, async (req, res) => {
  try {
    const order = await orderRepository.findByOrderNumber(req.params.orderNumber, {
      include: { items: { include: { product: true } }, passes: true },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (!canAccessOrder(order, req)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Payment Platform Redesign, Phase 3 — the Pending Payment experience
    // needs the *attempt's* own status/expiresAt, not just Order's coarser
    // paymentStatus. Nested under `payment`, only the fields a customer
    // should see (never providerMetadata, the raw gateway response).
    const latestPayment = await paymentRepository.findLatestForOrder(order._id);
    const payment = latestPayment
      ? {
          provider: latestPayment.provider,
          status: latestPayment.status,
          expiresAt: latestPayment.expiresAt,
          checkoutUrl: latestPayment.checkoutUrl,
        }
      : null;

    // `passes: true` above is only the flat scalar list (same shape
    // DEFAULT_INCLUDE already carries) — enough to know whether this
    // order has any. Only Pass orders pay for the extra round trip to
    // enrich them with passEvent/passTier (the same fetch
    // applyPaymentResolution does for the confirmation email); the
    // overwhelming majority of orders are Merchandise with none, and were
    // paying for that unconditionally until this fix — a real, avoidable
    // latency hit on every single order confirmation page load.
    let passes = order.passes?.length ? await passRepository.findByOrderId(order._id) : [];

    // A customer read must not wait for Cloudinary. Existing persisted URLs
    // remain preferred; a new pass gets a transient local QR data URL for
    // this response while the payment side effect persists the Cloudinary
    // copy for email and later reads.
    if (passes.length) {
      passes = await Promise.all(passes.map(async (pass) => ({
        ...pass,
        qrCodeUrl: pass.qrCodeUrl || await getPassQrCodeDataUrl(pass),
      })));
    }

    res.json({
      success: true,
      data: { ...order, payment, passes }
    });
  } catch (error) {
    logger.error({ err: error }, 'Get order error');
    Sentry.captureException(error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve order'
    });
  }
});

// POST /:orderNumber/pay — "Complete Payment" / "Generate New Payment Link"
// (Payment Platform Redesign, Phase 3). Always a server-side decision, never
// a client-cached checkoutUrl: whether a session is still valid is exactly
// the "never depend solely on Maya for state" fact only Payment.expiresAt
// can answer safely — the customer's own tab has no way to know if the
// session was already consumed or expired since it last loaded the page.
// Same optionalAuth/ownership pattern as GET /:orderNumber — order number
// itself is the bearer secret for a guest order.
router.post('/:orderNumber/pay', optionalAuth, async (req, res) => {
  try {
    const order = await orderRepository.findByOrderNumber(req.params.orderNumber);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!canAccessOrder(order, req)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'This order is already paid' });
    }
    if (order.orderStatus === 'cancelled') {
      return res.status(400).json({ success: false, message: 'This order has been cancelled and can no longer be paid' });
    }

    // 1. Is there an active session already? Redirect straight to it.
    const latestPayment = await paymentRepository.findLatestForOrder(order._id);
    const stillValid = latestPayment
      && latestPayment.status === 'pending'
      && latestPayment.checkoutUrl
      && latestPayment.expiresAt
      && new Date(latestPayment.expiresAt) > new Date();

    if (stillValid) {
      return res.json({
        success: true,
        data: { checkoutUrl: latestPayment.checkoutUrl, expiresAt: latestPayment.expiresAt, resumed: true },
      });
    }

    // 2. No valid session — generate a brand new one. Same flow order
    // creation itself uses, so the customer never has to rebuild their cart.
    const { paymentReference, redirectUrl } = await paymentService.createCheckoutSession(order);

    await orderRepository.updateById(order._id, { mayaPaymentId: paymentReference, mayaCheckoutUrl: redirectUrl });

    const sessionDurationMs = paymentService.getSessionDurationMs(order.paymentMethod);
    const expiresAt = sessionDurationMs ? new Date(Date.now() + sessionDurationMs) : null;
    await paymentRepository.create({
      orderId: order._id,
      provider: order.paymentMethod,
      checkoutReference: paymentReference,
      checkoutUrl: redirectUrl,
      expiresAt,
    });

    await orderEventRepository.create({
      orderId: order._id,
      type: 'payment_pending',
      actor: req.user ? 'customer' : 'system',
      message: `New checkout session generated via ${order.paymentMethod}`,
      metadata: { paymentId: paymentReference, gateway: order.paymentMethod },
    });

    if (order.user) await accountCache.invalidateHome(order.user);

    res.json({ success: true, data: { checkoutUrl: redirectUrl, expiresAt, resumed: false } });
  } catch (error) {
    logger.error({ err: error, orderNumber: req.params.orderNumber }, 'Resume/regenerate checkout error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to generate a new payment link. Please try again.' });
  }
});

// Get user's orders
router.get('/user/:userId', authenticate, async (req, res) => {
  try {
    if (req.params.userId !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const orders = await orderRepository.find({
      where: { userId: req.params.userId },
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { product: true } } },
    });

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    logger.error({ err: error }, 'Get user orders error');
    Sentry.captureException(error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve orders'
    });
  }
});

// Maya webhook handler
//
// The original handler trusted `req.body.status` directly to decide
// whether to mark an order paid — the platform audit's single most
// severe finding, and something CLAUDE.md explicitly forbids ("No
// webhook payload is trusted without signature verification, on any
// current or future integration"). Maya's Checkout API webhook product
// does not document a verifiable payload-signing scheme the way some of
// their other APIs do (their own Webhook Guide recommends IP allowlisting
// instead, and no signing secret exists anywhere in this codebase's
// config) — so rather than fabricate a signature check against an
// unconfirmed scheme, this treats the POST as nothing more than a wake-up
// signal. The actual payment status is decided by an authenticated pull
// against Maya's own API (paymentService.getPaymentStatus, signed with our
// secret key) — the same trusted mechanism /verify-payment already relies
// on. A forged webhook can, at worst, trigger one redundant, harmless
// status check; it can never itself flip an order to paid or failed.
router.post('/webhooks/maya', mayaWebhookIpAllowlist, async (req, res) => {
  try {
    const { requestReferenceNumber } = req.body || {};
    if (!requestReferenceNumber) {
      return res.status(400).json({ success: false });
    }

    // mayaGateway.js sends `${orderNumber}#${attempt-unique suffix}`, not
    // the bare order number — see that file's comment for why. The order
    // number is always everything before the first '#'.
    const orderNumber = requestReferenceNumber.split('#')[0];
    logger.info({ orderNumber, gateway: 'maya' }, 'Webhook received');

    const order = await orderRepository.findByOrderNumber(orderNumber);
    if (!order || order.paymentStatus === 'paid' || order.paymentStatus === 'failed' || !order.mayaPaymentId) {
      return res.json({ success: true });
    }

    await orderEventRepository.create({
      orderId: order._id,
      type: 'webhook_received',
      actor: 'webhook',
      message: `Webhook received from ${order.paymentMethod}`,
    });

    const { status } = await paymentService.getPaymentStatus(order.mayaPaymentId, order.paymentMethod);
    logger.info({ orderNumber: order.orderNumber, paymentId: order.mayaPaymentId, gateway: order.paymentMethod, status }, 'Webhook verified against gateway');
    await applyPaymentResolution(order, status, 'webhook');

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error, orderNumber: req.body?.requestReferenceNumber }, 'Webhook error');
    Sentry.captureException(error);
    res.status(500).json({ success: false });
  }
});

// Xendit's documented webhook event names for the Payment Sessions product
// — anything not in this map (e.g. an intermediate, non-terminal event)
// falls through to 'pending', the same "unrecognized = still pending"
// convention mayaGateway.js's STATUS_MAP already uses.
const XENDIT_WEBHOOK_EVENT_STATUS = {
  'payment_session.completed': 'succeeded',
  'payment_session.expired': 'expired',
  'payment.failure': 'failed',
};

// Xendit webhook handler — token-verified by xenditWebhookVerify before
// this ever runs (see that file's comment for why the payload can be
// trusted directly here, unlike Maya's below: Xendit signs its webhooks,
// Maya doesn't). See ADR-010.
//
// The payload envelope (`event` name + a `data` object carrying the
// session/payment) matches Xendit's documented shape for its other webhook
// families but was not confirmed against a real delivery for Payment
// Sessions specifically at write time — verify field names here against
// Xendit Dashboard > Webhooks > "Send test webhook" before relying on this
// in production.
router.post('/webhooks/xendit', xenditWebhookVerify, async (req, res) => {
  try {
    const { event, data } = req.body || {};
    const referenceId = data?.reference_id;
    if (!referenceId) {
      return res.status(400).json({ success: false });
    }

    // xenditGateway.js sends `${orderNumber}#${attempt-unique suffix}` as
    // reference_id — same attempt-scoped-not-order-scoped convention
    // Maya's requestReferenceNumber already established (ADR-008). The
    // order number is always everything before the first '#'.
    const orderNumber = referenceId.split('#')[0];
    logger.info({ orderNumber, gateway: 'xendit', event }, 'Webhook received');

    const order = await orderRepository.findByOrderNumber(orderNumber);
    if (!order || order.paymentStatus === 'paid' || order.paymentStatus === 'failed' || !order.mayaPaymentId) {
      return res.json({ success: true });
    }

    await orderEventRepository.create({
      orderId: order._id,
      type: 'webhook_received',
      actor: 'webhook',
      message: `Webhook received from ${order.paymentMethod}`,
    });

    const status = XENDIT_WEBHOOK_EVENT_STATUS[event] || 'pending';
    logger.info(
      { orderNumber: order.orderNumber, gateway: order.paymentMethod, event, status },
      'Webhook token verified — trusting payload status directly (see ADR-010)'
    );
    await applyPaymentResolution(order, status, 'webhook');

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error, referenceId: req.body?.data?.reference_id }, 'Webhook error');
    Sentry.captureException(error);
    res.status(500).json({ success: false });
  }
});

// Same 2-decimal-place rounding lib/payments/xenditFees.js's
// calculateGatewayFee already uses for money — comparing two floats
// directly risks a false mismatch from binary floating-point
// representation (e.g. 599.10000000001 !== 599.1); rounding both sides to
// centavos first is this codebase's existing convention for that, not a
// new one invented for this check.
function amountsMatch(gatewayAmount, orderTotal) {
  const round = (value) => Math.round(Number(value) * 100) / 100;
  return round(gatewayAmount) === round(orderTotal);
}

// ePayGames webhook handler — a real HMAC signature exists (verified by
// epaygamesWebhookVerify above), but this still treats the POST as nothing
// more than a wake-up signal, the same as Maya's handler below rather than
// Xendit's "trust the verified payload directly" shape (ADR-010). Two
// reasons this gateway gets the more conservative treatment despite having
// a real signature: the signature only covers `amount`+`reference_no`, not
// `status` itself (see epaygamesWebhookVerify.js's own header comment),
// and this is a newer, less-proven-in-production integration than Xendit.
// The actual payment status is decided by an authenticated pull against
// ePayGames' own API (paymentService.getPaymentStatus) — the same trusted
// mechanism /verify-payment already relies on for every gateway. A forged
// or replayed webhook can, at worst, trigger one redundant, harmless
// status check; it can never itself flip an order to paid or failed.
router.post('/webhooks/epaygames', epaygamesWebhookVerify, async (req, res) => {
  try {
    const referenceNo = req.body?.data?.reference_no;
    if (!referenceNo) {
      return res.status(400).json({ success: false });
    }

    // epaygamesGateway.js sends `${orderNumber}__${attempt-unique suffix}` —
    // attempt-scoped-not-order-scoped, the same shape Maya's
    // requestReferenceNumber and Xendit's reference_id already established
    // (ADR-008/ADR-010), but with '__' instead of their shared '#'. ePayGames
    // is the only gateway using this delimiter — confirmed directly against
    // the real sandbox (2026-08-28) that a '#' makes ePayGames' own hosted-
    // checkout page fail to load (their deferred/load step 500s), while
    // '__' does not; Xendit/Maya's own webhook handlers are untouched and
    // keep parsing on '#'. The order number is always everything before the
    // first '__'.
    const orderNumber = referenceNo.split('__')[0];
    logger.info({ orderNumber, gateway: 'epaygames' }, 'Webhook received');

    const order = await orderRepository.findByOrderNumber(orderNumber);
    if (!order || order.paymentStatus === 'paid' || order.paymentStatus === 'failed' || !order.mayaPaymentId) {
      return res.json({ success: true });
    }

    await orderEventRepository.create({
      orderId: order._id,
      type: 'webhook_received',
      actor: 'webhook',
      message: `Webhook received from ${order.paymentMethod}`,
    });

    // WEBHOOK ≠ PROOF OF PAYMENT — req.body's own status/amount are never
    // read for the resolution decision below, only for the mismatch checks
    // that can block it. A lookup failure leaves the order exactly as it
    // was — no resolution attempted — rather than guessing either way;
    // the customer's own /verify-payment poll or the hourly expiry sweep
    // remain the recovery path, same as any other gateway.
    let statusResult;
    try {
      statusResult = await paymentService.getPaymentStatus(order.mayaPaymentId, order.paymentMethod);
    } catch (error) {
      logger.error({ err: error, orderNumber, gateway: 'epaygames' }, 'ePayGames webhook status lookup failed — order left unresolved');
      Sentry.captureException(error);
      return res.json({ success: true });
    }

    const { status, raw } = statusResult;

    // Reference check — the transaction the lookup actually returned must
    // be the same one this order's Payment row is waiting on. Without
    // this, a valid, correctly-signed webhook for some OTHER transaction
    // could still resolve THIS order, as long as the two happened to share
    // an order-number prefix.
    if (raw?.reference_no && raw.reference_no !== referenceNo) {
      logger.error(
        { orderNumber, expectedReference: referenceNo, gotReference: raw.reference_no, gateway: 'epaygames' },
        'ePayGames webhook reference mismatch — order left unresolved'
      );
      return res.json({ success: true });
    }

    // Amount check — only meaningful for a claimed success; a failed/
    // expired/pending resolution has no money-movement claim to verify.
    if (status === 'succeeded' && raw && typeof raw.amount !== 'undefined' && !amountsMatch(raw.amount, order.total)) {
      logger.error(
        { orderNumber, expectedAmount: order.total, gotAmount: raw.amount, gateway: 'epaygames' },
        'ePayGames webhook amount mismatch — order left unresolved'
      );
      return res.json({ success: true });
    }

    logger.info(
      { orderNumber: order.orderNumber, paymentId: order.mayaPaymentId, gateway: order.paymentMethod, status },
      'Webhook verified against gateway'
    );
    await applyPaymentResolution(order, status, 'webhook');

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error, referenceNo: req.body?.data?.reference_no }, 'Webhook error');
    Sentry.captureException(error);
    res.status(500).json({ success: false });
  }
});

// Get an order's audit trail (Admin only) — backs the Admin Order Timeline.
router.get('/:orderNumber/events', authenticate, isAdmin, requirePermission(PERMISSIONS.ORDERS_VIEW), async (req, res) => {
  try {
    const order = await orderRepository.findByOrderNumber(req.params.orderNumber);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const events = await orderEventRepository.findByOrder(order._id);
    res.json({ success: true, data: events });
  } catch (error) {
    logger.error({ err: error, orderNumber: req.params.orderNumber }, 'Get order events error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve order history' });
  }
});

// Update order status (Admin only)
router.patch('/:id/status',
  authenticate,
  isAdmin,
  requirePermission(PERMISSIONS.ORDERS_MANAGE),
  async (req, res) => {
    try {
      // Enterprise Fulfillment Blueprint, Phase 1 — courier/trackingNumber
      // are deliberately no longer settable here. Once a Shipment exists,
      // routes/shipments.js's PATCH /:id/status is the only writer (and it
      // dual-writes onto these same Order columns) — letting this endpoint
      // ALSO write them directly would reopen the exact "two independently
      // editable copies drift apart" problem this Blueprint exists to
      // close, just for shipping fields instead of status.
      const { orderStatus } = req.body;

      if (orderStatus !== undefined && !VALID_ORDER_STATUSES.includes(orderStatus)) {
        return res.status(400).json({
          success: false,
          message: `orderStatus must be one of: ${VALID_ORDER_STATUSES.join(', ')}`,
        });
      }

      const before = await orderRepository.findById(req.params.id);
      if (!before) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      const order = await orderRepository.updateById(req.params.id, { orderStatus });

      const changes = [];
      if (orderStatus && orderStatus !== before.orderStatus) {
        changes.push(`status: ${before.orderStatus} → ${orderStatus}`);
      }

      if (changes.length > 0) {
        await orderEventRepository.create({
          orderId: order._id,
          type: 'status_updated',
          actor: 'admin',
          actorUserId: req.user._id,
          message: changes.join('; '),
          metadata: { orderStatus },
        });
      }

      if (before.user) await accountCache.invalidateHome(before.user);

      // Payment Platform Redesign, Phase 6's sendOrderStatusEmail call
      // used to live here too, but every value it actually covers
      // (processing/packed/shipped/delivered/cancelled/returned) is no
      // longer reachable through this endpoint as of the Enterprise
      // Fulfillment Blueprint (see VALID_ORDER_STATUSES above) — it would
      // have silently no-op'd for every remaining value this route can
      // still set, which already have their own dedicated emails in the
      // payment lifecycle (applyPaymentResolution). Removed rather than
      // left calling a function that could never do anything here again.

      res.json({
        success: true,
        message: 'Order status updated successfully',
        data: order
      });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }
      logger.error({ err: error }, 'Update order status error');
      Sentry.captureException(error);
      res.status(500).json({
        success: false,
        message: 'Failed to update order status'
      });
    }
  }
);

// Get all orders (Admin only)
router.get('/admin/all',
  authenticate,
  isAdmin,
  requirePermission(PERMISSIONS.ORDERS_VIEW),
  async (req, res) => {
    try {
      const {
        status,
        paymentStatus
      } = req.query;

      const where = {};
      if (status) where.orderStatus = status;
      if (paymentStatus) where.paymentStatus = paymentStatus;

      const { page, limit, skip } = normalizePagination(req.query, 20);

      const [orders, total] = await Promise.all([
        orderRepository.find({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: { user: true, items: { include: { product: true } } },
        }),
        orderRepository.count({ where }),
      ]);

      res.json({
        success: true,
        data: orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error({ err: error }, 'Get all orders error');
      Sentry.captureException(error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve orders'
      });
    }
  }
);

export default router;
