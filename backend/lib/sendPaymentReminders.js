import * as orderRepository from '../repositories/orderRepository.js';
import * as siteSettingsRepository from '../repositories/siteSettingsRepository.js';
import * as notificationRepository from '../repositories/notificationRepository.js';
import { sendPaymentReminderEmail } from '../services/emailService.js';
import logger from './logger.js';
import Sentry from './sentry.js';

/**
 * Payment Platform Redesign, Phase 6 — "reminders at 6h/24h/2h before
 * expiration" (the original spec). Reinterpreted the same way Phase 1
 * reinterpreted "if Maya returns an expiration timestamp": Maya's checkout
 * session is a fixed, non-configurable 1 hour (verified against Maya's own
 * docs — see mayaGateway.js), so a "24 hours before expiry" reminder can't
 * mean that session. It means the real, meaningful deadline this platform
 * actually has — the order's own retention window (Order.createdAt +
 * SiteSettings.payment.orderRetentionHours, the same deadline Phase 4's
 * expireStaleOrders sweep enforces). Regenerating a checkout session
 * (Phase 3) doesn't move this deadline or reset which tiers already fired
 * — see the schema comment on Order.paymentReminderTiers.
 *
 * Gated on the same orderExpirationEnabled toggle as Phase 4's sweep: a
 * reminder that references a deadline the platform isn't actually going to
 * enforce would be misleading, not a genuinely separate on/off concern.
 */
const TIERS = [
  { key: '24h', hours: 24, label: '24 hours' },
  { key: '6h', hours: 6, label: '6 hours' },
  { key: '2h', hours: 2, label: '2 hours' },
];

export async function sendPaymentReminders() {
  const settings = await siteSettingsRepository.get();
  if (!settings.payment.orderExpirationEnabled) {
    return { skipped: true, remindersSent: 0, candidateCount: 0, errors: [] };
  }

  const retentionHours = settings.payment.orderRetentionHours;
  const pendingOrders = await orderRepository.find({ where: { orderStatus: 'awaiting_payment' } });

  let remindersSent = 0;
  const errors = [];
  const now = Date.now();

  for (const order of pendingOrders) {
    try {
      const hoursSinceCreated = (now - new Date(order.createdAt).getTime()) / (60 * 60 * 1000);
      const hoursRemaining = retentionHours - hoursSinceCreated;
      const alreadySent = order.paymentReminderTiers || [];

      // Every tier whose threshold has been crossed but hasn't fired yet —
      // usually one, but a cron gap (or a shorter admin-configured
      // retention window) can mean an order jumps past more than one
      // between runs.
      const dueTiers = TIERS.filter((t) => hoursRemaining <= t.hours && !alreadySent.includes(t.key));
      if (dueTiers.length === 0) continue;

      // Send only the most urgent (smallest remaining-hours) tier that's
      // due — a customer doesn't need two reminder emails back to back for
      // thresholds they've already blown past. Mark every due tier as
      // sent, not just the one emailed, so a later run never "catches up"
      // by sending the stale earlier one.
      const mostUrgent = dueTiers[dueTiers.length - 1];

      // Best-effort, same as every other email in the payment lifecycle
      // (sendOrderConfirmationEmail, etc.) — a delivery failure must never
      // block recording that this tier was processed. Retrying a
      // permanently-bouncing address every hour forever would be pointless.
      try {
        await sendPaymentReminderEmail(order.email, order, mostUrgent.label);
      } catch (emailError) {
        logger.error({ err: emailError, orderNumber: order.orderNumber }, 'Failed to send payment-reminder email');
        Sentry.captureException(emailError);
      }

      if (order.user) {
        notificationRepository.create({
          userId: order.user,
          type: 'order',
          title: 'Your order is waiting',
          body: `Order #${order.orderNumber} still needs payment — ${mostUrgent.label} left.`,
          link: `/order/${order.orderNumber}`,
        }).catch((err) => logger.error({ err, orderNumber: order.orderNumber }, 'Failed to create payment-reminder notification'));
      }

      await orderRepository.updateById(order._id, {
        paymentReminderTiers: [...alreadySent, ...dueTiers.map((t) => t.key)],
      });

      remindersSent += 1;
    } catch (err) {
      logger.error({ err, orderNumber: order.orderNumber }, 'Failed to send payment reminder');
      Sentry.captureException(err);
      errors.push({ orderNumber: order.orderNumber, error: err });
    }
  }

  return { skipped: false, remindersSent, candidateCount: pendingOrders.length, errors };
}

export default { sendPaymentReminders };
