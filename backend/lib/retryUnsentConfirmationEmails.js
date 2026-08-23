import * as orderRepository from '../repositories/orderRepository.js';
import { sendOrderConfirmation } from './orderConfirmationEmail.js';
import logger from './logger.js';
import Sentry from './sentry.js';

const RETRY_GRACE_MINUTES = 10;
const RETRY_BATCH_SIZE = 25;

export async function retryUnsentConfirmationEmails({ now = new Date() } = {}) {
  const cutoff = new Date(now.getTime() - RETRY_GRACE_MINUTES * 60 * 1000);
  const staleBefore = new Date(now.getTime() - 15 * 60 * 1000);
  const orders = await orderRepository.findPaidWithoutConfirmationEmail({
    cutoff,
    staleBefore,
    take: RETRY_BATCH_SIZE,
  });

  let sentCount = 0;
  let skippedCount = 0;
  const errors = [];
  for (const order of orders) {
    try {
      const result = await sendOrderConfirmation(order);
      if (result === 'sent') sentCount += 1;
      else skippedCount += 1;
    } catch (error) {
      logger.error({ err: error, orderNumber: order.orderNumber }, 'Failed to retry confirmation email');
      Sentry.captureException(error);
      errors.push({ orderNumber: order.orderNumber, error });
    }
  }

  return { sentCount, skippedCount, candidateCount: orders.length, errors };
}

export default { retryUnsentConfirmationEmails };
