import * as refundRepository from '../repositories/refundRepository.js';
import * as staffProfileRepository from '../repositories/staffProfileRepository.js';
import * as notificationRepository from '../repositories/notificationRepository.js';
import prisma from './prisma.js';
import logger from './logger.js';
import Sentry from './sentry.js';

/**
 * Enterprise Fulfillment Blueprint §13.4 — "a Refund.status = pending past
 * N hours reminder, structurally identical to the existing payment-reminder
 * cron." Money sitting un-refunded is the one queue on this platform with a
 * direct trust cost (COMMERCE_ENGINE.md's return/refund rules), so this
 * notifies every Finance-department staffer once per refund, rather than
 * silently accumulating in a queue view nobody's watching.
 *
 * Idempotency: this runs hourly, and a refund can sit pending for days, so
 * naively notifying every sweep would spam each staffer dozens of times for
 * one refund. Each reminder embeds the refund id in its body and is deduped
 * against existing notifications for that staffer + refund, so a refund is
 * flagged once — not once per hour it stays unresolved. (The notification is
 * intentionally not re-sent on later sweeps; the "still pending" state is
 * already visible on the /admin/returns queue.)
 */
const REMINDER_THRESHOLD_HOURS = 24;

export async function sendRefundReminders() {
  const cutoff = new Date(Date.now() - REMINDER_THRESHOLD_HOURS * 60 * 60 * 1000);
  const staleRefunds = await refundRepository.find({ where: { status: 'pending', createdAt: { lt: cutoff } } });

  if (staleRefunds.length === 0) {
    return { remindersSent: 0, staleCount: 0, errors: [] };
  }

  const financeStaff = await staffProfileRepository.find({ department: 'finance', active: true });
  let remindersSent = 0;
  const errors = [];

  for (const refund of staleRefunds) {
    try {
      for (const staff of financeStaff) {
        const body = `A refund of ₱${refund.amount.toFixed(2)} (refund ${refund._id || refund.id}) has been pending for over ${REMINDER_THRESHOLD_HOURS} hours.`;

        // Dedup: only one reminder per refund per staffer — the body carries
        // the refund id so a re-sweep can see it was already sent.
        const alreadyNotified = await prisma.notification.findFirst({
          where: { userId: staff.user.id, type: 'order', title: 'Refund awaiting processing', body },
          select: { id: true },
        });
        if (alreadyNotified) continue;

        // eslint-disable-next-line no-await-in-loop
        await notificationRepository.create({
          userId: staff.user.id,
          type: 'order',
          title: 'Refund awaiting processing',
          body,
          link: `/admin/returns`,
        });
      }
      remindersSent += 1;
    } catch (err) {
      logger.error({ err, refundId: refund._id }, 'Failed to send refund reminder');
      Sentry.captureException(err);
      errors.push({ refundId: refund._id, error: err });
    }
  }

  return { remindersSent, staleCount: staleRefunds.length, errors };
}

export default { sendRefundReminders, REMINDER_THRESHOLD_HOURS };
