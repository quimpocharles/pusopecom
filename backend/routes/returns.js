import express from 'express';
import multer from 'multer';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import prisma from '../lib/prisma.js';
import * as orderRepository from '../repositories/orderRepository.js';
import * as returnRequestRepository from '../repositories/returnRequestRepository.js';
import * as refundRepository from '../repositories/refundRepository.js';
import * as stockAdjustmentRepository from '../repositories/stockAdjustmentRepository.js';
import * as shipmentRepository from '../repositories/shipmentRepository.js';
import * as productRepository from '../repositories/productRepository.js';
import * as promoCodeRepository from '../repositories/promoCodeRepository.js';
import * as passRepository from '../repositories/passRepository.js';
import * as refundMath from '../lib/refundMath.js';
import * as accountCache from '../lib/accountCache.js';
import * as notificationRepository from '../repositories/notificationRepository.js';
import { uploadToCloudinary } from './upload.js';
import { authenticate, isAdmin, optionalAuth, requirePermission, requireAnyPermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../lib/permissions.js';
import { normalizePagination } from '../lib/pagination.js';

const router = express.Router();

class ReturnRequestInputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function variantKey({ productId, size, color }) {
  return `${productId}\u0000${size}\u0000${color ?? ''}`;
}

/**
 * Enterprise Fulfillment Blueprint, Phase 2 — the customer-facing return
 * request flow (Blueprint §7): request -> photos -> reason -> admin review
 * -> approval -> return shipment -> warehouse inspection -> refund ->
 * inventory adjustment. Same ownership convention every other order-scoped
 * route already uses — the order number is the bearer secret for a guest,
 * a logged-in customer must own the order, an admin always can.
 */

function canAccessOrder(order, req) {
  const orderUserId = order.userId ?? order.user;
  if (orderUserId) {
    return Boolean(req.user) && (orderUserId.toString() === req.user._id.toString() || req.user.role === 'admin');
  }
  return true; // guest order — order number itself is the bearer secret
}

// ── Customer-facing ──────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  },
});

// POST /photos — a dedicated, non-admin-gated upload path (the existing
// /api/upload routes are authenticate+isAdmin only, which a customer or
// guest filing a return can never satisfy). Reuses the exact same
// Cloudinary stream-upload mechanics via the exported uploadToCloudinary,
// just a different folder — no second copy of that logic.
router.post('/photos', optionalAuth, upload.array('photos', 6), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No image files provided' });
    }
    const results = await Promise.all(req.files.map((f) => uploadToCloudinary(f.buffer, 'puso-shop/returns')));
    res.json({ success: true, data: results.map((r) => ({ url: r.secure_url, publicId: r.public_id })) });
  } catch (error) {
    logger.error({ err: error }, 'Return photo upload error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to upload photos' });
  }
});

// POST / — file a new return request.
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { orderNumber, reason, description, photos, items } = req.body;
    if (!orderNumber || !reason || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'orderNumber, reason, and at least one item are required' });
    }

    const requestedItemIds = new Set();
    for (const item of items) {
      if (!item || typeof item.orderItemId !== 'string' || !item.orderItemId || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
        return res.status(400).json({ success: false, message: 'Each return item requires an orderItemId and a positive integer quantity' });
      }
      if (requestedItemIds.has(item.orderItemId)) {
        return res.status(400).json({ success: false, message: `Item ${item.orderItemId} is listed more than once` });
      }
      requestedItemIds.add(item.orderItemId);
    }

    const { order, returnRequest } = await prisma.$transaction(async (tx) => {
      const lockedOrders = await tx.$queryRaw`
        SELECT id FROM orders
        WHERE "orderNumber" = ${orderNumber}
        FOR UPDATE
      `;
      if (lockedOrders.length === 0) throw new ReturnRequestInputError('Order not found', 404);

      const lockedOrder = await tx.order.findUnique({ where: { id: lockedOrders[0].id }, include: { items: true } });
      if (!canAccessOrder(lockedOrder, req)) throw new ReturnRequestInputError('Access denied', 403);
      if (lockedOrder.paymentStatus !== 'paid') {
        throw new ReturnRequestInputError('Only paid orders can be returned');
      }

      const orderItemById = new Map(lockedOrder.items.map((item) => [item.id, item]));
      const purchasedByVariant = new Map();
      const requestedByVariant = new Map();
      for (const item of lockedOrder.items) {
        const key = variantKey(item);
        purchasedByVariant.set(key, (purchasedByVariant.get(key) || 0) + item.quantity);
      }

      for (const item of items) {
        const orderItem = orderItemById.get(item.orderItemId);
        if (!orderItem) {
          throw new ReturnRequestInputError(`Item ${item.orderItemId} does not belong to this order`);
        }
        const key = variantKey(orderItem);
        requestedByVariant.set(key, (requestedByVariant.get(key) || 0) + item.quantity);
      }

      const activeReturns = await tx.returnRequest.findMany({
        where: { orderId: lockedOrder.id, status: { not: 'rejected' } },
        include: { items: { include: { orderItem: true } } },
      });
      const reservedByVariant = new Map();
      for (const activeReturn of activeReturns) {
        for (const item of activeReturn.items) {
          const key = variantKey(item.orderItem);
          if (purchasedByVariant.has(key)) {
            reservedByVariant.set(key, (reservedByVariant.get(key) || 0) + item.quantity);
          }
        }
      }

      for (const [key, requestedQuantity] of requestedByVariant) {
        const remainingQuantity = (purchasedByVariant.get(key) || 0) - (reservedByVariant.get(key) || 0);
        if (requestedQuantity > remainingQuantity) {
          throw new ReturnRequestInputError('Requested return quantity exceeds the remaining eligible quantity for this variant');
        }
      }

      const createdReturnRequest = await returnRequestRepository.create({
        orderId: lockedOrder.id,
        userId: lockedOrder.userId || null,
        reason,
        description,
        photos,
        items,
      }, { client: tx });

      return { order: lockedOrder, returnRequest: createdReturnRequest };
    }, { timeout: 30000 });

    // Reflects into the same Shipment queue an operator already watches —
    // return_requested is a legal transition straight from 'delivered'
    // (shipmentRepository.SHIPMENT_TRANSITIONS).
    // shipmentRepository.transition already writes its own ShipmentEvent
    // row internally — no second one needed here.
    const shipment = await shipmentRepository.findByOrderId(order.id);
    if (shipment && shipment.status === 'delivered') {
      await shipmentRepository.transition(shipment._id, 'return_requested', {
        actor: 'customer',
        message: `Return requested — ${reason}`,
      });
    }

    res.status(201).json({ success: true, data: returnRequest });
  } catch (error) {
    if (error instanceof ReturnRequestInputError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    logger.error({ err: error }, 'Create return request error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to submit return request' });
  }
});

// GET /order/:orderNumber — a guest or customer's own returns for one order.
router.get('/order/:orderNumber', optionalAuth, async (req, res) => {
  try {
    const order = await orderRepository.findByOrderNumber(req.params.orderNumber);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (!canAccessOrder(order, req)) return res.status(403).json({ success: false, message: 'Access denied' });

    const returns = await returnRequestRepository.findByOrder(order._id);
    res.json({ success: true, data: returns });
  } catch (error) {
    logger.error({ err: error }, 'List return requests for order error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to load return requests' });
  }
});

// GET / — a logged-in customer's return history across every order.
router.get('/', authenticate, async (req, res) => {
  try {
    const returns = await returnRequestRepository.findByUser(req.user._id);
    res.json({ success: true, data: returns });
  } catch (error) {
    logger.error({ err: error }, 'List user return requests error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to load return requests' });
  }
});

// ── Admin ─────────────────────────────────────────────────────────────────

const adminRouter = express.Router();
adminRouter.use(authenticate, isAdmin);

const GENERIC_TRANSITIONS = new Set(['under_review', 'approved', 'rejected', 'return_shipped', 'received']);

adminRouter.get('/', requireAnyPermission(PERMISSIONS.RETURNS_VIEW, PERMISSIONS.REFUNDS_VIEW), async (req, res) => {
  try {
    const { status } = req.query;
    const where = status ? { status } : undefined;
    const { page, limit, skip } = normalizePagination(req.query, 20);
    const [rows, total] = await Promise.all([
      returnRequestRepository.find({ where, skip, take: limit }),
      returnRequestRepository.count({ where }),
    ]);
    res.json({ success: true, data: rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    logger.error({ err: error }, 'List admin return requests error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to list return requests' });
  }
});

adminRouter.get('/:id', requireAnyPermission(PERMISSIONS.RETURNS_VIEW, PERMISSIONS.REFUNDS_VIEW), async (req, res) => {
  try {
    const returnRequest = await returnRequestRepository.findById(req.params.id);
    if (!returnRequest) return res.status(404).json({ success: false, message: 'Return request not found' });
    res.json({ success: true, data: returnRequest });
  } catch (error) {
    logger.error({ err: error }, 'Get return request error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve return request' });
  }
});

// PATCH /:id/status — review/approve/reject/mark-shipped/mark-received.
// Refund creation and inventory adjustment are NOT reachable here — those
// only ever happen through POST /:id/inspect below, atomically together,
// the same "no bare status write with real consequences" discipline
// Phase 1's Shipment /cancel route already established.
adminRouter.patch('/:id/status', requirePermission(PERMISSIONS.RETURNS_APPROVE), async (req, res) => {
  try {
    const { status, resolutionNotes } = req.body;
    if (!status || !GENERIC_TRANSITIONS.has(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${[...GENERIC_TRANSITIONS].join(', ')}` });
    }

    const before = await returnRequestRepository.findById(req.params.id);
    if (!before) return res.status(404).json({ success: false, message: 'Return request not found' });

    const result = await returnRequestRepository.transition(req.params.id, status, {
      reviewedByUserId: req.user._id,
      reviewedAt: new Date(),
      ...(resolutionNotes !== undefined && { resolutionNotes }),
    });
    if (!result.applied) return res.status(409).json({ success: false, message: 'Return request changed concurrently — refresh and try again' });

    // Mirror the transition onto the order's own Shipment queue where a
    // matching stage exists — an operator working the Shipment queue and
    // one working the Returns queue should never see contradictory states
    // for the same order.
    // shipmentRepository.transition already writes its own ShipmentEvent
    // row internally — no second one needed here.
    const shipment = await shipmentRepository.findByOrderId(before.orderId);
    const SHIPMENT_MIRROR = { approved: 'return_approved', return_shipped: null, received: 'returned' };
    const mirrorStatus = SHIPMENT_MIRROR[status];
    if (shipment && mirrorStatus && (shipmentRepository.SHIPMENT_TRANSITIONS[shipment.status] || []).includes(mirrorStatus)) {
      await shipmentRepository.transition(shipment._id, mirrorStatus, {
        actor: 'admin', actorUserId: req.user._id, message: `Return ${status}`,
      });
    }

    if (before.order?.user) await accountCache.invalidateHome(before.order.user);
    if (before.order?.user) {
      notificationRepository.create({
        userId: before.order.user,
        type: 'order',
        title: `Return ${status.replace('_', ' ')}`,
        body: `Your return for order #${before.order.orderNumber} is now ${status.replace('_', ' ')}.`,
        link: `/order/${before.order.orderNumber}`,
      }).catch((err) => logger.error({ err }, 'Failed to create return-status notification'));
    }

    res.json({ success: true, data: await returnRequestRepository.findById(req.params.id) });
  } catch (error) {
    if (error.name === 'InvalidReturnTransitionError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    logger.error({ err: error }, 'Return status transition error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update return request' });
  }
});

/**
 * POST /:id/inspect — the coordinated reversal, atomically:
 * per-item condition recorded, stock restored ONLY for sellable items
 * (each with a real StockAdjustment audit row — damaged/unsellable items
 * get a zero-quantityDelta row too, so "received but not restocked" is
 * still a real, queryable fact, not a silent gap), the ReturnRequest moves
 * straight to refund_pending, and a Refund(pending) is created for the
 * attributable value of the returned items — mirrors Phase 1's Shipment
 * /cancel route exactly, but prices the refund through lib/refundMath.js so
 * discounts are borne by the returned items rather than refunded at list
 * price (Stage 2, Step 2).
 *
 * Runs under the same order-row lock the refund-recording route takes, and
 * refuses the inspection outright if the order already carries a
 * cancellation-origin refund (a return on top of a full cancellation could
 * only over-refund). The created amount is bounded by the same shared rule as
 * /record and /adjust: the tighter of this return's own attributable value,
 * the order-wide attributable balance, and the remaining order-level balance.
 * The Shipment is mirrored returned -> refund_pending in the same
 * transaction; a missing/unexpected shipment state is logged and skipped.
 *
 * Inspection is ALL-OR-NOTHING: the body must list every item on the request
 * exactly once (`returnItemId`, `condition`), so the refund can never cover an
 * uninspected item; an optional `quantity` must equal the requested quantity.
 * Duplicate, unknown, missing or over-quantity entries are rejected (400)
 * before any state change.
 * Body: { items: [{ returnItemId, condition, quantity? }] }
 */
adminRouter.post('/:id/inspect', requirePermission(PERMISSIONS.RETURNS_APPROVE), async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'items (with condition per returnItemId) are required' });
    }

    const returnRequest = await returnRequestRepository.findById(req.params.id);
    if (!returnRequest) return res.status(404).json({ success: false, message: 'Return request not found' });

    const VALID_CONDITIONS = new Set(['sellable', 'damaged', 'unsellable']);
    const itemMap = new Map(returnRequest.items.map((i) => [i._id, i]));

    // Validate the FULL-inspection contract BEFORE any mutation. Inspection is
    // all-or-nothing: every item on the request must be inspected exactly once,
    // with a valid condition. A partial inspection would leave items
    // unconditioned/unrestocked while the return still advances to
    // refund_pending (and a refund is created) — so it is rejected outright,
    // which also guarantees the refund can never cover an uninspected item.
    const inspectedIds = new Set();
    for (const entry of items) {
      const { returnItemId, condition, quantity } = entry || {};
      if (!itemMap.has(returnItemId)) {
        return res.status(400).json({ success: false, message: `Return item ${returnItemId} not found on this request` });
      }
      if (inspectedIds.has(returnItemId)) {
        return res.status(400).json({ success: false, message: `Return item ${returnItemId} is listed more than once` });
      }
      inspectedIds.add(returnItemId);
      if (!VALID_CONDITIONS.has(condition)) {
        return res.status(400).json({ success: false, message: `condition must be one of: ${[...VALID_CONDITIONS].join(', ')}` });
      }
      if (quantity !== undefined) {
        const requested = itemMap.get(returnItemId).quantity;
        if (!Number.isInteger(quantity) || quantity <= 0 || quantity !== requested) {
          return res.status(400).json({
            success: false,
            message: `Inspected quantity for return item ${returnItemId} must equal the requested quantity (${requested})`,
          });
        }
      }
    }
    const missingItems = returnRequest.items.filter((i) => !inspectedIds.has(i._id));
    if (missingItems.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Every item on the return must be inspected; missing: ${missingItems.map((i) => i._id).join(', ')}`,
      });
    }

    let refund;
    try {
      await prisma.$transaction(async (tx) => {
        // Serialize with every other order-level money mutation — notably a
        // cancellation refund being recorded (routes/refunds.js's record route
        // takes this same lock). Without it, an inspection and a recording
        // could each read the same "already refunded" baseline.
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${returnRequest.orderId} FOR UPDATE`;

        // received -> inspected -> refund_pending: two legal hops through
        // RETURN_TRANSITIONS, not one direct jump — 'inspected' has no
        // separate admin action of its own (this endpoint IS the
        // inspection), so both steps happen together, atomically, here.
        const inspectResult = await returnRequestRepository.transition(req.params.id, 'inspected', {}, { client: tx });
        if (!inspectResult.applied) throw Object.assign(new Error('Return request changed concurrently'), { code: 'RACE_LOST' });
        const result = await returnRequestRepository.transition(req.params.id, 'refund_pending', {}, { client: tx });
        if (!result.applied) throw Object.assign(new Error('Return request changed concurrently'), { code: 'RACE_LOST' });

        // The order's full pricing context — every checkout line (not just the
        // returned ones) is needed to allocate the discount correctly, and the
        // promo row supplies the scope the discount was computed against.
        const order = await tx.order.findUnique({ where: { id: returnRequest.orderId }, include: { items: true } });
        const promoCode = order?.promoCodeId
          ? await promoCodeRepository.findById(order.promoCodeId, { client: tx })
          : null;
        const passes = await passRepository.findByOrderId(returnRequest.orderId, { client: tx });

        const merchandiseLines = refundMath.buildMerchandiseLines(order?.items ?? []);
        const passLines = refundMath.buildPassLines(passes);

        // A cancellation-origin refund (returnRequestId null) that is live or
        // already recorded means this order's money was reversed in full
        // outside the returns flow; a return refund on top of it could only
        // over-refund. Refuse the inspection and let staff reject/close it.
        const conflictingCancelRefund = await tx.refund.count({
          where: { orderId: returnRequest.orderId, returnRequestId: null, status: { in: ['pending', 'processing', 'succeeded'] } },
        });
        if (conflictingCancelRefund > 0) {
          throw Object.assign(
            new Error('This order already has a cancellation refund — reject or close this return instead'),
            { code: 'CANCEL_REFUND_CONFLICT' }
          );
        }

        // The committed aggregates and the inspected items drive BOTH the refund
        // amount and the ceiling. `processing` refunds have an unknown external
        // state and are treated conservatively as committed so their capacity
        // cannot be spent twice.
        const inspectedReturnItems = items.map((entry) => {
          const item = itemMap.get(entry.returnItemId);
          return { orderItemId: item.orderItemId, quantity: item.quantity };
        });
        const { committedReturnOriginCentavos, committedAllCentavos } = await refundRepository.getCommittedCentavos(
          returnRequest.orderId,
          { client: tx }
        );

        // Attributable value of the items actually inspected, discount included,
        // bounded by the same shared per-return + order-wide rule /record and
        // /adjust use. An unresolvable return is a controlled 409, never a 500.
        let refundAmountCentavos;
        let returnCeilingCentavos;
        try {
          refundAmountCentavos = refundMath.attributableReturnAmount({
            merchandiseLines,
            passLines,
            discountAmount: order?.discountAmount ?? 0,
            promoCode,
            returnItems: inspectedReturnItems,
          });
          returnCeilingCentavos = refundMath.returnRefundCeilingCentavos({
            merchandiseLines,
            passLines,
            discountAmount: order?.discountAmount ?? 0,
            promoCode,
            returnItems: inspectedReturnItems,
            committedReturnCentavos: committedReturnOriginCentavos,
          });
        } catch (error) {
          throw Object.assign(new Error('The return\u2019s items no longer resolve to this order'), {
            code: 'RETURN_UNATTRIBUTABLE',
            cause: error,
          });
        }
        const remainingOrderCentavos = refundMath.toCentavos(order?.total ?? 0) - committedAllCentavos;
        const remainingRefundable = Math.min(returnCeilingCentavos, remainingOrderCentavos);
        if (refundAmountCentavos > remainingRefundable) {
          throw Object.assign(
            new Error('This return exceeds the remaining refundable amount for the order'),
            { code: 'CEILING_EXCEEDED' }
          );
        }

        for (const { returnItemId, condition } of items) {
          const item = itemMap.get(returnItemId);
          const orderItem = item.orderItem;

          await tx.returnItem.update({ where: { id: returnItemId }, data: { condition } });

          if (condition === 'sellable') {
            await productRepository.restoreStock(
              { productId: orderItem.productId, size: orderItem.size, color: orderItem.color, quantity: item.quantity },
              { client: tx }
            );
          }

          // ReturnItemCondition (sellable|damaged|unsellable) and
          // StockAdjustmentType (damaged|quarantine|returned|...) are
          // deliberately separate enums — the condition is what the
          // inspector observed, the adjustment type is what happened to
          // stock as a result. 'unsellable' items are quarantined, not
          // left without any typed adjustment row.
          const adjustmentType = condition === 'sellable' ? 'returned' : condition === 'damaged' ? 'damaged' : 'quarantine';
          const { productSizeId, productColorSizeId } = await resolveVariantIds(tx, orderItem);
          await stockAdjustmentRepository.create({
            productSizeId,
            productColorSizeId,
            type: adjustmentType,
            quantityDelta: condition === 'sellable' ? item.quantity : 0,
            reason: `Return ${req.params.id} inspected — item ${condition}`,
            relatedOrderId: returnRequest.orderId,
            staffUserId: req.user._id,
          }, { client: tx });
        }

        const latestPayment = await tx.payment.findFirst({ where: { orderId: returnRequest.orderId }, orderBy: { createdAt: 'desc' } });
        refund = await refundRepository.create({
          orderId: returnRequest.orderId,
          paymentId: latestPayment?.id || null,
          returnRequestId: req.params.id,
          amount: refundMath.fromCentavos(refundAmountCentavos),
          reason: `Return ${req.params.id}`,
          initiatedByUserId: req.user._id,
        }, { client: tx });

        // Mirror the return's arrival at refund_pending onto the Shipment queue
        // an operator watches, so the two never show contradictory states —
        // 'returned -> refund_pending' is a legal existing edge. A missing or
        // unexpected shipment state is logged and skipped, never thrown: the
        // refund is the financial record of truth here.
        const shipment = await shipmentRepository.findByOrderId(returnRequest.orderId, { client: tx });
        if (!shipment) {
          logger.info({ orderId: returnRequest.orderId, returnId: req.params.id }, 'No Shipment to mirror into refund_pending');
        } else if (shipment.status === 'returned') {
          await shipmentRepository.transition(shipment._id, 'refund_pending', {
            actor: 'admin',
            actorUserId: req.user._id,
            message: `Return ${req.params.id} inspected`,
          }, { client: tx });
        } else {
          logger.warn({ orderId: returnRequest.orderId, shipmentId: shipment._id, shipmentStatus: shipment.status }, 'Shipment is not at "returned" — skipping refund_pending mirror');
        }
      }, { timeout: 15000 });
    } catch (txError) {
      if (txError.code === 'RACE_LOST') {
        return res.status(409).json({ success: false, message: 'Return request changed concurrently — refresh and try again' });
      }
      if (txError.code === 'CANCEL_REFUND_CONFLICT') {
        return res.status(409).json({ success: false, message: txError.message });
      }
      if (txError.code === 'CEILING_EXCEEDED') {
        return res.status(409).json({ success: false, message: 'This return exceeds the remaining refundable amount for this order (accounting for refunds already recorded). Reject or adjust it before recording.' });
      }
      if (txError.code === 'RETURN_UNATTRIBUTABLE') {
        return res.status(409).json({ success: false, message: 'The refundable value of this return cannot be established because its items no longer resolve to the order. Reconcile it manually rather than inspecting it.' });
      }
      throw txError;
    }

    if (returnRequest.order?.user) await accountCache.invalidateHome(returnRequest.order.user);

    res.json({ success: true, data: { returnRequest: await returnRequestRepository.findById(req.params.id), refund } });
  } catch (error) {
    if (error.name === 'InvalidReturnTransitionError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    logger.error({ err: error }, 'Inspect return request error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to record inspection' });
  }
});

// Resolves which ProductSize/ProductColorSize row an OrderItem's snapshot
// (productId/size/color) maps to today — same lookup shape as Phase 1's
// /cancel route, needed because OrderItem stores a snapshot, not a live FK
// to the specific variant row.
async function resolveVariantIds(tx, orderItem) {
  const productId = orderItem.productId;
  if (orderItem.color) {
    const colorRow = await tx.productColor.findFirst({ where: { productId, color: orderItem.color } });
    if (!colorRow) return { productSizeId: null, productColorSizeId: null };
    const sizeRow = await tx.productColorSize.findFirst({ where: { colorId: colorRow.id, size: orderItem.size } });
    return { productSizeId: null, productColorSizeId: sizeRow?.id || null };
  }
  const sizeRow = await tx.productSize.findFirst({ where: { productId, size: orderItem.size } });
  return { productSizeId: sizeRow?.id || null, productColorSizeId: null };
}

export { router, adminRouter };
export default router;
