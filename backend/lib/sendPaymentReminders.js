import * as orderRepository from '../repositories/orderRepository.js';
import * as siteSettingsRepository from '../repositories/siteSettingsRepository.js';
import * as notificationRepository from '../repositories/notificationRepository.js';
import { sendPaymentPendingEmail, sendPaymentReminderEmail } from '../services/emailService.js';
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

// Pending-Payment Email UX Revision — the "Complete Your Payment" email
// used to fire unconditionally the instant a checkout session was created
// (routes/orders.js), before the customer had even redirected to the
// gateway. This tier replaces that: the exact same email
// (sendPaymentPendingEmail — content unchanged), but only for an order
// that is *still* `awaiting_payment` a grace period after checkout.
// Measured from Order.createdAt directly (checkout-relative), unlike
// TIERS above (deadline-relative).
const INITIAL_TIER_KEY = 'initial_30m';
const INITIAL_GRACE_MINUTES = 30;

/**
 * Durable Payment Reminder Delivery — every tier this module can send now
 * represents a successfully delivered attempt, not merely an attempted
 * one (the "skip a stale catch-up tier without sending it" tiers below
 * are the one deliberate exception — see the comment on `skipKeys`).
 *
 * paymentReminderTiers has no separate claimed-vs-sent column the way
 * Order.confirmationEmailSentAt/confirmationEmailClaimedAt does, so a
 * claim lives inside the same String[] as one extra encoded entry:
 * `${tierKey}:claimed:${epochMs}`, written atomically alongside (never
 * instead of) the bare keys already there. It's replaced with the bare
 * `tierKey` once delivery is confirmed, or removed entirely if delivery
 * failed — so a bare entry in paymentReminderTiers always means "this was
 * actually sent" (or deliberately, permanently skipped — see below),
 * never "an attempt was made."
 */
const CLAIM_LEASE_MINUTES = 15;
const CLAIM_MARKER = ':claimed:';

function encodeClaim(tierKey, atMs) {
  return `${tierKey}${CLAIM_MARKER}${atMs}`;
}

/**
 * sent: a bare `tierKey` entry exists — permanently done, never touched
 * again by any future sweep.
 * claimedFresh: another attempt (this process or a concurrent one) is
 * live right now, within the lease window — back off, don't double-send.
 * staleEntry: a claim exists but is older than the lease window — its
 * worker almost certainly crashed or was killed mid-send without
 * releasing; this exact entry can be evicted and the tier reclaimed.
 */
function describeTier(tiers, tierKey, staleBeforeMs) {
  if (tiers.includes(tierKey)) return { sent: true, claimedFresh: false, staleEntry: null };

  const claimPrefix = `${tierKey}${CLAIM_MARKER}`;
  const claimEntry = tiers.find((entry) => entry.startsWith(claimPrefix));
  if (!claimEntry) return { sent: false, claimedFresh: false, staleEntry: null };

  const claimedAtMs = Number(claimEntry.slice(claimPrefix.length));
  if (claimedAtMs >= staleBeforeMs) return { sent: false, claimedFresh: true, staleEntry: null };
  return { sent: false, claimedFresh: false, staleEntry: claimEntry };
}

/**
 * Claims one tier, attempts `send()`, and finalizes or releases the claim
 * based on whether it actually succeeded — the core fix for "a failed
 * SMTP attempt permanently consumes the tier." `extraCommitKeys` (used
 * only by the deadline-tier caller) are committed atomically alongside the
 * claim, unconditionally of `send()`'s outcome — they represent a
 * deliberate "never send this, but never reconsider it either" decision
 * made before the attempt even starts, not a delivery outcome, so a
 * failed send below must not undo them.
 *
 * The claim step is the fix for the stale-snapshot race: it re-checks
 * orderStatus === 'awaiting_payment' at claim time via
 * casReminderTiers({ requireAwaitingPayment: true }), not just at the
 * sweep's initial query — an order that paid, failed, or expired between
 * that query and this call fails the claim outright and receives nothing.
 * The same compare-and-swap also serializes concurrent workers: only one
 * can ever hold a given tier's claim at a time.
 *
 * Returns the tiers array this order actually ends up with, so the caller
 * can feed it into the next tier attempt in the same pass without relying
 * on a now-possibly-stale local copy.
 */
async function attemptTier({ order, currentTiers, tierKey, extraCommitKeys = [], now, send }) {
  const staleBeforeMs = now - CLAIM_LEASE_MINUTES * 60 * 1000;
  const state = describeTier(currentTiers, tierKey, staleBeforeMs);
  if (state.sent || state.claimedFresh) {
    return { delivered: false, tiers: currentTiers };
  }

  const base = state.staleEntry ? currentTiers.filter((entry) => entry !== state.staleEntry) : currentTiers;
  const claimEntry = encodeClaim(tierKey, now);
  const claimNext = [...base, ...extraCommitKeys, claimEntry];

  const claimed = await orderRepository.casReminderTiers(order._id, {
    expected: currentTiers,
    next: claimNext,
    requireAwaitingPayment: true,
  });
  if (!claimed) {
    // Lost the race to another worker, or the order resolved away from
    // awaiting_payment since the sweep's snapshot was read. Either way,
    // back off rather than retry within this same pass — a fresh read on
    // the next sweep will settle it correctly.
    return { delivered: false, tiers: currentTiers };
  }

  let delivered = false;
  try {
    await send();
    delivered = true;
  } catch (emailError) {
    logger.error({ err: emailError, orderNumber: order.orderNumber, tierKey }, 'Failed to send payment reminder email');
    Sentry.captureException(emailError);
  }

  if (delivered) {
    const finalizeNext = [...base, ...extraCommitKeys, tierKey];
    const finalized = await orderRepository.casReminderTiers(order._id, { expected: claimNext, next: finalizeNext });
    if (finalized) return { delivered: true, tiers: finalizeNext };

    // The send genuinely succeeded but recording it lost a race it never
    // should have been able to lose (nothing else should be able to touch
    // this order's claim entry while we hold it). Leave the claim marker
    // in place rather than guess — a later sweep's stale-claim recovery
    // will reconcile it. Never silently drop that the email actually went
    // out.
    logger.error({ orderNumber: order.orderNumber, tierKey }, 'Failed to finalize a delivered payment reminder — will self-heal via stale-claim recovery on a later sweep');
    Sentry.captureException(new Error(`Failed to finalize reminder tier ${tierKey} for order ${order.orderNumber}`));
    return { delivered: true, tiers: claimNext };
  }

  const releaseNext = [...base, ...extraCommitKeys];
  const released = await orderRepository.casReminderTiers(order._id, { expected: claimNext, next: releaseNext });
  if (released) return { delivered: false, tiers: releaseNext };

  logger.error({ orderNumber: order.orderNumber, tierKey }, 'Failed to release a failed payment reminder claim — will self-heal via stale-claim recovery on a later sweep');
  Sentry.captureException(new Error(`Failed to release reminder tier claim ${tierKey} for order ${order.orderNumber}`));
  return { delivered: false, tiers: claimNext };
}

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
      // Running local snapshot — updated after every attemptTier call so
      // the next attempt in this same pass (deadline tiers, right below)
      // always CASes against what's actually in the database, not a
      // snapshot that attemptTier's own claim/finalize/release may have
      // already moved past.
      let tiers = [...(order.paymentReminderTiers || [])];
      const minutesSinceCreated = (now - new Date(order.createdAt).getTime()) / (60 * 1000);
      const hoursSinceCreated = minutesSinceCreated / 60;
      const hoursRemaining = retentionHours - hoursSinceCreated;

      // Initial pending-payment reminder — checkout-relative, independent
      // of the deadline-relative tiers below.
      if (minutesSinceCreated >= INITIAL_GRACE_MINUTES) {
        const result = await attemptTier({
          order,
          currentTiers: tiers,
          tierKey: INITIAL_TIER_KEY,
          now,
          send: () => sendPaymentPendingEmail(order.email, order),
        });
        tiers = result.tiers;

        if (result.delivered) {
          remindersSent += 1;
          if (order.user) {
            notificationRepository.create({
              userId: order.user,
              type: 'order',
              title: 'Complete your payment',
              body: `Order #${order.orderNumber} is still waiting on payment.`,
              link: `/order/${order.orderNumber}`,
            }).catch((err) => logger.error({ err, orderNumber: order.orderNumber }, 'Failed to create initial payment-pending notification'));
          }
        }
      }

      // Every deadline tier whose threshold has been crossed but hasn't
      // been sent (or permanently skipped — see skipKeys below) yet.
      const dueTierDefs = TIERS.filter((t) => hoursRemaining <= t.hours && !tiers.includes(t.key));
      if (dueTierDefs.length === 0) continue;

      // Send only the most urgent (smallest remaining-hours) tier that's
      // due — a customer doesn't need two reminder emails back to back for
      // thresholds they've already blown past. The other due-but-skipped
      // tiers are still committed as bare (permanently "handled") keys via
      // extraCommitKeys below, so a later sweep never sends the stale
      // catch-up reminder either — that's a deliberate "never send this"
      // decision made regardless of whether the actually-attempted tier's
      // email succeeds, not a delivery outcome, so it isn't subject to the
      // success/failure semantics attemptTier applies to the one tier it
      // actually sends.
      const mostUrgentDef = dueTierDefs[dueTierDefs.length - 1];
      const skipKeys = dueTierDefs.filter((t) => t.key !== mostUrgentDef.key).map((t) => t.key);

      const result = await attemptTier({
        order,
        currentTiers: tiers,
        tierKey: mostUrgentDef.key,
        extraCommitKeys: skipKeys,
        now,
        send: () => sendPaymentReminderEmail(order.email, order, mostUrgentDef.label),
      });
      tiers = result.tiers;

      if (result.delivered) {
        remindersSent += 1;
        if (order.user) {
          notificationRepository.create({
            userId: order.user,
            type: 'order',
            title: 'Your order is waiting',
            body: `Order #${order.orderNumber} still needs payment — ${mostUrgentDef.label} left.`,
            link: `/order/${order.orderNumber}`,
          }).catch((err) => logger.error({ err, orderNumber: order.orderNumber }, 'Failed to create payment-reminder notification'));
        }
      }
    } catch (err) {
      logger.error({ err, orderNumber: order.orderNumber }, 'Failed to send payment reminder');
      Sentry.captureException(err);
      errors.push({ orderNumber: order.orderNumber, error: err });
    }
  }

  return { skipped: false, remindersSent, candidateCount: pendingOrders.length, errors };
}

export default { sendPaymentReminders };
