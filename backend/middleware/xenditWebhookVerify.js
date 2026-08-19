import crypto from 'crypto';
import logger from '../lib/logger.js';

/**
 * Unlike Maya, Xendit signs every webhook delivery with a shared secret —
 * the x-callback-token header, compared against a token retrieved once
 * from the Xendit Dashboard's Webhook settings and stored as
 * XENDIT_WEBHOOK_TOKEN. This is the actual signature verification CLAUDE.md's
 * "signature verification is the mechanism when a provider offers one" rule
 * calls for, so — unlike mayaWebhookIpAllowlist.js — the route that uses
 * this trusts the payload's own status directly once the token matches; no
 * separate re-pull against Xendit's status API is needed on top of it (see
 * ADR-010). This does not relax CLAUDE.md's "never trust the payload" rule;
 * a verified token is what makes the payload trustworthy in the first
 * place.
 *
 * crypto.timingSafeEqual, not `===` — a naive string comparison leaks how
 * many leading characters matched via response-time differences, letting an
 * attacker guess the token one byte at a time. Both buffers must be the
 * same length for timingSafeEqual to run at all, so a length mismatch is
 * checked (and rejected) first, before comparison.
 */
export function xenditWebhookVerify(req, res, next) {
  const expectedToken = process.env.XENDIT_WEBHOOK_TOKEN;
  const receivedToken = req.headers['x-callback-token'];

  if (!expectedToken || !receivedToken) {
    logger.warn({ hasReceivedToken: Boolean(receivedToken) }, 'Rejected Xendit webhook with missing token');
    return res.status(403).json({ success: false });
  }

  const expected = Buffer.from(expectedToken);
  const received = Buffer.from(receivedToken);

  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    logger.warn('Rejected Xendit webhook with an invalid token');
    return res.status(403).json({ success: false });
  }

  next();
}

export default xenditWebhookVerify;
