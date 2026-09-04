import axios from 'axios';
import crypto from 'crypto';
import logger from '../../lib/logger.js';
import Sentry from '../../lib/sentry.js';

/**
 * ePayGames' implementation of the gateway interface paymentService.js
 * defines — createCheckoutSession(order) and getPaymentStatus(reference)
 * with the exact shapes xenditGateway.js/mayaGateway.js already return,
 * plus getChannels/calculateFee (not yet wired into any generic dispatch —
 * that's a later phase) and issueRefund (unsupported, see below).
 *
 * Built from ePayGames' own Payments API documentation reviewed earlier in
 * this evaluation (Environments & Setup, Authentication, Generate
 * Transaction, Get Channels, Calculate Total w/ Fee, Transaction & Payout
 * Statuses, Webhooks & Redirects, Idempotency & Safe Retries, Looking Up
 * Transactions, Error Handling, Testing & Sandbox) — never verified against
 * a live account or real credentials. Endpoint paths and field names below
 * are taken directly from that documentation; flag anything that turns out
 * wrong against a real sandbox call the same way xenditGateway.js's own
 * header comment already documents doing for Xendit.
 *
 * One thing this module deliberately does NOT do yet, out of scope for this
 * phase:
 *   - getChannels/calculateFee are real, working methods, but nothing
 *     outside this file calls them yet — generic channel/fee dispatch
 *     (mirroring xenditFees.js's role for Xendit) is a later phase.
 *
 * Webhook handling: createCheckoutSession sends callback_webhook_url
 * (POST /api/orders/webhooks/epaygames, verified by
 * epaygamesWebhookVerify.js) whenever BACKEND_URL is set to a publicly
 * reachable address — confirmed working against a real sandbox delivery
 * 2026-08-28. Omitted entirely when BACKEND_URL is unset (e.g. local dev
 * with no tunnel running) rather than sending an unreachable localhost URL
 * ePayGames could never deliver to; the customer's own /verify-payment
 * poll is the fallback resolution path in that case, same as any other
 * gateway's polling fallback.
 */

// One host for the Payments API; which one depends entirely on
// EPAYGAMES_SANDBOX, the same env-flag convention MAYA_SANDBOX already
// uses for mayaGateway.js — not a key-prefix distinction the way Xendit's
// single-URL/two-key-prefixes model works.
const EPAYGAMES_API_URL = process.env.EPAYGAMES_SANDBOX === 'true'
  ? 'https://api-stg.epaygames.io'
  : 'https://api.epaygames.io';

// Documentation's own "Testing & Sandbox" page flags this explicitly: only
// the Maya (PAYMAYA_QR) channel is confirmed to complete a payment in
// sandbox today — other channels Get Channels may list are untested there.
// Not enforced in code (nothing here should hardcode a sandbox-only
// restriction into production behavior), just worth knowing before trusting
// a sandbox result for any other channel.

// ePayGames' own Generate Transaction response returns a real, per-
// transaction `expires_at` (see createCheckoutSession's optional
// `expiresAt` return field) — nothing in the reviewed documentation states
// a fixed session duration up front the way Maya's 1-hour window is
// explicitly documented. This constant is a conservative placeholder ONLY
// for paymentService.getSessionDurationMs's pre-call estimate (routes/
// orders.js computes Payment.expiresAt from this BEFORE the gateway is
// even invoked) — prefer the real `expiresAt` this module returns whenever
// it's present. Not confirmed against ePayGames directly; revisit once
// they confirm an actual default, the same "verify the provider's real
// behavior, don't assume the spec" discipline ADR-008 applied to Maya's
// own session duration before trusting it.
export const SESSION_DURATION_MS = 60 * 60 * 1000;

// Bearer token obtained from Create Token — cached and reused rather than
// re-authenticated per request, per the documentation's own "call this no
// more than once every 55 minutes" guidance for a ~60-minute token. A
// module-level singleton, same lifetime as mayaGateway.js's/xenditGateway.js's
// own module-level constants — this file has exactly one process-wide
// token cache, not one per call site.
let cachedToken = null; // { token, expiresAt }
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

const REQUEST_TIMEOUT_MS = 10000;

// ePayGames' documented Payments API status vocabulary is only three
// values — pending, completed, cancelled — normalized to the same
// four-state model every gateway module reports through paymentService.js.
// `cancelled` is documented as covering three different real outcomes at
// once (the payment gateway cancelling it, an outright failure, or the
// session expiring before the customer completed payment), with no further
// sub-reason exposed anywhere in the reviewed API. `is_expired` — a
// separate boolean on the same transaction object — is the one documented
// lever available to partially recover the distinction; genuine failure
// and an explicit cancellation remain indistinguishable from each other
// and both map to 'failed' here. This is a documented limitation of
// ePayGames' own API, not a gap in this mapping — confirm directly with
// ePayGames whether a finer-grained reason exists anywhere before relying
// on more than this.
function normalizeStatus(transaction) {
  if (transaction?.status === 'completed') return 'succeeded';
  if (transaction?.status === 'pending') return 'pending';
  if (transaction?.status === 'cancelled') {
    return transaction.is_expired ? 'expired' : 'failed';
  }
  // Any other/unrecognized value — never treat as paid. Same fallthrough-
  // to-pending convention xenditGateway.js's and mayaGateway.js's own
  // STATUS_MAPs already use for anything outside their documented set.
  return 'pending';
}

// Axios attaches the full request (including this module's own POST body
// to Create Token — the raw username/password — and every other call's
// Authorization: Bearer header) to error.config. Logging the raw error
// object, the way xenditGateway.js/mayaGateway.js's simpler catch blocks
// already do for their own Basic-auth headers, would risk exactly the
// credential/token leak this phase was explicitly told never to allow —
// so every catch block here logs this reduced shape instead of the raw
// error.
function safeErrorLog(error) {
  return {
    message: error.message,
    status: error.response?.status,
    data: error.response?.data,
  };
}

async function getAuthToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt - TOKEN_REFRESH_MARGIN_MS) {
    return cachedToken.token;
  }

  try {
    const response = await axios.post(
      `${EPAYGAMES_API_URL}/v1/biller/token/create`,
      { username: process.env.EPAYGAMES_USERNAME, password: process.env.EPAYGAMES_PASSWORD },
      { headers: { 'Content-Type': 'application/json' }, timeout: REQUEST_TIMEOUT_MS }
    );

    const { token, expires_in: expiresIn } = response.data?.data || {};
    if (!token || !expiresIn) {
      throw new Error('ePayGames token response missing token/expires_in');
    }

    cachedToken = { token, expiresAt: Date.now() + expiresIn * 1000 };
    return token;
  } catch (error) {
    logger.error({ err: safeErrorLog(error), gateway: 'epaygames' }, 'ePayGames authentication failed');
    Sentry.captureException(error);
    throw new Error('Failed to authenticate with ePayGames');
  }
}

// A network-level failure (timeout, dropped connection) or a 5xx where we
// never saw a definite response — exactly what the documentation's
// "Idempotency & Safe Retries" guide calls an ambiguous failure, the one
// case where the caller must not just guess. A 4xx (e.g. 422 validation)
// is a definite rejection, not ambiguous — the request is confirmed not to
// have processed, so it's safe to just surface the error directly without
// a lookup.
function isAmbiguousFailure(error) {
  return !error.response || error.response.status >= 500;
}

async function lookupTransactionByReference(referenceNo, token) {
  const response = await axios.get(`${EPAYGAMES_API_URL}/v1/biller/transactions`, {
    params: { reference_no: referenceNo },
    headers: { Authorization: `Bearer ${token}` },
    timeout: REQUEST_TIMEOUT_MS,
  });
  // Confirmed against a real sandbox call (2026-08-27): the list lives at
  // data.data.transactions, not data.data directly as originally assumed
  // from documentation alone — this endpoint's response is one level
  // deeper than Get Channels'/Calculate Total's. Getting this wrong is
  // silent: Array.isArray on the wrong shape just returns false, so this
  // guards both a missing `data` and a `transactions` that isn't an array.
  const transactions = response.data?.data?.transactions;
  return Array.isArray(transactions) && transactions.length > 0 ? transactions[0] : null;
}

// ePayGames' Generate Transaction requires a country *code* (ISO 3166-1
// alpha-2), not the full country name Order.shippingAddress.country stores
// (e.g. 'Philippines'). The checkout's country field is a full name drawn
// from the fixed catalog in lib/config/shipping.js's COUNTRY_REGION_MAP
// (mirrored in frontend/src/utils/shipping.js), plus the 'Philippines'
// domestic default — so this map covers exactly that set, keyed by
// lowercased name. Anything already a valid 2-letter code passes through
// unchanged; anything else unmapped returns null rather than being guessed.
const COUNTRY_NAME_TO_CODE = {
  // Domestic default
  'philippines': 'PH',
  // SEA
  'singapore': 'SG', 'malaysia': 'MY', 'thailand': 'TH', 'indonesia': 'ID',
  'vietnam': 'VN', 'brunei': 'BN', 'cambodia': 'KH', 'laos': 'LA',
  'myanmar': 'MM', 'timor-leste': 'TL',
  // Middle East
  'united arab emirates': 'AE', 'saudi arabia': 'SA', 'qatar': 'QA',
  'kuwait': 'KW', 'bahrain': 'BH', 'oman': 'OM', 'jordan': 'JO', 'lebanon': 'LB',
  // North America
  'united states': 'US', 'canada': 'CA', 'mexico': 'MX',
  // East Asia
  'japan': 'JP', 'south korea': 'KR', 'china': 'CN', 'taiwan': 'TW',
  // Europe
  'united kingdom': 'GB', 'germany': 'DE', 'france': 'FR', 'italy': 'IT',
  'spain': 'ES', 'netherlands': 'NL', 'belgium': 'BE', 'switzerland': 'CH',
  'austria': 'AT', 'sweden': 'SE', 'norway': 'NO', 'denmark': 'DK',
  'finland': 'FI', 'portugal': 'PT', 'ireland': 'IE', 'poland': 'PL',
  'greece': 'GR', 'czech republic': 'CZ', 'romania': 'RO', 'hungary': 'HU',
  'slovakia': 'SK', 'slovenia': 'SI', 'croatia': 'HR', 'bulgaria': 'BG',
  'estonia': 'EE', 'latvia': 'LV', 'lithuania': 'LT', 'luxembourg': 'LU',
  'malta': 'MT', 'cyprus': 'CY', 'iceland': 'IS', 'monaco': 'MC',
  'liechtenstein': 'LI', 'san marino': 'SM', 'vatican city': 'VA',
};

function toCountryCode(country) {
  if (!country) return country;
  const trimmed = String(country).trim();
  // Already a valid ISO-2 code (e.g. 'PH', 'jp') — normalize to uppercase
  // and pass through rather than rejecting a value ePayGames would accept.
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  return COUNTRY_NAME_TO_CODE[trimmed.toLowerCase()] || null;
}

// Order stores a single `fullName`; ePayGames wants it split into
// first/last. A single whitespace split (first token = first name, the
// remainder = last name) is the convention already implied by the order's
// own data — 'Juan Dela Cruz' -> first 'Juan', last 'Dela Cruz'.
function splitFullName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') || parts[0] };
}

async function generateTransaction(referenceNo, order, channelCode, token) {
  // The 9 customer fields ePayGames' Generate Transaction requires (a real
  // 422 confirmed against the live API 2026-09-04: 'The email field is
  // required. (and 8 more errors)' — email, mobile_number, first_name,
  // last_name, address, city, state, zip_code, country_code). All sourced
  // from the order's existing fields — order.email and the nested
  // order.shippingAddress that orderRepository.reshapeOrder rebuilds from
  // the flattened shipTo* columns — never a second customer model.
  const address = order.shippingAddress || {};
  const { firstName, lastName } = splitFullName(address.fullName);
  return axios.post(
    `${EPAYGAMES_API_URL}/v1/biller/transactions/generate`,
    {
      channel_code: channelCode,
      amount: order.total,
      reference_no: referenceNo,
      email: order.email,
      mobile_number: address.phone,
      first_name: firstName,
      last_name: lastName,
      address: address.address,
      city: address.city,
      state: address.province,
      zip_code: address.zipCode,
      country_code: toCountryCode(address.country),
      success_redirect_url: `${process.env.FRONTEND_URL}/order/${order.orderNumber}?payment=success`,
      failure_redirect_url: `${process.env.FRONTEND_URL}/order/${order.orderNumber}?payment=failed`,
      // Completes the wiring Phase 2's own header comment flagged as
      // pending ("no route exists yet to receive it") — the route
      // (POST /api/orders/webhooks/epaygames, epaygamesWebhookVerify) has
      // existed since Phase 3. BACKEND_URL must be a publicly reachable
      // URL for ePayGames' servers to actually deliver to (a tunnel in
      // local dev); this is the only place that reads it — no other
      // gateway module needs a per-transaction callback URL the way
      // ePayGames' API does.
      ...(process.env.BACKEND_URL && {
        callback_webhook_url: `${process.env.BACKEND_URL}/api/orders/webhooks/epaygames`,
      }),
    },
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: REQUEST_TIMEOUT_MS,
    }
  );
}

// Logs, reports, and throws a clean message for one failed generate call —
// the same shape xenditGateway.js's/mayaGateway.js's own single try/catch
// already uses. Not shared between the original attempt and the safe
// retry: the ambiguous-failure check below needs the RAW axios error
// (with its real .response, if any) to decide whether a lookup is even
// warranted, so that decision has to happen before any wrapping occurs.
function logAndThrowCheckoutError(error, order, logMessage) {
  logger.error({ err: safeErrorLog(error), orderNumber: order.orderNumber, gateway: 'epaygames' }, logMessage);
  Sentry.captureException(error);
  // Laravel-style 422s ("The email field is required. (and 8 more errors)")
  // carry the actual field list in `errors`, NOT `message` — surface it in
  // the thrown error too, not just the structured log, or whoever hits this
  // from a checkout attempt has to go spelunking in logs to find out which
  // fields ePayGames' validator actually wanted.
  const errors = error.response?.data?.errors;
  const detail = errors && typeof errors === 'object'
    ? ` — ${JSON.stringify(errors)}`
    : '';
  throw new Error(`${error.response?.data?.message || 'Failed to create checkout session'}${detail}`);
}

export async function createCheckoutSession(order) {
  // order.paymentChannel is already ePayGames' own channel_code by the time
  // it reaches here — Phase 4/5's dispatch surfaces getChannels()'s real,
  // per-merchant codes straight through to the frontend, and the frontend
  // submits that same code back unchanged. There is deliberately no
  // internal-vocabulary translation map (a prior GCASH/MAYA -> channel_code
  // map existed here and was removed 2026-08-27): a static map goes stale
  // the moment the real catalog does (confirmed directly — a real sandbox
  // Get Channels call never returned GCASH_TRN at all, only PAYMAYA_QR/
  // BAYAD/PAYANDGO/PALAWANPAY_OTC), and ePayGames' own API is the
  // authoritative validator of whether a channel_code is real — an invalid
  // one comes back as a definite 4xx here, not an ambiguous failure.
  const channelCode = order.paymentChannel;
  if (typeof channelCode !== 'string' || channelCode.length === 0) {
    throw new Error(`Unrecognized payment channel for ePayGames: ${order.paymentChannel}`);
  }

  // Deliberately not wrapped in the same try/catch as the HTTP calls below
  // — getAuthToken() already logs, captures, and throws its own clear
  // "Failed to authenticate with ePayGames" error; catching it again here
  // would only replace that specific message with the generic checkout-
  // failure one below and double-report the same failure to Sentry.
  const token = await getAuthToken();

  // A random suffix, not just the bare order number — reference_no is
  // documented as usable exactly once, ever, the same one-shot constraint
  // xenditGateway.js's/mayaGateway.js's own reference_id/
  // requestReferenceNumber turned out to have.
  //
  // Uses '__' instead of the '#' Xendit/Maya's shared convention uses —
  // confirmed directly against the real sandbox (2026-08-28) that a '#' in
  // reference_no makes ePayGames' own hosted-checkout page-generation step
  // (deferred/load) fail with a 500 ("PM: Something went wrong with the
  // provider"), even though Generate Transaction and Get Transaction both
  // accept and return it unchanged — the failure is specific to their
  // hosted-page rendering, not their core API. ':' was also tested and
  // fails the same way; '__' and '_' both passed 4/4 real hosted-page
  // loads. '__' was chosen (over plain '_') so a future reviewer scanning
  // routes/orders.js's ePayGames webhook handler sees at a glance that this
  // is a deliberately different, ePayGames-only convention, not a typo of
  // Xendit/Maya's '#'. This is scoped to ePayGames only — xenditGateway.js
  // and mayaGateway.js keep their own '#' convention untouched.
  const referenceNo = `${order.orderNumber}__${crypto.randomBytes(6).toString('hex')}`;

  let data;
  try {
    const response = await generateTransaction(referenceNo, order, channelCode, token);
    data = response.data?.data;
  } catch (error) {
    if (!isAmbiguousFailure(error)) {
      logAndThrowCheckoutError(error, order, 'ePayGames checkout error');
    }

    // Safe-Retry Rule (ePayGames' "Idempotency & Safe Retries" guide):
    // never resubmit blindly on an ambiguous failure. Look up the same
    // reference_no first — if it exists, the original attempt actually
    // landed and its status is authoritative; if it doesn't, it's
    // confirmed safe to resubmit with the identical reference_no once.
    const existing = await lookupTransactionByReference(referenceNo, token).catch(() => null);
    if (existing) {
      data = existing;
    } else {
      try {
        const retryResponse = await generateTransaction(referenceNo, order, channelCode, token);
        data = retryResponse.data?.data;
      } catch (retryError) {
        logAndThrowCheckoutError(retryError, order, 'ePayGames checkout error (safe retry)');
      }
    }
  }

  // Never trust a response shape that's missing what the rest of this
  // gateway module (and routes/orders.js above it) depends on — a
  // "successful-looking" call with no redirect URL or reference is not
  // safe to treat as a real checkout session.
  if (!data?.reference_no || !data?.web_payment_url) {
    throw new Error('ePayGames transaction response missing required fields');
  }

  return {
    paymentReference: data.reference_no,
    redirectUrl: data.web_payment_url,
    // Optional — only present because ePayGames actually returns a real
    // per-transaction expiry, unlike Xendit/Maya. paymentService.js's
    // interface and routes/orders.js's own expiresAt computation must keep
    // working unchanged for gateways that don't provide this.
    ...(data.expires_at && { expiresAt: new Date(data.expires_at) }),
  };
}

export async function getPaymentStatus(paymentReference) {
  try {
    const token = await getAuthToken();
    const transaction = await lookupTransactionByReference(paymentReference, token);

    if (!transaction) {
      // No documented "not found" semantics beyond an empty result list —
      // treat as still pending rather than guessing a terminal state.
      return { status: 'pending', raw: null };
    }

    return { status: normalizeStatus(transaction), raw: transaction };
  } catch (error) {
    logger.error({ err: safeErrorLog(error), paymentReference, gateway: 'epaygames' }, 'ePayGames status check error');
    Sentry.captureException(error);
    throw new Error('Failed to retrieve checkout status');
  }
}

/**
 * ePayGames' documented Payments API surface (Create Token, Get
 * Transactions, Generate Transaction, Get Channels, Calculate Total w/ Fee)
 * has no refund, void, cancellation, or reversal endpoint anywhere in it —
 * confirmed during the earlier documentation review, not assumed. Per this
 * phase's explicit instruction: implement the interface method, but never
 * fake success or silently no-op. Refunds for ePayGames-routed orders need
 * either a manual/offline process or direct confirmation from ePayGames
 * that an undocumented endpoint exists — a product decision, not something
 * this file can safely guess at.
 */
export class EpaygamesRefundNotSupportedError extends Error {
  constructor() {
    super('ePayGames does not document a refund/void/reversal endpoint — refunds must be handled manually until confirmed otherwise directly with ePayGames.');
    this.name = 'EpaygamesRefundNotSupportedError';
  }
}

export async function issueRefund() {
  throw new EpaygamesRefundNotSupportedError();
}

// Not yet called by anything outside this module (see the file header) —
// implemented now because ePayGames' own channel catalog is genuinely
// dynamic/per-merchant, unlike Xendit's hardcoded lib/payments/xenditFees.js
// table, so there is no static list to fall back to even temporarily.
export async function getChannels() {
  try {
    const token = await getAuthToken();
    const response = await axios.get(`${EPAYGAMES_API_URL}/v1/biller/channels`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: REQUEST_TIMEOUT_MS,
    });

    const channels = response.data?.data;
    if (!Array.isArray(channels)) {
      throw new Error('ePayGames channels response missing data array');
    }

    return channels.map((channel) => ({
      code: channel.code,
      name: channel.name,
      slug: channel.slug,
      logo: channel.logo,
      isDisabled: Boolean(channel.is_disabled),
    }));
  } catch (error) {
    logger.error({ err: safeErrorLog(error), gateway: 'epaygames' }, 'ePayGames channel list error');
    Sentry.captureException(error);
    throw new Error('Failed to retrieve payment channels');
  }
}

// Same "not yet wired anywhere" status as getChannels above — Calculate
// Total w/ Fee is a real, live, per-channel/per-amount endpoint, so there's
// no static table to copy the way xenditFees.js hardcodes Xendit's.
export async function calculateFee(channelCode, amount) {
  try {
    const token = await getAuthToken();
    const response = await axios.get(`${EPAYGAMES_API_URL}/v1/biller/channels/calculate`, {
      params: { channel_code: channelCode, amount },
      headers: { Authorization: `Bearer ${token}` },
      timeout: REQUEST_TIMEOUT_MS,
    });

    const data = response.data?.data;
    if (!data || typeof data.total_amount !== 'number') {
      throw new Error('ePayGames fee calculation response missing required fields');
    }

    return {
      subtotal: data.subtotal_amount,
      fee: data.service_fee,
      total: data.total_amount,
      raw: data,
    };
  } catch (error) {
    logger.error({ err: safeErrorLog(error), channelCode, amount, gateway: 'epaygames' }, 'ePayGames fee calculation error');
    Sentry.captureException(error);
    throw new Error('Failed to calculate channel fee');
  }
}

export default {
  createCheckoutSession,
  getPaymentStatus,
  issueRefund,
  getChannels,
  calculateFee,
  SESSION_DURATION_MS,
};
