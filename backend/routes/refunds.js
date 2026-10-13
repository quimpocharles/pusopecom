import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import prisma from '../lib/prisma.js';
import * as refundRepository from '../repositories/refundRepository.js';
import * as orderEventRepository from '../repositories/orderEventRepository.js';
import * as returnRequestRepository from '../repositories/returnRequestRepository.js';
import * as promoCodeRepository from '../repositories/promoCodeRepository.js';
import * as passRepository from '../repositories/passRepository.js';
import * as refundMath from '../lib/refundMath.js';
import * as refundCompletion from '../lib/refundCompletion.js';
import * as accountCache from '../lib/accountCache.js';
import { authenticate, isAdmin, requirePermission, requireAnyPermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../lib/permissions.js';
import { normalizePagination } from '../lib/pagination.js';

const router = express.Router();
router.use(authenticate, isAdmin);

/**
 * Enterprise Fulfillment Blueprint, Phase 2 — the Refund queue (§3).
 *
 * A Refund row can exist in `pending` from either a Shipment cancellation
 * (routes/shipments.js) or a Return inspection (routes/returns.js). Because the
 * platform's only integrated gateway (ePayGames) exposes no automated
 * refund/reversal API, money is moved out-of-band by staff and the completed
 * refund is RECORDED here (POST /:id/record) — the single place either path
 * converges to mark money returned and complete the related lifecycle. The
 * legacy automated POST /:id/process route was retired (see
 * docs/decisions/0000-decision-log.md); any future automated refund must reuse
 * the same order lock, financial ceilings, recording transaction, lifecycle
 * completion and audit safeguards that /record enforces.
 */

router.get('/', requireAnyPermission(PERMISSIONS.RETURNS_VIEW, PERMISSIONS.REFUNDS_VIEW), async (req, res) => {
  try {
    const { status } = req.query;
    const where = status ? { status } : undefined;
    const { page, limit, skip } = normalizePagination(req.query, 20);
    const [rows, total] = await Promise.all([
      refundRepository.find({ where, skip, take: limit }),
      refundRepository.count({ where }),
    ]);
    res.json({ success: true, data: rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    logger.error({ err: error }, 'List refunds error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to list refunds' });
  }
});

router.get('/:id', requireAnyPermission(PERMISSIONS.RETURNS_VIEW, PERMISSIONS.REFUNDS_VIEW), async (req, res) => {
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

// Money comparison convention — the same centavo-rounding comparison
// routes/orders.js's amountsMatch and lib/payments/xenditFees.js already use.
// Comparing two floats directly risks a false rejection from binary
// floating-point representation (e.g. 599.10000000001 !== 599.1). Delegates to
// lib/refundMath.js's identical helper — one centavo boundary, one definition.
const toCentavos = refundMath.toCentavos;

/**
 * The remaining attributable ceiling (integer centavos) for a RETURN-origin
 * refund. Delegates to lib/refundMath.js's `returnRefundCeilingCentavos` — the
 * single shared rule used by /record, /adjust and the inspection route — and
 * normalizes an unresolvable return into a controlled `RETURN_UNATTRIBUTABLE`
 * conflict rather than an unexpected error.
 */
async function remainingReturnAttributableCentavos({
  returnRequest, order, promoCode, merchandiseLines, passLines, committedReturnCentavos,
}) {
  try {
    return refundMath.returnRefundCeilingCentavos({
      merchandiseLines,
      passLines,
      discountAmount: order?.discountAmount ?? 0,
      promoCode,
      returnItems: returnRequest.items.map((item) => ({ orderItemId: item.orderItemId, quantity: item.quantity })),
      committedReturnCentavos,
    });
  } catch (error) {
    throw Object.assign(new Error('The return\u2019s items no longer resolve to this order'), {
      code: 'RETURN_UNATTRIBUTABLE',
      cause: error,
    });
  }
}

/**
 * Manual refund recording — ePayGames is the platform's only integrated gateway
 * and exposes no automated refund/reversal API (see the refund investigation
 * and epaygamesGateway.js's issueRefund), so a refund is always completed by
 * staff out-of-band and *recorded* here. This route never calls a gateway and
 * never moves money itself, and it NEVER changes the refund amount — the
 * amount is fixed by inspection/adjustment before payment.
 *
 * Stage 2, Step 4 hardening:
 *  - requires `externalAmount` and verifies it equals the current
 *    `Refund.amount` to the centavo (a stale UI or a mid-flight adjustment
 *    surfaces as a mismatch instead of being recorded);
 *  - inside the order-row-locked transaction, enforces BOTH ceilings — the
 *    remaining attributable merchandise value (return refunds) and the
 *    remaining order-level amount actually paid (all refunds) — rejecting with
 *    422 rather than clamping;
 *  - rejects a second success for the same `returnRequestId`;
 *  - validates the mandatory correction note against the authoritative status
 *    read under the lock;
 *  - caps `providerReference`/`note` lengths;
 *  - keeps the status-guarded update and the `refund_recorded` event in one
 *    transaction, so a failed event write rolls the recording back.
 * Permission, the `confirmCompleted` requirement, and the failed -> succeeded
 * correction workflow are preserved.
 */
router.post('/:id/record', requirePermission(PERMISSIONS.REFUNDS_MANAGE), async (req, res) => {
  try {
    const { confirmCompleted, externalAmount, providerReference, note } = req.body || {};

    const refund = await refundRepository.findById(req.params.id);
    if (!refund) return res.status(404).json({ success: false, message: 'Refund not found' });

    if (refund.status === 'succeeded') {
      return res.status(409).json({ success: false, message: 'Refund is already recorded as succeeded' });
    }
    if (refund.status !== 'pending' && refund.status !== 'failed') {
      return res.status(409).json({ success: false, message: `Refund is "${refund.status}" and cannot be recorded` });
    }
    if (confirmCompleted !== true) {
      return res.status(400).json({
        success: false,
        message: 'Explicit confirmation is required — set confirmCompleted to true only after the refund has actually been completed with the provider.',
      });
    }
    if (typeof externalAmount !== 'number' || !Number.isFinite(externalAmount) || externalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'externalAmount (the amount actually refunded externally) is required and must be a positive number.',
      });
    }

    const trimmedProviderReference = typeof providerReference === 'string' && providerReference.trim()
      ? providerReference.trim()
      : null;
    if (trimmedProviderReference && trimmedProviderReference.length > 255) {
      return res.status(400).json({ success: false, message: 'providerReference must be at most 255 characters' });
    }
    const trimmedNote = typeof note === 'string' ? note.trim() : '';
    if (trimmedNote.length > 1000) {
      return res.status(400).json({ success: false, message: 'note must be at most 1000 characters' });
    }

    // Captured inside the transaction for use in the post-commit side effects.
    let completionSummary = null;
    let sideEffectContext = null;

    try {
      await prisma.$transaction(async (tx) => {
        // Serialize concurrent recordings for the same order. Without this, two
        // different refunds on one order could each read the same "already
        // refunded" sum, both pass the ceiling checks below, and together
        // exceed what was paid — the aggregate read and the write are not
        // otherwise atomic with respect to each other.
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${refund.orderId} FOR UPDATE`;

        // Re-read under the lock: a concurrent request (or any other writer,
        // including the adjustment route) may have moved this refund since the
        // pre-check above.
        const fresh = await tx.refund.findUnique({ where: { id: refund._id } });
        if (!fresh || (fresh.status !== 'pending' && fresh.status !== 'failed')) {
          throw Object.assign(new Error('Refund changed concurrently'), { code: 'RACE_LOST' });
        }

        // The declared external amount must match the authoritative amount
        // exactly — an adjustment that landed after the UI showed a figure, or
        // a wrong figure paid at the provider, must never be recorded as if
        // consistent.
        if (toCentavos(externalAmount) !== toCentavos(fresh.amount)) {
          throw Object.assign(new Error('Confirmed amount does not match the refund amount'), {
            code: 'AMOUNT_MISMATCH',
            expectedCentavos: toCentavos(fresh.amount),
            providedCentavos: toCentavos(externalAmount),
          });
        }

        // Correction note is required based on the AUTHORITATIVE status just
        // read under the lock, not the pre-transaction read.
        if (fresh.status === 'failed' && !trimmedNote) {
          throw Object.assign(new Error('Correction note required'), { code: 'NOTE_REQUIRED' });
        }

        const order = await tx.order.findUnique({ where: { id: fresh.orderId }, include: { items: true } });

        // One successful refund per return: a retry, or a second refund row for
        // the same return, can never both record.
        if (fresh.returnRequestId) {
          const duplicate = await tx.refund.count({
            where: { returnRequestId: fresh.returnRequestId, status: 'succeeded', id: { not: fresh.id } },
          });
          if (duplicate > 0) {
            throw Object.assign(new Error('Return already refunded'), { code: 'RETURN_ALREADY_REFUNDED' });
          }
          // A `processing` refund on this same return is an unresolved live
          // claim on the same money: its external state is unknown, so this
          // return's true remaining value cannot be established. Refuse rather
          // than guess — Finance must reconcile that refund first.
          const processingSameReturn = await tx.refund.count({
            where: { returnRequestId: fresh.returnRequestId, status: 'processing', id: { not: fresh.id } },
          });
          if (processingSameReturn > 0) {
            throw Object.assign(new Error('Return already has a processing refund'), { code: 'PROCESSING_CONFLICT' });
          }
        }

        // Capacity already committed on this order. The current refund is
        // pending/failed, so none of these sums counts it against itself.
        const [{ committedReturnOriginCentavos, committedAllCentavos }, succeededAll] = await Promise.all([
          refundRepository.getCommittedCentavos(fresh.orderId, { client: tx }),
          // Succeeded only — a `processing` refund is not money confirmed
          // returned, so it must not drive paymentStatus to 'refunded'.
          tx.refund.aggregate({ where: { orderId: fresh.orderId, status: 'succeeded' }, _sum: { amount: true } }),
        ]);
        const refundCentavos = toCentavos(fresh.amount);

        // Order-level ceiling — cannot refund more than was actually paid. This
        // governs every origin (return and cancellation) alike.
        const remainingOrder = toCentavos(order?.total ?? 0) - committedAllCentavos;
        if (refundCentavos > remainingOrder) {
          throw Object.assign(new Error('Exceeds the order-level refundable amount'), {
            code: 'ORDER_CEILING',
            remainingCentavos: remainingOrder,
            refundCentavos,
          });
        }

        // Attributable merchandise ceiling (return refunds only) — bounded by
        // BOTH this return's own attributable value and the order-wide
        // attributable capacity left after other committed refunds.
        if (fresh.returnRequestId) {
          const promoCode = order?.promoCodeId
            ? await promoCodeRepository.findById(order.promoCodeId, { client: tx })
            : null;
          const passes = await passRepository.findByOrderId(fresh.orderId, { client: tx });
          const merchandiseLines = refundMath.buildMerchandiseLines(order?.items ?? []);
          const passLines = refundMath.buildPassLines(passes);
          const returnRequest = await returnRequestRepository.findById(fresh.returnRequestId, { client: tx });
          if (!returnRequest) {
            throw Object.assign(new Error('Return request not found'), { code: 'RETURN_NOT_FOUND' });
          }
          const remainingAttributable = await remainingReturnAttributableCentavos({
            returnRequest,
            order,
            promoCode,
            merchandiseLines,
            passLines,
            committedReturnCentavos: committedReturnOriginCentavos,
          });
          if (refundCentavos > remainingAttributable) {
            throw Object.assign(new Error('Exceeds the attributable merchandise refundable amount'), {
              code: 'ATTRIBUTABLE_CEILING',
              remainingCentavos: remainingAttributable,
              refundCentavos,
            });
          }
        }

        const recorded = await refundRepository.recordSucceeded(fresh.id, {
          fromStatuses: ['pending', 'failed'],
          extra: { providerRefundReference: trimmedProviderReference, processedAt: new Date() },
          client: tx,
        });
        if (!recorded) throw Object.assign(new Error('Refund changed concurrently'), { code: 'RACE_LOST' });

        // Complete the related lifecycle in this same transaction — best-effort
        // (D4): an unexpected related state is flagged in the summary rather
        // than rolling back the record of money already refunded externally.
        completionSummary = await refundCompletion.applyRefundCompletion({
          tx,
          refundId: fresh.id,
          returnRequestId: fresh.returnRequestId,
          orderId: fresh.orderId,
          totalCentavos: toCentavos(order?.total ?? 0),
          succeededIncludingThisCentavos: toCentavos(succeededAll._sum.amount || 0) + refundCentavos,
          actorUserId: req.user._id,
        });
        sideEffectContext = {
          orderUserId: order?.userId ?? null,
          orderNumber: order?.orderNumber ?? null,
          amountPesos: refundMath.fromCentavos(refundCentavos),
        };

        await orderEventRepository.create({
          orderId: fresh.orderId,
          type: 'refund_recorded',
          actor: 'admin',
          actorUserId: req.user._id,
          message: `Refund of ₱${refundMath.fromCentavos(refundCentavos).toFixed(2)} recorded as completed (manual)`,
          metadata: {
            refundId: fresh.id,
            amount: fresh.amount,
            externalAmount: refundMath.fromCentavos(toCentavos(externalAmount)),
            providerReference: trimmedProviderReference,
            ...(fresh.returnRequestId && { returnRequestId: fresh.returnRequestId }),
            // Only meaningful for the failed -> succeeded correction path, and
            // deliberately carries the note the actor supplied.
            ...(fresh.status === 'failed' && { correctedFrom: 'failed', note: trimmedNote }),
            // Lifecycle outcomes: the paymentStatus set, ReturnRequest/Shipment
            // transitions, Passes refunded, and any Pass exceptions — so a
            // skipped transition is visible in the Order Timeline, not silent.
            lifecycle: completionSummary,
          },
        }, { client: tx });
      }, { timeout: 15000 });
    } catch (txError) {
      if (txError.code === 'RACE_LOST') {
        return res.status(409).json({ success: false, message: 'Refund was already recorded — refresh and try again' });
      }
      if (txError.code === 'AMOUNT_MISMATCH') {
        return res.status(400).json({
          success: false,
          message: `The confirmed external amount ₱${refundMath.fromCentavos(txError.providedCentavos).toFixed(2)} does not match the current refund amount ₱${refundMath.fromCentavos(txError.expectedCentavos).toFixed(2)}. Adjust the refund to the amount actually refunded before recording.`,
        });
      }
      if (txError.code === 'NOTE_REQUIRED') {
        return res.status(400).json({
          success: false,
          message: 'A note explaining the correction is required to record a refund that was previously marked failed.',
        });
      }
      if (txError.code === 'RETURN_ALREADY_REFUNDED') {
        return res.status(409).json({ success: false, message: 'Another refund for this return has already been recorded as succeeded' });
      }
      if (txError.code === 'PROCESSING_CONFLICT') {
        return res.status(409).json({ success: false, message: 'This return already has a refund stuck in "processing". Its external state is unknown — reconcile that refund with the provider before recording another one for this return.' });
      }
      if (txError.code === 'RETURN_NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'The return request for this refund was not found' });
      }
      if (txError.code === 'RETURN_UNATTRIBUTABLE') {
        return res.status(409).json({ success: false, message: 'The refundable value of this return cannot be established because its items no longer resolve to the order. Reconcile it manually rather than recording an amount.' });
      }
      if (txError.code === 'ORDER_CEILING') {
        return res.status(422).json({
          success: false,
          message: `Recording this refund would exceed the amount actually paid for this order (₱${refundMath.fromCentavos(Math.max(0, txError.remainingCentavos)).toFixed(2)} remains after refunds already committed as succeeded or processing). Reconcile the refund amount before recording.`,
        });
      }
      if (txError.code === 'ATTRIBUTABLE_CEILING') {
        return res.status(422).json({
          success: false,
          message: `Recording this refund would exceed the refundable value of the returned items for this return (₱${refundMath.fromCentavos(Math.max(0, txError.remainingCentavos)).toFixed(2)} remains after refunds already committed as succeeded or processing). Reconcile the refund amount before recording.`,
        });
      }
      throw txError;
    }

    // Post-commit side effects. The refund is committed, so a failure here must
    // not turn a successful recording into an error. None of these can duplicate
    // on a retry: a repeat recording request returns 409 (already succeeded)
    // before ever reaching here.
    if (sideEffectContext?.orderUserId) {
      try {
        await accountCache.invalidateHome(sideEffectContext.orderUserId);
      } catch (cacheError) {
        logger.error({ err: cacheError, refundId: refund._id }, 'Failed to invalidate account cache after refund');
      }
    }
    try {
      await refundCompletion.sendRefundCompletionNotifications({
        orderUserId: sideEffectContext?.orderUserId ?? null,
        orderNumber: sideEffectContext?.orderNumber ?? null,
        amountPesos: sideEffectContext?.amountPesos ?? refund.amount,
        refundId: refund._id,
        passExceptions: completionSummary?.passExceptions ?? [],
      });
    } catch (notifyError) {
      logger.error({ err: notifyError, refundId: refund._id }, 'Failed to send refund completion notifications');
      Sentry.captureException(notifyError);
    }

    const updated = await refundRepository.findById(refund._id);
    res.json({ success: true, data: { ...updated, lifecycle: completionSummary } });
  } catch (error) {
    logger.error({ err: error, refundId: req.params.id }, 'Record manual refund error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to record refund' });
  }
});

/**
 * POST /:id/adjust — Stage 2, Step 3. Corrects a refund's AMOUNT while it is
 * still `pending` or `failed`, i.e. before the money has been sent (or, when it
 * genuinely already has, in one narrowly-bounded reconciliation mode). It never
 * touches a `succeeded` refund and never calls a gateway.
 *
 * Two modes, declared explicitly so the audit trail records which this was:
 *  - externalPayment: 'none'         — the normal pre-payment correction, by
 *                                      `recompute` (the system's attributable
 *                                      value for the return) or an explicit
 *                                      `amount`.
 *  - externalPayment: 'already_sent' — money already left the business for an
 *                                      amount that differs from the stored
 *                                      figure; the amount is set to exactly the
 *                                      declared `externalAmount`. This is a
 *                                      reconciliation, not an override — it is
 *                                      still bounded by the same ceiling.
 *
 * Every adjustment runs under the same order-row lock the recording route uses
 * and is guarded by a status-conditional update, so two concurrent adjustments
 * (or an adjustment racing a recording) can never both apply. The ceiling is
 * computed net of refunds already `succeeded`: a failed refund is not money
 * returned (so it is not subtracted), while the recording route re-checks the
 * cumulative bounds at the moment money is declared, which is the backstop
 * against a set of pending refunds later being recorded past the ceiling.
 */
router.post('/:id/adjust', requirePermission(PERMISSIONS.REFUNDS_MANAGE), async (req, res) => {
  try {
    const { externalPayment, reason, recompute, amount, externalAmount } = req.body || {};

    const refund = await refundRepository.findById(req.params.id);
    if (!refund) return res.status(404).json({ success: false, message: 'Refund not found' });

    if (refund.status === 'succeeded') {
      return res.status(409).json({ success: false, message: 'A succeeded refund is immutable and cannot be adjusted' });
    }
    if (refund.status === 'processing') {
      return res.status(409).json({ success: false, message: 'A refund being processed cannot be adjusted' });
    }
    if (refund.status !== 'pending' && refund.status !== 'failed') {
      return res.status(409).json({ success: false, message: `Refund is "${refund.status}" and cannot be adjusted` });
    }

    if (externalPayment !== 'none' && externalPayment !== 'already_sent') {
      return res.status(400).json({ success: false, message: 'externalPayment must be either "none" or "already_sent"' });
    }
    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
    if (!trimmedReason) {
      return res.status(400).json({ success: false, message: 'A reason is required to adjust a refund amount' });
    }
    if (trimmedReason.length > 1000) {
      return res.status(400).json({ success: false, message: 'reason must be at most 1000 characters' });
    }

    if (externalPayment === 'already_sent') {
      if (recompute === true || amount !== undefined) {
        return res.status(400).json({ success: false, message: 'already_sent reconciliation takes only externalAmount (not amount/recompute)' });
      }
      if (typeof externalAmount !== 'number' || !Number.isFinite(externalAmount) || externalAmount <= 0) {
        return res.status(400).json({ success: false, message: 'externalAmount (the amount actually refunded externally) is required and must be a positive number' });
      }
    } else {
      if (externalAmount !== undefined) {
        return res.status(400).json({ success: false, message: 'externalAmount is only valid with externalPayment "already_sent"' });
      }
      const useRecompute = recompute === true;
      const useAmount = amount !== undefined;
      if (useRecompute === useAmount) {
        return res.status(400).json({ success: false, message: 'Provide exactly one of "recompute": true or an explicit "amount"' });
      }
      if (useAmount && (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0)) {
        return res.status(400).json({ success: false, message: 'amount must be a positive number' });
      }
      if (useRecompute && !refund.returnRequestId) {
        return res.status(400).json({ success: false, message: 'recompute applies only to return refunds' });
      }
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${refund.orderId} FOR UPDATE`;

        const fresh = await tx.refund.findUnique({ where: { id: refund._id } });
        if (!fresh) throw Object.assign(new Error('Refund not found'), { code: 'NOT_FOUND' });
        if (fresh.status !== 'pending' && fresh.status !== 'failed') {
          throw Object.assign(new Error('Refund changed concurrently'), { code: 'RACE_LOST' });
        }
        const fromAmountCentavos = toCentavos(fresh.amount);

        // Same attribution-loading pattern as routes/returns.js's inspection.
        const order = await tx.order.findUnique({ where: { id: fresh.orderId }, include: { items: true } });
        const promoCode = order?.promoCodeId
          ? await promoCodeRepository.findById(order.promoCodeId, { client: tx })
          : null;
        const passes = await passRepository.findByOrderId(fresh.orderId, { client: tx });
        const merchandiseLines = refundMath.buildMerchandiseLines(order?.items ?? []);
        const passLines = refundMath.buildPassLines(passes);

        // Capacity already committed on this order. A failed refund is not
        // money returned, and a pending one (including this one) is not yet
        // confirmed — neither is counted.
        const { committedReturnOriginCentavos, committedAllCentavos } = await refundRepository.getCommittedCentavos(
          fresh.orderId,
          { client: tx }
        );

        let ceilingCentavos;
        let returnRequest = null;
        if (fresh.returnRequestId) {
          returnRequest = await returnRequestRepository.findById(fresh.returnRequestId, { client: tx });
          if (!returnRequest) throw Object.assign(new Error('Return request not found'), { code: 'NOT_FOUND' });

          // A `processing` refund on this same return is an unresolved live
          // claim on the same money — this return's true remaining value cannot
          // be established, so refuse rather than guess.
          const processingSameReturn = await tx.refund.count({
            where: { returnRequestId: fresh.returnRequestId, status: 'processing', id: { not: fresh.id } },
          });
          if (processingSameReturn > 0) {
            throw Object.assign(new Error('Return already has a processing refund'), { code: 'PROCESSING_CONFLICT' });
          }

          const remainingOrder = toCentavos(order?.total ?? 0) - committedAllCentavos;
          ceilingCentavos = Math.min(
            remainingOrder,
            await remainingReturnAttributableCentavos({
              returnRequest,
              order,
              promoCode,
              merchandiseLines,
              passLines,
              committedReturnCentavos: committedReturnOriginCentavos,
            }),
          );
        } else {
          ceilingCentavos = toCentavos(order?.total ?? 0) - committedAllCentavos;
        }

        let toAmountCentavos;
        if (externalPayment === 'already_sent') {
          toAmountCentavos = toCentavos(externalAmount);
        } else if (recompute === true) {
          // returnRequest is guaranteed present: recompute is rejected above for
          // cancellations without one.
          toAmountCentavos = refundMath.attributableReturnAmount({
            merchandiseLines,
            passLines,
            discountAmount: order?.discountAmount ?? 0,
            promoCode,
            returnItems: returnRequest.items.map((item) => ({ orderItemId: item.orderItemId, quantity: item.quantity })),
          });
        } else {
          toAmountCentavos = toCentavos(amount);
        }

        if (toAmountCentavos <= 0) {
          throw Object.assign(new Error('Nothing refundable'), { code: 'NOTHING_REFUNDABLE' });
        }
        if (toAmountCentavos > ceilingCentavos) {
          throw Object.assign(new Error('Exceeds ceiling'), { code: 'CEILING_EXCEEDED', ceilingCentavos, toAmountCentavos });
        }
        if (toAmountCentavos === fromAmountCentavos) {
          // An adjustment that changes nothing is rejected rather than applied
          // as a silent no-op: it keeps the audit trail meaningful and makes a
          // second concurrent adjustment to the same value lose the race
          // cleanly instead of writing a duplicate refund_adjusted event.
          throw Object.assign(new Error('No change'), { code: 'NO_CHANGE', fromAmountCentavos });
        }

        const adjusted = await refundRepository.adjustAmount(fresh.id, {
          fromStatuses: ['pending', 'failed'],
          amount: refundMath.fromCentavos(toAmountCentavos),
          client: tx,
        });
        if (!adjusted) throw Object.assign(new Error('Refund changed concurrently'), { code: 'RACE_LOST' });

        await orderEventRepository.create({
          orderId: fresh.orderId,
          type: 'refund_adjusted',
          actor: 'admin',
          actorUserId: req.user._id,
          message: `Refund amount adjusted from ₱${refundMath.fromCentavos(fromAmountCentavos).toFixed(2)} to ₱${refundMath.fromCentavos(toAmountCentavos).toFixed(2)} (${externalPayment})`,
          metadata: {
            refundId: fresh.id,
            fromAmount: refundMath.fromCentavos(fromAmountCentavos),
            toAmount: refundMath.fromCentavos(toAmountCentavos),
            reason: trimmedReason,
            externalPayment,
            recomputed: externalPayment === 'none' && recompute === true,
            ...(externalPayment === 'already_sent' && { externalAmount }),
          },
        }, { client: tx });
      }, { timeout: 15000 });
    } catch (txError) {
      if (txError.code === 'NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'Refund or its return request was not found' });
      }
      if (txError.code === 'RACE_LOST') {
        return res.status(409).json({ success: false, message: 'Refund changed concurrently — refresh and try again' });
      }
      if (txError.code === 'PROCESSING_CONFLICT') {
        return res.status(409).json({ success: false, message: 'This return already has a refund stuck in "processing". Its external state is unknown — reconcile that refund with the provider before adjusting another one for this return.' });
      }
      if (txError.code === 'RETURN_UNATTRIBUTABLE') {
        return res.status(409).json({ success: false, message: 'The refundable value of this return cannot be established because its items no longer resolve to the order. Reconcile it manually rather than adjusting the amount.' });
      }
      if (txError.code === 'NOTHING_REFUNDABLE') {
        return res.status(400).json({ success: false, message: 'There is no refundable value for this refund' });
      }
      if (txError.code === 'CEILING_EXCEEDED') {
        return res.status(422).json({
          success: false,
          message: `Adjusting to ₱${refundMath.fromCentavos(txError.toAmountCentavos).toFixed(2)} would exceed the remaining refundable amount of ₱${refundMath.fromCentavos(Math.max(0, txError.ceilingCentavos)).toFixed(2)} for this order`,
        });
      }
      if (txError.code === 'NO_CHANGE') {
        return res.status(409).json({
          success: false,
          message: `Refund amount is already ₱${refundMath.fromCentavos(txError.fromAmountCentavos ?? 0).toFixed(2)} — no adjustment needed`,
        });
      }
      throw txError;
    }

    res.json({ success: true, data: await refundRepository.findById(refund._id) });
  } catch (error) {
    logger.error({ err: error, refundId: req.params.id }, 'Adjust refund error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to adjust refund' });
  }
});

export default router;
