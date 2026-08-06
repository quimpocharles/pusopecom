import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import prisma from '../lib/prisma.js';
import * as shipmentRepository from '../repositories/shipmentRepository.js';
import * as shipmentEventRepository from '../repositories/shipmentEventRepository.js';
import * as orderRepository from '../repositories/orderRepository.js';
import * as orderEventRepository from '../repositories/orderEventRepository.js';
import * as paymentRepository from '../repositories/paymentRepository.js';
import * as productRepository from '../repositories/productRepository.js';
import * as refundRepository from '../repositories/refundRepository.js';
import * as stockAdjustmentRepository from '../repositories/stockAdjustmentRepository.js';
import * as notificationRepository from '../repositories/notificationRepository.js';
import * as courierAccountRepository from '../repositories/courierAccountRepository.js';
import * as accountCache from '../lib/accountCache.js';
import { sendOrderStatusEmail } from '../services/emailService.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Enterprise Fulfillment Blueprint, Phase 1 — all routes here are the
// staff-facing Shipment queue. Nothing customer-facing is served from this
// file (compare routes/orders.js, which mixes customer + admin routes
// because Order itself is customer-facing) — Shipment never is.
router.use(authenticate, isAdmin);

// A subset of shipmentRepository.SHIPMENT_TRANSITIONS reachable through
// this generic transition endpoint. 'cancelled' is deliberately excluded
// here — it has real side effects (stock release + Refund creation) and
// gets its own route below so those consequences can never be skipped by
// hitting this one instead.
const GENERIC_TRANSITIONS = new Set([
  'picking', 'packing', 'quality_check', 'ready_for_courier', 'courier_scheduled',
  'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'completed',
  'return_requested', 'return_approved', 'returned', 'refund_pending', 'refunded',
  'exception', 'awaiting_picking',
]);

// The customer-facing coarse read Order.orderStatus derives from
// Shipment.status, rather than either being independently editable (see
// the removed fulfillment values from routes/orders.js's own
// VALID_ORDER_STATUSES). Several granular Shipment stages collapse to the
// same coarse Order status on purpose — a customer doesn't need to know
// their order moved from "quality check" to "ready for courier," only
// that it's "packed." Statuses with no entry here (return_requested,
// return_approved, refund_pending, refunded, exception, cancelled) either
// don't have a customer-facing OrderStatus counterpart yet (Phase 2) or —
// cancelled — are handled by the dedicated /cancel route instead.
const SHIPMENT_TO_ORDER_STATUS = {
  awaiting_picking: 'processing',
  picking: 'processing',
  packing: 'packed',
  quality_check: 'packed',
  ready_for_courier: 'packed',
  courier_scheduled: 'packed',
  picked_up: 'shipped',
  in_transit: 'shipped',
  out_for_delivery: 'shipped',
  delivered: 'delivered',
  completed: 'delivered',
  returned: 'returned',
};

/**
 * Keeps Order.orderStatus in sync with a Shipment transition — reusing the
 * exact email/notification/cache-invalidation side effects the old
 * Order-level PATCH /:id/status endpoint already had, so a customer's
 * experience doesn't regress just because staff now drive this from a
 * different admin surface. A no-op when the mapped coarse status hasn't
 * actually changed (e.g. quality_check -> ready_for_courier both map to
 * 'packed') — no duplicate email for a transition the customer can't tell
 * happened.
 */
async function syncOrderStatus(order, toShipmentStatus, actorUserId) {
  const nextOrderStatus = SHIPMENT_TO_ORDER_STATUS[toShipmentStatus];
  if (!nextOrderStatus || nextOrderStatus === order.orderStatus) return;

  await orderRepository.updateById(order._id, { orderStatus: nextOrderStatus });
  await orderEventRepository.create({
    orderId: order._id,
    type: 'status_updated',
    actor: 'admin',
    actorUserId,
    message: `status: ${order.orderStatus} → ${nextOrderStatus} (via Shipment)`,
    metadata: { orderStatus: nextOrderStatus, shipmentStatus: toShipmentStatus },
  });

  if (order.user) await accountCache.invalidateHome(order.user);

  sendOrderStatusEmail(order.email, order, nextOrderStatus).catch((err) =>
    logger.error({ err, orderNumber: order.orderNumber, nextOrderStatus }, 'Failed to send order-status email')
  );
  if (order.user) {
    notificationRepository.create({
      userId: order.user,
      type: 'order',
      title: `Order ${nextOrderStatus}`,
      body: `Order #${order.orderNumber} is now ${nextOrderStatus}.`,
      link: `/order/${order.orderNumber}`,
    }).catch((err) => logger.error({ err, orderNumber: order.orderNumber }, 'Failed to create order-status notification'));
  }
}

// GET / — the queue view. ?status=picking&warehouseId=&assignedToUserId=&mine=true
router.get('/', async (req, res) => {
  try {
    const { status, warehouseId, assignedToUserId, page = 1, limit = 20 } = req.query;
    const where = {
      ...(status && { status }),
      ...(warehouseId && { warehouseId }),
      ...(assignedToUserId && { assignedToUserId }),
    };
    const skip = (Number(page) - 1) * Number(limit);

    const [shipments, total] = await Promise.all([
      shipmentRepository.find({
        where,
        skip,
        take: Number(limit),
        include: { order: { select: { orderNumber: true, email: true, total: true, shippingMethod: true, user: { select: { firstName: true, lastName: true } } } } },
      }),
      shipmentRepository.count({ where }),
    ]);

    res.json({
      success: true,
      data: shipments,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    logger.error({ err: error }, 'List shipments error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to list shipments' });
  }
});

// Must be registered before GET /:id — otherwise Express would match
// "by-order" itself as the :id param.
router.get('/by-order/:orderId', async (req, res) => {
  try {
    const shipment = await shipmentRepository.findByOrderId(req.params.orderId);
    if (!shipment) return res.status(404).json({ success: false, message: 'No shipment for this order yet' });
    res.json({ success: true, data: shipment });
  } catch (error) {
    logger.error({ err: error }, 'Get shipment by order error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve shipment' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const shipment = await shipmentRepository.findById(req.params.id);
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found' });
    res.json({ success: true, data: shipment });
  } catch (error) {
    logger.error({ err: error }, 'Get shipment error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve shipment' });
  }
});

router.get('/:id/events', async (req, res) => {
  try {
    const events = await shipmentEventRepository.findByShipment(req.params.id);
    res.json({ success: true, data: events });
  } catch (error) {
    logger.error({ err: error }, 'Get shipment events error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve shipment history' });
  }
});

// PATCH /:id/assign — { userId: string | null }
router.patch('/:id/assign', async (req, res) => {
  try {
    const { userId } = req.body;
    const shipment = await shipmentRepository.updateById(req.params.id, { assignedToUserId: userId || null });
    await shipmentEventRepository.create({
      shipmentId: req.params.id,
      type: 'assigned',
      actor: 'admin',
      actorUserId: req.user._id,
      message: userId ? `Assigned to staff member ${userId}` : 'Unassigned',
      metadata: { assignedToUserId: userId || null },
    });
    res.json({ success: true, data: shipment });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Shipment not found' });
    logger.error({ err: error }, 'Assign shipment error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to assign shipment' });
  }
});

// POST /:id/notes — a note is a ShipmentEvent(type: note_added). No
// separate InternalNote table yet, and no department-scoped thread
// splitting yet — one shared thread is enough until real multi-department
// usage actually shows it isn't (see the Blueprint's own "no abstraction
// before the second real use case" discipline, applied here too).
router.post('/:id/notes', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Note text is required' });
    }
    const event = await shipmentEventRepository.create({
      shipmentId: req.params.id,
      type: 'note_added',
      actor: 'admin',
      actorUserId: req.user._id,
      message: message.trim(),
    });
    res.status(201).json({ success: true, data: event });
  } catch (error) {
    logger.error({ err: error }, 'Add shipment note error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to add note' });
  }
});

// PATCH /:id/status — { status, courier?, trackingNumber? }. The generic
// queue-advance action; validated against shipmentRepository's own
// adjacency map, so an illegal jump (e.g. awaiting_picking -> delivered)
// 400s instead of silently succeeding the way the old Order-level endpoint
// let any status follow any other.
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, courier, trackingNumber, courierAccountId } = req.body;
    if (!status || !GENERIC_TRANSITIONS.has(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${[...GENERIC_TRANSITIONS].join(', ')}` });
    }

    const before = await shipmentRepository.findById(req.params.id);
    if (!before) return res.status(404).json({ success: false, message: 'Shipment not found' });

    const result = await shipmentRepository.transition(req.params.id, status, {
      actor: 'admin',
      actorUserId: req.user._id,
    });
    if (!result.applied) return res.status(409).json({ success: false, message: 'Shipment status changed concurrently — refresh and try again' });

    // Phase 3 — courierAccountId is the real FK; `courier` free-text stays
    // dual-written from the account's displayName so every existing reader
    // of the free-text field (AdminOrderDetail.jsx, OrderConfirmation.jsx,
    // status emails) keeps working unchanged. A caller can still pass a
    // bare `courier` string with no account for a courier that has no
    // registered CourierAccount yet — same coexistence discipline this
    // codebase applies to every other field it's ever migrated to a real FK.
    let resolvedCourier = courier;
    if (courierAccountId !== undefined) {
      if (courierAccountId === null) {
        resolvedCourier = resolvedCourier ?? null;
      } else {
        const account = await courierAccountRepository.findById(courierAccountId);
        if (!account) return res.status(400).json({ success: false, message: 'Unknown courierAccountId' });
        resolvedCourier = account.displayName;
      }
    }

    if (courierAccountId !== undefined || resolvedCourier !== undefined || trackingNumber !== undefined) {
      await shipmentRepository.updateById(req.params.id, {
        ...(courierAccountId !== undefined && { courierAccountId }),
        ...(resolvedCourier !== undefined && { courier: resolvedCourier }),
        ...(trackingNumber !== undefined && { trackingNumber }),
      });
      // Dual-write onto Order's own courier/trackingNumber fields — the
      // exact same coexistence pattern ADR-008 established for Payment:
      // Shipment is the new, detailed record; Order's copy stays the fast
      // customer-facing read every existing consumer (OrderConfirmation.jsx,
      // the confirmation/status emails) already depends on. Without this,
      // an operator setting a tracking number here would never actually
      // reach the customer viewing their own order.
      await orderRepository.updateById(before.order._id, {
        ...(resolvedCourier !== undefined && { courier: resolvedCourier }),
        ...(trackingNumber !== undefined && { trackingNumber }),
      });
    }

    await syncOrderStatus(before.order, status, req.user._id);

    const shipment = await shipmentRepository.findById(req.params.id);
    res.json({ success: true, data: shipment });
  } catch (error) {
    if (error.name === 'InvalidTransitionError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    logger.error({ err: error }, 'Shipment status transition error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update shipment status' });
  }
});

/**
 * The Fulfillment Audit's #1 finding, fixed structurally — see the schema
 * comment on Shipment and Blueprint §2. Everything below runs inside one
 * transaction: the Shipment transition, restoring every item's stock (with
 * a real StockAdjustment audit row per item, not a silent side effect),
 * marking the Order cancelled, and creating a Refund(pending) row. Any
 * failure anywhere in this rolls the whole thing back — cancellation is
 * atomic, not a status write followed by hoped-for cleanup.
 *
 * Order.paymentStatus is deliberately NOT set to 'refunded' here — that's
 * Refund.status actually reaching 'succeeded' (Phase 2, once refund
 * processing against Maya's API exists). This route only ever creates the
 * Refund in `pending`; it records that money is owed back, not that it's
 * already been returned.
 */
router.post('/:id/cancel', async (req, res) => {
  try {
    const { reason } = req.body;
    const shipment = await shipmentRepository.findById(req.params.id, { include: { order: { include: { items: true } } } });
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found' });

    const order = shipment.order;
    const latestPayment = await paymentRepository.findLatestForOrder(order._id);

    let refund;
    try {
      await prisma.$transaction(async (tx) => {
        const result = await shipmentRepository.transition(req.params.id, 'cancelled', {
          actor: 'admin',
          actorUserId: req.user._id,
          message: reason || 'Cancelled by admin',
          client: tx,
        });
        if (!result.applied) {
          throw Object.assign(new Error('Shipment status changed concurrently'), { code: 'RACE_LOST' });
        }

        for (const item of order.items) {
          const productId = item.productId ?? item.product;
          await productRepository.restoreStock(
            { productId, size: item.size, color: item.color, quantity: item.quantity },
            { client: tx }
          );

          // restoreStock does its own internal lookup but doesn't return
          // which variant row it touched — re-resolved here so the audit
          // trail actually links to a real ProductSize/ProductColorSize,
          // not a blank pair of nulls.
          let productSizeId = null;
          let productColorSizeId = null;
          if (item.color) {
            const colorRow = await tx.productColor.findFirst({ where: { productId, color: item.color } });
            if (colorRow) {
              const sizeRow = await tx.productColorSize.findFirst({ where: { colorId: colorRow.id, size: item.size } });
              productColorSizeId = sizeRow?.id || null;
            }
          } else {
            const sizeRow = await tx.productSize.findFirst({ where: { productId, size: item.size } });
            productSizeId = sizeRow?.id || null;
          }

          await stockAdjustmentRepository.create({
            productSizeId,
            productColorSizeId,
            type: 'correction',
            quantityDelta: item.quantity,
            reason: `Order ${order.orderNumber} cancelled — stock restored`,
            relatedOrderId: order._id,
            staffUserId: req.user._id,
          }, { client: tx });
        }

        await tx.order.update({ where: { id: order._id }, data: { orderStatus: 'cancelled' } });

        refund = await refundRepository.create({
          orderId: order._id,
          paymentId: latestPayment?._id || null,
          amount: order.total,
          reason: reason || 'Order cancelled',
          initiatedByUserId: req.user._id,
        }, { client: tx });
      }, { timeout: 15000 }); // multiple round trips per item, same headroom orders.js's own transactions use
    } catch (txError) {
      if (txError.code === 'RACE_LOST') {
        return res.status(409).json({ success: false, message: 'Shipment status changed concurrently — refresh and try again' });
      }
      throw txError;
    }

    if (order.user) await accountCache.invalidateHome(order.user);

    sendOrderStatusEmail(order.email, order, 'cancelled').catch((err) =>
      logger.error({ err, orderNumber: order.orderNumber }, 'Failed to send cancellation email')
    );

    logger.info({ orderNumber: order.orderNumber, shipmentId: req.params.id, refundId: refund._id }, 'Shipment cancelled — stock released, refund pending');

    res.json({ success: true, data: { shipment: await shipmentRepository.findById(req.params.id), refund } });
  } catch (error) {
    if (error.name === 'InvalidTransitionError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    logger.error({ err: error }, 'Cancel shipment error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to cancel shipment' });
  }
});

export default router;
