import * as orderRepository from '../repositories/orderRepository.js';
import * as passRepository from '../repositories/passRepository.js';
import { ensurePassQrCode } from './passQrCode.js';
import { sendOrderConfirmationEmail } from '../services/emailService.js';
import logger from './logger.js';
import Sentry from './sentry.js';

const CLAIM_LEASE_MINUTES = 15;

export async function sendOrderConfirmation(order) {
  const claimedAt = new Date();
  const staleBefore = new Date(claimedAt.getTime() - CLAIM_LEASE_MINUTES * 60 * 1000);
  const claimed = await orderRepository.claimConfirmationEmailDelivery(order._id, { claimedAt, staleBefore });
  if (!claimed) return 'skipped';

  try {
    let passesForEmail = [];
    if (order.passes?.length) {
      passesForEmail = await passRepository.findByOrderId(order._id);
      const qrCodeUrls = await Promise.all(passesForEmail.map((pass) => ensurePassQrCode(pass)));
      passesForEmail = passesForEmail.map((pass, index) => ({ ...pass, qrCodeUrl: qrCodeUrls[index] }));
    }

    await sendOrderConfirmationEmail(order.email, { ...order, passes: passesForEmail });
    const marked = await orderRepository.markConfirmationEmailSent(order._id, { claimedAt });
    if (!marked) throw new Error(`Confirmation email claim lost for ${order.orderNumber}`);
    return 'sent';
  } catch (error) {
    await orderRepository.releaseConfirmationEmailClaim(order._id, { claimedAt }).catch((releaseError) => {
      logger.error({ err: releaseError, orderNumber: order.orderNumber }, 'Failed to release confirmation email claim');
      Sentry.captureException(releaseError);
    });
    throw error;
  }
}

export default { sendOrderConfirmation };
