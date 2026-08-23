import axios from 'axios';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';

// MXroute HTTP API — Transactional Email Transport Migration.
//
// Root cause this replaces: production (Railway) could not establish a raw
// SMTP connection to fusion.mxrouting.net:587 — every attempt failed with
// ETIMEDOUT at the CONN stage, before authentication was ever reached (a
// firewall silently dropping the outbound packets, not MXroute rejecting
// the connection — see the investigation this migration followed).
// MXroute's own HTTP API relays the same message through MXroute's own
// SMTP infrastructure on our behalf, reached over HTTPS (port 443)
// instead. Verified against docs.mxroute.com/docs/api/smtp-api.html
// (fetched directly and cross-checked via DNS + TLS certificate — not
// assumed from a search summary), and confirmed working end-to-end from
// this exact Railway environment on 2026-08-23: real delivery to a Gmail
// inbox, independently verified in the Gmail UI (mailed-by/signed-by
// pusostore.com, TLS enabled).
//
// Endpoint is fixed and documented, not environment-specific — not an env
// var.
const MXROUTE_API_URL = 'https://smtpapi.mxroute.com/';

// Reuses the existing timeout knob rather than introducing a new one — the
// live diagnostic completed in ~2.5s under normal conditions, so the
// existing 10s default leaves generous headroom while still failing fast:
// a single bounded HTTP request, unlike the SMTP transport's separate
// connection/greeting/socket-phase timeouts this replaces.
const EMAIL_TIMEOUT_MS = Number(process.env.EMAIL_TIMEOUT_MS) || 10_000;

/**
 * Sends one email via MXroute's HTTP API. Resolves on confirmed delivery
 * to MXroute's own relay (`response.data.success === true`); throws
 * otherwise. Callers (orderConfirmationEmail.js's claim/release,
 * sendPaymentReminders.js's attemptTier) depend on exactly this
 * throw-on-failure contract to decide whether to record success or leave
 * the claim/tier retryable — unchanged from the SMTP transport's contract,
 * so those callers needed no changes.
 *
 * Never logs or throws the account password — only MXroute's own response
 * (or a network-level error's message/code) ever appears in logs, thrown
 * errors, or Sentry reports.
 *
 * `from`/`to` are plain email addresses (MXroute's documented `from`
 * field is described as "the sender's email address," and every example
 * in their docs uses a bare address — no example anywhere uses a quoted
 * display-name mailbox format like `"Name" <addr>`, and the live test
 * that confirmed this transport works end-to-end also used a bare
 * address). Passing a display-name-formatted `from` here is therefore
 * untested against the real API and deliberately not attempted — see
 * emailService.js's own comment on this exact tradeoff.
 *
 * `subject` must be plain ASCII. Confirmed via a live send: MXroute's API
 * does not RFC-2047-encode non-ASCII Subject-header content the way
 * nodemailer did automatically — a raw em dash (—) arrived at Gmail as
 * mojibake ("â€"", UTF-8 bytes misread as Windows-1252). `html` is
 * unaffected by this (it declares its own charset and this codebase's
 * templates use HTML entities for special characters in body text), so
 * this constraint is specific to `subject`.
 */
export async function sendEmail({ from, to, subject, html }) {
  const server = process.env.EMAIL_HOST;
  const username = process.env.EMAIL_USER;
  const password = process.env.EMAIL_PASSWORD;

  if (!server || !username || !password) {
    throw new Error('Email transport is not configured: EMAIL_HOST, EMAIL_USER, or EMAIL_PASSWORD is missing.');
  }

  let response;
  try {
    response = await axios.post(
      MXROUTE_API_URL,
      { server, username, password, from, to, subject, body: html },
      { headers: { 'Content-Type': 'application/json' }, timeout: EMAIL_TIMEOUT_MS, validateStatus: () => true }
    );
  } catch (error) {
    // Network-level failure (DNS, connection refused, our own timeout) —
    // never observed once talking to MXroute's API in testing, but handled
    // the same way a dropped SMTP connection used to be: thrown, caught by
    // the caller, claim released, retried later. Never includes the
    // request body (which carries the password) in the log or the thrown
    // error.
    logger.error({ err: { message: error.message, code: error.code }, to, subject }, 'MXroute API request failed');
    Sentry.captureException(error);
    throw new Error(`MXroute API request failed: ${error.code || error.message}`);
  }

  if (response.status >= 200 && response.status < 300 && response.data?.success) {
    return { provider: 'mxroute-api', httpStatus: response.status };
  }

  // HTTP itself succeeded but MXroute rejected the send (or returned an
  // unexpected shape) — still a failed delivery, not a success.
  const providerMessage = response.data?.message || `HTTP ${response.status}`;
  const error = new Error(`MXroute API rejected the email: ${providerMessage}`);
  logger.error({ httpStatus: response.status, providerMessage, to, subject }, 'MXroute API rejected the email');
  Sentry.captureException(error);
  throw error;
}

export default { sendEmail };
