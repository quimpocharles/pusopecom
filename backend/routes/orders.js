import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma.js';
import * as orderRepository from '../repositories/orderRepository.js';
import * as orderEventRepository from '../repositories/orderEventRepository.js';
import * as paymentRepository from '../repositories/paymentRepository.js';
import * as productRepository from '../repositories/productRepository.js';
import * as shippingEventRepository from '../repositories/shippingEventRepository.js';
import * as venuePickupConfigRepository from '../repositories/venuePickupConfigRepository.js';
import { getDomesticRate, getInternationalRate, isSlotActive } from '../lib/shipping/calculateShipping.js';
import { authenticate, isAdmin, optionalAuth } from '../middleware/auth.js';
import { mayaWebhookIpAllowlist } from '../middleware/mayaWebhookIpAllowlist.js';
import * as paymentService from '../services/paymentService.js';
import { sendOrderConfirmationEmail } from '../services/emailService.js';
import * as accountCache from '../lib/accountCache.js';
import * as fitCheckBonus from '../lib/fitCheckBonus.js';

const router = express.Router();

// Every OrderStatus value an admin may set manually, via PATCH /:id/status —
// deliberately excludes 'confirmed', the legacy value Payment Platform
// Redesign Phase 2 superseded with 'paid'; nothing should set it again,
// including a manual admin edit.
const VALID_ORDER_STATUSES = [
  'awaiting_payment', 'paid', 'processing', 'packed', 'shipped', 'delivered',
  'returned', 'cancelled', 'expired', 'failed_payment',
];

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

async function applyPaymentResolution(order, gatewayStatus, source = 'system') {
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

      try {
        await sendOrderConfirmationEmail(order.email, order);
        logger.info(logContext, 'Confirmation email sent');
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
    body('items').isArray({ min: 1 }),
    body('shippingAddress').isObject(),
    body('shippingAddress.fullName').trim().notEmpty(),
    body('shippingAddress.phone').trim().notEmpty(),
    body('shippingAddress.address').trim().notEmpty(),
    body('shippingAddress.city').trim().notEmpty(),
    body('shippingAddress.province').trim().notEmpty(),
    body('shippingAddress.zipCode').trim().notEmpty(),
    body('shippingAddress.country').optional().trim(),
    body('shippingAddress.region').optional().trim(),
    body('shippingAddress.barangay').optional().trim()
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

      const { email, items, shippingAddress, notes, shippingMethod, shippingRegion, slotId } = req.body;

      // Pass 1 — structural validation and price/image resolution. Not
      // itself the stock-sufficiency check (that's the atomic
      // decrementStock call below); this only confirms the product and
      // the requested size/color combination exist at all.
      let subtotal = 0;
      const orderItems = [];
      const productNames = {};

      for (const item of items) {
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

      // Recalculate shipping fee server-side — never trust the client value
      const country = shippingAddress?.country || 'Philippines';
      let shippingFee;

      if (shippingMethod === 'venue_pickup' && country === 'Philippines') {
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

      const total = subtotal + shippingFee;

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

          const createdOrder = await orderRepository.create(
            {
              userId: req.user?._id,
              email,
              items: orderItems,
              shippingAddress,
              subtotal,
              shippingFee,
              total,
              shippingMethod: shippingMethod || undefined,
              shippingRegion: shippingRegion || undefined,
              notes
            },
            { client: tx }
          );

          await orderEventRepository.create(
            {
              orderId: createdOrder._id,
              type: 'created',
              actor: req.user ? 'customer' : 'system',
              message: `Order placed with ${orderItems.length} item${orderItems.length === 1 ? '' : 's'}`,
              metadata: { total, itemCount: orderItems.length },
            },
            { client: tx }
          );

          return createdOrder;
        }, { timeout: 15000 }); // 2 round trips per item plus the order create — see releaseStock's matching note
      } catch (error) {
        if (error instanceof productRepository.InsufficientStockError) {
          const name = productNames[error.productId] || 'item';
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${name}${error.color ? ` - ${error.color}` : ''} - Size ${error.size}`
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

      const escape = (val) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
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
          escape(o.orderNumber),
          escape(fmt(o.createdAt)),
          escape(customer),
          escape(email),
          escape(items),
          escape(o.subtotal?.toFixed(2)),
          escape(o.shippingFee?.toFixed(2)),
          escape(o.total?.toFixed(2)),
          escape(o.paymentStatus),
          escape(o.orderStatus),
          escape(o.courier || ''),
          escape(o.trackingNumber || '')
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
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check authorization
    if (order.user && req.user) {
      if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
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

    res.json({
      success: true,
      data: { ...order, payment }
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

    if (order.user && req.user) {
      if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
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

    logger.info({ orderNumber: requestReferenceNumber, gateway: 'maya' }, 'Webhook received');

    const order = await orderRepository.findByOrderNumber(requestReferenceNumber);
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

// Get an order's audit trail (Admin only) — backs the Admin Order Timeline.
router.get('/:orderNumber/events', authenticate, isAdmin, async (req, res) => {
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
  async (req, res) => {
    try {
      const { orderStatus, trackingNumber, courier } = req.body;

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

      const order = await orderRepository.updateById(req.params.id, {
        orderStatus,
        ...(trackingNumber !== undefined && { trackingNumber }),
        ...(courier !== undefined && { courier })
      });

      const changes = [];
      if (orderStatus && orderStatus !== before.orderStatus) {
        changes.push(`status: ${before.orderStatus} → ${orderStatus}`);
      }
      if (courier !== undefined && courier !== before.courier) {
        changes.push(`courier: ${before.courier || '—'} → ${courier || '—'}`);
      }
      if (trackingNumber !== undefined && trackingNumber !== before.trackingNumber) {
        changes.push(`tracking: ${before.trackingNumber || '—'} → ${trackingNumber || '—'}`);
      }

      if (changes.length > 0) {
        await orderEventRepository.create({
          orderId: order._id,
          type: 'status_updated',
          actor: 'admin',
          actorUserId: req.user._id,
          message: changes.join('; '),
          metadata: { orderStatus, trackingNumber, courier },
        });
      }

      if (before.user) await accountCache.invalidateHome(before.user);

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
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        paymentStatus
      } = req.query;

      const where = {};
      if (status) where.orderStatus = status;
      if (paymentStatus) where.paymentStatus = paymentStatus;

      const skip = (Number(page) - 1) * Number(limit);

      const [orders, total] = await Promise.all([
        orderRepository.find({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: Number(limit),
          include: { user: true, items: { include: { product: true } } },
        }),
        orderRepository.count({ where }),
      ]);

      res.json({
        success: true,
        data: orders,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
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
