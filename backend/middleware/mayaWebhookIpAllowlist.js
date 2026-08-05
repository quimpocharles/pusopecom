import logger from '../lib/logger.js';

/**
 * Maya's Checkout webhook has no signing secret or HMAC scheme to verify a
 * payload against — confirmed directly against developers.maya.ph before
 * this was written, which recommends IP allowlisting as its own mitigation
 * instead. This is that mitigation, not a substitute for the route's own
 * "never trust the payload, always re-verify via an authenticated pull"
 * design (routes/orders.js's applyPaymentResolution) — the two are
 * complementary layers, not either/or.
 *
 * IPs per https://developers.maya.ph/docs/domains-and-ip-addresses.
 */
const SANDBOX_IPS = new Set(['13.229.160.234', '3.1.199.75']);
const PRODUCTION_IPS = new Set(['18.138.50.235', '3.1.207.200']);

export function mayaWebhookIpAllowlist(req, res, next) {
  // Skipped outside real production — Maya's documented IPs never reach a
  // local/dev/test/CI environment, and enforcing this there would only
  // break local webhook testing and this route's own test suite.
  if (process.env.NODE_ENV !== 'production') return next();

  const allowedIps = process.env.MAYA_SANDBOX === 'true' ? SANDBOX_IPS : PRODUCTION_IPS;
  if (allowedIps.has(req.ip)) return next();

  logger.warn({ ip: req.ip }, 'Rejected Maya webhook from an unrecognized IP');
  res.status(403).json({ success: false });
}

export default mayaWebhookIpAllowlist;
