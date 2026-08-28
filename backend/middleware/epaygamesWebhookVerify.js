import crypto from 'crypto';
import logger from '../lib/logger.js';

/**
 * ePayGames' own documentation requires BOTH controls together, not
 * either/or: "Do not process any webhook request unless the HMAC
 * signature is verified AND the request originates from one of the
 * whitelisted IP addresses." That's a genuinely different shape from both
 * existing webhook middlewares — xenditWebhookVerify.js trusts a signed
 * token alone (ADR-010: Xendit's signature is real, independent proof, so
 * nothing else is needed once it checks out); mayaWebhookIpAllowlist.js
 * uses IP allowlisting alone because Maya has no signature scheme to check
 * at all. ePayGames documents a real signature AND asks for the IP check
 * on top of it, so this middleware checks both, in one place — neither
 * existing file is a template for this alone.
 *
 * IMPORTANT: a valid signature (or a valid IP, or both) only means the
 * request is authentic enough to be WORTH ACTING ON — it does not mean the
 * order gets marked paid here. This middleware never touches the
 * database; the route behind it still performs its own authenticated
 * getPaymentStatus lookup before resolving anything (WEBHOOK ≠ PROOF OF
 * PAYMENT — see routes/orders.js's epaygames webhook handler).
 *
 * Signature format, per ePayGames' Payments API documentation's own
 * example ("100@EPLKZT2OH319WBEF"):
 *   HMAC-SHA256(EPAYGAMES_SIGNATURE_KEY, `${amount}@${reference_no}`)
 * hex-encoded, read from the webhook's own top-level `data.signature` —
 * both `amount` and `reference_no` come from that same top-level `data`
 * object, not from the nested `data.transaction` copy of them.
 *
 * Confirmed directly against two real sandbox webhook deliveries
 * (2026-08-28) — our first implementation used `|` as the delimiter
 * (a misreading, not documented anywhere) and every real delivery failed
 * verification as a result. Recomputing with `@` matched both real
 * received signatures exactly. Do not change this delimiter again without
 * re-confirming against a real delivery the same way.
 */
const SANDBOX_IPS = new Set(['43.198.4.7']);
const PRODUCTION_IPS = new Set(['18.166.179.109', '18.166.252.124']);

function isAllowedIp(req) {
  // Skipped outside real production — same reasoning
  // mayaWebhookIpAllowlist.js already documents: ePayGames' real IPs never
  // reach a local/dev/test/CI environment, and enforcing this there would
  // only break local webhook testing and this route's own test suite.
  if (process.env.NODE_ENV !== 'production') return true;
  const allowedIps = process.env.EPAYGAMES_SANDBOX === 'true' ? SANDBOX_IPS : PRODUCTION_IPS;
  return allowedIps.has(req.ip);
}

function verifySignature(data) {
  const signatureKey = process.env.EPAYGAMES_SIGNATURE_KEY;
  const receivedSignature = data?.signature;
  if (!signatureKey || typeof receivedSignature !== 'string' || receivedSignature.length === 0) {
    return false;
  }

  const payload = `${data.amount}@${data.reference_no}`;
  const expectedSignature = crypto.createHmac('sha256', signatureKey).update(payload).digest('hex');

  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(receivedSignature);
  // Both buffers must be the same length for timingSafeEqual to run at
  // all — a length mismatch is checked (and rejected) first, same
  // discipline xenditWebhookVerify.js's own comparison already documents.
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}

export function epaygamesWebhookVerify(req, res, next) {
  if (!isAllowedIp(req)) {
    logger.warn({ ip: req.ip }, 'Rejected ePayGames webhook from an unrecognized IP');
    return res.status(403).json({ success: false });
  }

  const data = req.body?.data;
  const hasWellFormedAmountAndReference = Boolean(data)
    && typeof data.reference_no === 'string' && data.reference_no.length > 0
    && (typeof data.amount === 'number' || typeof data.amount === 'string');

  if (!hasWellFormedAmountAndReference) {
    logger.warn('Rejected ePayGames webhook with a missing/malformed payload');
    return res.status(403).json({ success: false });
  }

  if (!verifySignature(data)) {
    logger.warn({ referenceNo: data.reference_no }, 'Rejected ePayGames webhook with an invalid signature');
    return res.status(403).json({ success: false });
  }

  next();
}

export default epaygamesWebhookVerify;
