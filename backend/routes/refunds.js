import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import * as refundRepository from '../repositories/refundRepository.js';
import * as orderRepository from '../repositories/orderRepository.js';
import * as paymentRepository from '../repositories/paymentRepository.js';
import * as accountCache from '../lib/accountCache.js';
import * as notificationRepository from '../repositories/notificationRepository.js';
import * as paymentService from '../services/paymentService.js';
import { authenticate, isAdmin, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../lib/permissions.js';

const router = express.Router();
router.use(authenticate, isAdmin);

/**
 * Enterprise Fulfillment Blueprint, Phase 2 — the Refund queue (§3) and the
 * route that finally calls paymentService.issueRefund. A Refund row can
 * exist in `pending` from either a Shipment cancellation (Phase 1) or a
 * Return inspection (routes/returns.js) — this route is the single place
 * either path converges to actually move money.
 */

router.get('/', requirePermission(PERMISSIONS.RETURNS_VIEW), async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const where = status ? { status } : undefined;
    const skip = (Number(page) - 1) * Number(limit);
    const [rows, total] = await Promise.all([
      refundRepository.find({ where, skip, take: Number(limit) }),
      refundRepository.count({ where }),
    ]);
    res.json({ success: true, data: rows, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) } });
  } catch (error) {
    logger.error({ err: error }, 'List refunds error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to list refunds' });
  }
});

router.get('/:id', requirePermission(PERMISSIONS.RETURNS_VIEW), async (req, res) => {
  try {
    const refund = await refundRepository.findById(req.params.id);
    if (!refund) return res.status(404).json({ success: false, message: 'Refund not found' });
    res.json({ success: true, data: refund });
  } catch (error) {
    logger.error({ err: error }, 'Get refund error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve refund' });
  }
});

// POST /:id/process — pending -> processing -> succeeded|failed, atomically
// against Maya's real refund API. status=succeeded is the first real writer
// Order.paymentStatus='refunded' has ever had (Blueprint §7/§2).
router.post('/:id/process', requirePermission(PERMISSIONS.RETURNS_APPROVE), async (req, res) => {
  try {
    const refund = await refundRepository.findById(req.params.id);
    if (!refund) return res.status(404).json({ success: false, message: 'Refund not found' });
    if (refund.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Refund is already "${refund.status}", not pending` });
    }

    const claimed = await refundRepository.updateStatus(refund._id, 'processing');
    if (!claimed) {
      return res.status(409).json({ success: false, message: 'Refund is already being processed' });
    }

    const order = await orderRepository.findById(refund.orderId);
    const payment = refund.paymentId ? await paymentRepository.findById(refund.paymentId) : null;

    if (!payment?.providerPaymentReference) {
      await refundRepository.updateStatus(refund._id, 'failed', {
        processedAt: new Date(),
      });
      return res.status(422).json({ success: false, message: 'No provider payment reference on file — cannot issue an automated refund. Process manually with the gateway and update this record.' });
    }

    let gatewayResult;
    try {
      gatewayResult = await paymentService.issueRefund(payment.providerPaymentReference, refund.amount, refund.reason, payment.provider);
    } catch (gatewayError) {
      await refundRepository.updateStatus(refund._id, 'failed', { processedAt: new Date() });
      logger.error({ err: gatewayError, refundId: refund._id }, 'Refund gateway call failed');
      Sentry.captureException(gatewayError);
      return res.status(502).json({ success: false, message: gatewayError.message || 'Gateway refund failed' });
    }

    const finalStatus = gatewayResult.status === 'succeeded' ? 'succeeded' : 'processing';
    await refundRepository.updateStatus(refund._id, finalStatus, {
      providerRefundReference: gatewayResult.providerRefundReference,
      ...(finalStatus === 'succeeded' && { processedAt: new Date() }),
    });

    if (finalStatus === 'succeeded') {
      await orderRepository.updateById(refund.orderId, { paymentStatus: 'refunded' });
      if (order?.user) {
        await accountCache.invalidateHome(order.user);
        notificationRepository.create({
          userId: order.user,
          type: 'order',
          title: 'Refund completed',
          body: `Your refund of ₱${refund.amount.toFixed(2)} for order #${order.orderNumber} has been processed.`,
          link: `/order/${order.orderNumber}`,
        }).catch((err) => logger.error({ err }, 'Failed to create refund notification'));
      }
    }

    res.json({ success: true, data: await refundRepository.findById(refund._id) });
  } catch (error) {
    logger.error({ err: error }, 'Process refund error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to process refund' });
  }
});

export default router;
