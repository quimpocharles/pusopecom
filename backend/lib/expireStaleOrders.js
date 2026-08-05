import * as orderRepository from '../repositories/orderRepository.js';
import * as siteSettingsRepository from '../repositories/siteSettingsRepository.js';
import { applyPaymentResolution } from '../routes/orders.js';

/**
 * Payment Platform Redesign, Phase 4 — the proactive half of order
 * expiration. Reactive expiration (a gateway itself reporting 'expired'
 * via the customer's poll or a webhook) already existed before this; this
 * sweep is for orders nobody ever reported back on at all — a fan closed
 * the tab, their phone died, the checkout session's own 1-hour Maya window
 * elapsed with nothing ever polling or webhooking about it. Those orders
 * would otherwise sit paymentStatus='pending' forever, holding their
 * reserved stock indefinitely.
 *
 * Reuses applyPaymentResolution — the exact same atomic-resolve +
 * releaseStock + dual-write Payment + OrderEvent sequence a real gateway
 * 'expired' report already goes through — rather than a second, drifting
 * copy of that logic. Each order is resolved independently so one failure
 * doesn't stop the rest of the sweep.
 */
export async function expireStaleOrders() {
  const settings = await siteSettingsRepository.get();
  if (!settings.payment.orderExpirationEnabled) {
    return { skipped: true, expiredCount: 0, candidateCount: 0, errors: [] };
  }

  const cutoff = new Date(Date.now() - settings.payment.orderRetentionHours * 60 * 60 * 1000);
  const staleOrders = await orderRepository.findStalePending({ cutoff });

  let expiredCount = 0;
  const errors = [];
  for (const order of staleOrders) {
    try {
      await applyPaymentResolution(order, 'expired', 'system');
      expiredCount += 1;
    } catch (err) {
      errors.push({ orderNumber: order.orderNumber, error: err });
    }
  }

  return { skipped: false, expiredCount, candidateCount: staleOrders.length, errors };
}

export default { expireStaleOrders };
