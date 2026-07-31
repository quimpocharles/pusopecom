import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma.js';
import * as orderRepository from '../repositories/orderRepository.js';
import * as productRepository from '../repositories/productRepository.js';
import * as shippingEventRepository from '../repositories/shippingEventRepository.js';
import * as venuePickupConfigRepository from '../repositories/venuePickupConfigRepository.js';
import { getDomesticRate, getInternationalRate, isSlotActive } from '../lib/shipping/calculateShipping.js';
import { authenticate, isAdmin, optionalAuth } from '../middleware/auth.js';
import { createCheckout, getCheckoutStatus } from '../services/mayaService.js';
import { sendOrderConfirmationEmail } from '../services/emailService.js';

const router = express.Router();

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
 * Applies the consequences of a resolved Maya payment status. Shared by
 * both /verify-payment (the customer's browser polling after returning
 * from checkout) and the webhook — the two paths converge here so a
 * payment is only ever resolved once, via tryResolvePayment's atomic
 * guard, regardless of which path notices first.
 */
async function applyPaymentResolution(order, mayaPaymentStatus) {
  if (mayaPaymentStatus === 'PAYMENT_SUCCESS') {
    // applied is false only when a concurrent request already resolved
    // this order — Maya's answer is still authoritative either way, so
    // the caller can trust 'paid' as the return value regardless.
    const applied = await orderRepository.tryResolvePayment(order._id, 'paid', { orderStatus: 'confirmed' });
    if (applied) {
      try {
        await shippingEventRepository.create({
          orderId: order.orderNumber,
          shippingMethod: order.shippingMethod || 'unknown',
          orderTotal: order.total,
          region: order.shippingRegion || null,
        });
      } catch (shippingEventError) {
        logger.error({ err: shippingEventError }, 'Failed to record shipping event');
        Sentry.captureException(shippingEventError);
      }

      try {
        await sendOrderConfirmationEmail(order.email, order);
      } catch (emailError) {
        logger.error({ err: emailError }, 'Failed to send confirmation email');
        Sentry.captureException(emailError);
      }
    }
    return 'paid';
  }

  if (mayaPaymentStatus === 'PAYMENT_FAILED' || mayaPaymentStatus === 'PAYMENT_EXPIRED') {
    const applied = await orderRepository.tryResolvePayment(order._id, 'failed');
    if (applied) await releaseStock(order);
    return 'failed';
  }

  return order.paymentStatus; // still pending — Maya hasn't resolved it yet
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

          return orderRepository.create(
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

      // Maya checkout session creation is an external call — deliberately
      // outside the DB transaction above, both because an external call
      // can't be rolled back and because holding a transaction open across
      // a slow network call would hold row locks far longer than necessary.
      try {
        const { checkoutId, redirectUrl } = await createCheckout(order);

        await orderRepository.updateById(order._id, { mayaPaymentId: checkoutId, mayaCheckoutUrl: redirectUrl });

        res.status(201).json({
          success: true,
          message: 'Order created successfully',
          data: {
            orderNumber: order.orderNumber,
            checkoutUrl: redirectUrl
          }
        });
      } catch (mayaError) {
        // Checkout could never be paid for — release the reservation
        // (Commerce Engine: stock reserved at placement releases
        // automatically when checkout doesn't complete) rather than
        // leaving it permanently decremented with no way to pay for it.
        logger.error({ err: mayaError }, 'Maya checkout failed');
        Sentry.captureException(mayaError);
        await releaseStock(order);
        await orderRepository.updateById(order._id, { paymentStatus: 'failed' });

        return res.status(500).json({
          success: false,
          message: 'Failed to initialize payment. Please try again.',
          orderNumber: order.orderNumber
        });
      }
    } catch (error) {
      logger.error({ err: error }, 'Create order error');
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

    // Poll Maya for checkout status
    const checkoutData = await getCheckoutStatus(order.mayaPaymentId);
    const paymentStatus = await applyPaymentResolution(order, checkoutData.paymentStatus);

    res.json({ success: true, data: { paymentStatus } });
  } catch (error) {
    logger.error({ err: error }, 'Verify payment error');
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

    res.json({
      success: true,
      data: order
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
// against Maya's own API (getCheckoutStatus, signed with our secret key)
// — the same trusted mechanism /verify-payment already relies on. A
// forged webhook can, at worst, trigger one redundant, harmless status
// check; it can never itself flip an order to paid or failed.
router.post('/webhooks/maya', async (req, res) => {
  try {
    const { requestReferenceNumber } = req.body || {};
    if (!requestReferenceNumber) {
      return res.status(400).json({ success: false });
    }

    const order = await orderRepository.findByOrderNumber(requestReferenceNumber);
    if (!order || order.paymentStatus === 'paid' || order.paymentStatus === 'failed' || !order.mayaPaymentId) {
      return res.json({ success: true });
    }

    const checkoutData = await getCheckoutStatus(order.mayaPaymentId);
    await applyPaymentResolution(order, checkoutData.paymentStatus);

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Webhook error');
    Sentry.captureException(error);
    res.status(500).json({ success: false });
  }
});

// Update order status (Admin only)
router.patch('/:id/status',
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const { orderStatus, trackingNumber, courier } = req.body;

      const order = await orderRepository.updateById(req.params.id, {
        orderStatus,
        ...(trackingNumber !== undefined && { trackingNumber }),
        ...(courier !== undefined && { courier })
      });

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
