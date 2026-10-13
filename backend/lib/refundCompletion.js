import prisma from './prisma.js';
import logger from './logger.js';
import Sentry from './sentry.js';
import * as orderRepository from '../repositories/orderRepository.js';
import * as returnRequestRepository from '../repositories/returnRequestRepository.js';
import * as shipmentRepository from '../repositories/shipmentRepository.js';
import * as passRepository from '../repositories/passRepository.js';
import * as staffProfileRepository from '../repositories/staffProfileRepository.js';
import * as notificationRepository from '../repositories/notificationRepository.js';

/**
 * Stage 2, Step 5 — the lifecycle transitions that complete a recorded refund.
 *
 * `applyRefundCompletion` runs INSIDE the recording transaction. It follows the
 * approved D4 decision: a refund that has genuinely been completed externally
 * must still be recorded even if a related record is in an unexpected state, so
 * every transition is best-effort — state-machine violations (and races) are
 * collected as flags/exceptions instead of thrown. A genuine database error is
 * NOT swallowed (it would mean the atomic write itself failed, which the caller
 * must see), so only the two "expected unexpected" outcomes are tolerated:
 *   - the related row is not in a status that permits the transition
 *     (InvalidReturnTransitionError / InvalidTransitionError /
 *     InvalidPassTransitionError), or
 *   - the atomic conditional update found zero rows because a concurrent writer
 *     moved it (`applied: false`, `reason: 'race_lost'`).
 *
 * The returned `summary` is recorded in the `refund_recorded` event metadata and
 * the API response, so a skipped transition is visible and auditable rather than
 * silent.
 */
export async function applyRefundCompletion({
  tx,
  refundId,
  returnRequestId,
  orderId,
  totalCentavos,
  succeededIncludingThisCentavos,
  actorUserId,
}) {
  const summary = {
    paymentStatusSetTo: null,
    returnRequest: null,
    shipment: null,
    passesRefunded: 0,
    passExceptions: [],
  };
  const transitionMessage = `Refund ${refundId} recorded`;

  // Order.paymentStatus — 'refunded' only once every centavo paid is refunded;
  // a partial refund leaves the order 'paid'.
  if (succeededIncludingThisCentavos >= totalCentavos) {
    await orderRepository.updateById(orderId, { paymentStatus: 'refunded' }, { client: tx });
    summary.paymentStatusSetTo = 'refunded';
  } else {
    summary.paymentStatusSetTo = 'paid';
  }

  // ReturnRequest refund_pending -> refunded (return-origin refunds only).
  if (returnRequestId) {
    const current = await tx.returnRequest.findUnique({ where: { id: returnRequestId } });
    if (!current) {
      summary.returnRequest = 'skipped:not_found';
      logger.warn({ refundId, returnRequestId }, 'Return request to complete was not found');
    } else if (current.status === 'refunded') {
      summary.returnRequest = 'refunded';
    } else if (current.status !== 'refund_pending') {
      summary.returnRequest = `skipped:${current.status}`;
      logger.warn({ refundId, returnRequestId, status: current.status }, 'Return request not at refund_pending — skipped');
    } else {
      try {
        const result = await returnRequestRepository.transition(returnRequestId, 'refunded', {}, { client: tx });
        summary.returnRequest = result.applied ? 'refunded' : `skipped:${result.reason || 'race_lost'}`;
        if (!result.applied) logger.warn({ refundId, returnRequestId, reason: result.reason }, 'Return transition lost a race');
      } catch (error) {
        if (error.name === 'InvalidReturnTransitionError') {
          summary.returnRequest = 'skipped:invalid';
          logger.warn({ refundId, returnRequestId, err: error }, 'Return transition rejected — skipped');
        } else {
          throw error;
        }
      }
    }
  }

  // Shipment: return-origin refunds complete refund_pending -> refunded;
  // cancellation-origin refunds are already terminal at 'cancelled'.
  const shipment = await shipmentRepository.findByOrderId(orderId, { client: tx });
  if (!shipment) {
    summary.shipment = 'skipped:not_found';
  } else if (shipment.status === 'refunded') {
    summary.shipment = 'refunded';
  } else if (shipment.status === 'refund_pending') {
    try {
      const result = await shipmentRepository.transition(shipment._id, 'refunded', {
        actor: 'admin',
        actorUserId,
        message: transitionMessage,
      }, { client: tx });
      summary.shipment = result.applied ? 'refunded' : `skipped:${result.reason || 'race_lost'}`;
      if (!result.applied) logger.warn({ refundId, shipmentId: shipment._id, reason: result.reason }, 'Shipment transition lost a race');
    } catch (error) {
      if (error.name === 'InvalidTransitionError') {
        summary.shipment = 'skipped:invalid';
        logger.warn({ refundId, shipmentId: shipment._id, err: error }, 'Shipment transition rejected — skipped');
      } else {
        throw error;
      }
    }
  } else if (shipment.status === 'cancelled') {
    summary.shipment = 'cancelled';
  } else {
    summary.shipment = `skipped:${shipment.status}`;
    logger.warn({ refundId, shipmentId: shipment._id, status: shipment.status }, 'Shipment not at a refundable status — skipped');
  }

  // Passes: cancellation-origin refunds refund eligible 'issued' passes. A
  // checked-in pass is NEVER auto-refunded — it is collected as an exception
  // for administrative resolution; terminal states are skipped silently.
  if (!returnRequestId) {
    const passes = await passRepository.findByOrderId(orderId, { include: {}, client: tx });
    for (const pass of passes) {
      if (pass.status === 'issued') {
        try {
          const result = await passRepository.transition(pass._id, 'refunded', {
            actor: 'admin',
            actorUserId,
            message: transitionMessage,
          }, { client: tx });
          if (result.applied) {
            summary.passesRefunded += 1;
          } else {
            summary.passExceptions.push({ passId: pass._id, status: pass.status, reason: result.reason || 'race_lost' });
          }
        } catch (error) {
          if (error.name === 'InvalidPassTransitionError') {
            summary.passExceptions.push({ passId: pass._id, status: pass.status });
            logger.warn({ refundId, passId: pass._id, err: error }, 'Pass transition rejected — collected as exception');
          } else {
            throw error;
          }
        }
      } else if (pass.status === 'checked_in') {
        summary.passExceptions.push({ passId: pass._id, status: 'checked_in' });
      }
    }
    if (summary.passExceptions.length > 0) {
      logger.warn({ refundId, orderId, passExceptions: summary.passExceptions }, 'Refund recorded with Pass exceptions requiring manual resolution');
    }
  }

  return summary;
}

/**
 * Post-commit side effects for a recorded refund. Deliberately never throws:
 * the refund is already committed, so a failed notification or cache
 * invalidation must not turn a successful recording into an error response or
 * misrepresent the committed state.
 *
 * Duplication: a refund can only be recorded once (the recording endpoint's
 * status-guarded update makes a retry return 409 before reaching here), so the
 * customer notification cannot duplicate. The Finance notification is
 * additionally de-duplicated by content, matching lib/sendRefundReminders.js's
 * existing convention.
 */
export async function sendRefundCompletionNotifications({
  orderUserId,
  orderNumber,
  amountPesos,
  refundId,
  passExceptions = [],
}) {
  if (orderUserId) {
    notificationRepository.create({
      userId: orderUserId,
      type: 'order',
      title: 'Refund completed',
      body: `Your refund of ₱${Number(amountPesos).toFixed(2)} for order #${orderNumber} has been processed.`,
      link: `/order/${orderNumber}`,
    }).catch((error) => {
      logger.error({ err: error, refundId }, 'Failed to create refund-completed notification');
      Sentry.captureException(error);
    });
  }

  if (passExceptions.length > 0) {
    await notifyFinanceOfPassExceptions({ orderNumber, refundId, passExceptions }).catch((error) => {
      logger.error({ err: error, refundId }, 'Failed to notify Finance of Pass refund exceptions');
      Sentry.captureException(error);
    });
  }
}

/**
 * Notify Finance staff that checked-in Passes could not be auto-refunded and
 * need manual resolution. Same finance-department + content-dedup pattern as
 * lib/sendRefundReminders.js, so a re-run (should one ever occur) cannot send
 * the same exception notice twice.
 */
export async function notifyFinanceOfPassExceptions({ orderNumber, refundId, passExceptions }) {
  const financeStaff = await staffProfileRepository.find({ department: 'finance', active: true });
  const body = `Order #${orderNumber}: ${passExceptions.length} checked-in Pass(es) could not be auto-refunded for refund ${refundId}. Resolve manually.`;

  for (const staff of financeStaff) {
    // staffProfileRepository serializes its rows, so the included user's id is
    // `user._id` (serialize renames `id` -> `_id` recursively); accept either.
    const userId = staff.user?.id ?? staff.user?._id;
    if (!userId) continue;

    const alreadyNotified = await prisma.notification.findFirst({
      where: { userId, type: 'order', title: 'Pass refund exception', body },
      select: { id: true },
    });
    if (alreadyNotified) continue;

    // eslint-disable-next-line no-await-in-loop
    await notificationRepository.create({
      userId,
      type: 'order',
      title: 'Pass refund exception',
      body,
      link: '/admin/returns',
    });
  }
}

export default { applyRefundCompletion, sendRefundCompletionNotifications, notifyFinanceOfPassExceptions };
