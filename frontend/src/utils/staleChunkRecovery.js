// Production Stale Chunk Auto-Recovery — when a browser tab stays open
// across a Vercel deployment, its in-memory module graph still points at
// the previous build's content-hashed chunk filenames (e.g.
// Checkout-<oldHash>.js). Vercel's SPA rewrite (vercel.json) serves
// index.html for any now-missing asset path instead of a 404, so the
// browser gets HTML where it expected a JS module and the dynamic
// import() rejects — this is what produced the blank page at /checkout.
// None of this reflects a real application bug; a fresh page load
// (fetching the CURRENT index.html + CURRENT hashes) resolves it
// immediately.
//
// This module is the single source of truth for detecting that failure
// shape and deciding whether it's safe to auto-recover. Two entry points
// feed into it: ChunkErrorBoundary (the primary path — scoped to errors
// actually thrown inside the lazy-loaded route tree, via React's own
// lazy/Suspense error propagation) and main.jsx's global `error`/
// `unhandledrejection` listeners (a backstop for anything that escapes
// React's render cycle entirely, which is what the observed incident's
// "Uncaught TypeError" console entries were — no error boundary existed
// anywhere in the app before this).

const RELOAD_GUARD_KEY = 'puso-stale-chunk-reload-attempted';

// Deliberately broad, not a single exact string — different browsers word
// this differently, and Chrome alone used at least two distinct messages
// for the same root cause in the incident that prompted this (see the
// original console output: "Failed to load module script" resource
// errors alongside "Failed to fetch dynamically imported module" and a
// MIME-type detail line).
const STALE_CHUNK_ERROR_PATTERN =
  /failed to fetch dynamically imported module|failed to load module script|error loading dynamically imported module|importing a module script failed|loading chunk [\w.-]+ failed|mime type of ["']?text\/html["']?/i;

let paymentInFlight = false;

/**
 * Checkout calls this around the order-creation/redirect submission.
 * Structurally, a chunk-load failure can't actually occur mid-submission
 * in this codebase today — Checkout.jsx has no dynamic imports of its
 * own, so a lazy-chunk failure can only happen at route-navigation time,
 * before Checkout ever finishes rendering — but this is a deliberate,
 * explicit second guard against ever auto-reloading during an active
 * payment submission, independent of how the code evolves later.
 */
export function markPaymentInFlight() {
  paymentInFlight = true;
}

export function clearPaymentInFlight() {
  paymentInFlight = false;
}

export function isPaymentInFlight() {
  return paymentInFlight;
}

/** Accepts a string message, an Error, or an Error-like object (anything
 * with a `.message`). Never throws on unexpected shapes. */
export function isStaleChunkError(error) {
  const message = typeof error === 'string' ? error : error?.message ?? '';
  return STALE_CHUNK_ERROR_PATTERN.test(message);
}

function readGuard() {
  try {
    return sessionStorage.getItem(RELOAD_GUARD_KEY) === '1';
  } catch {
    // Storage can throw in a locked-down context (private-browsing
    // quirks, disabled storage) — treat as "not yet attempted" so
    // recovery can still proceed once.
    return false;
  }
}

function writeGuard() {
  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
  } catch {
    // Best-effort — if storage is unavailable, worst case is we can't
    // remember the guard across the reload and might try once more than
    // intended, never fewer, and never in an unbounded loop (the reload
    // itself always fetches a fresh page, which starts a fresh guard
    // check from scratch).
  }
}

export function hasAlreadyAttemptedRecovery() {
  return readGuard();
}

/** Called once the app has actually rendered successfully — clears the
 * guard so a LATER, separate deployment can still trigger its own
 * one-time auto-recovery instead of being silently blocked forever. */
export function clearRecoveryGuard() {
  try {
    sessionStorage.removeItem(RELOAD_GUARD_KEY);
  } catch {
    // no-op
  }
}

/**
 * The one place that decides whether to actually reload. Returns true if
 * it triggered a reload, false if it declined (not a stale-chunk error,
 * a payment submission is in flight, or recovery was already attempted
 * this cycle). `reload` is injectable for tests — defaults to a real hard
 * reload of the current page (same URL, so the customer isn't redirected
 * anywhere unexpected).
 */
export function attemptStaleChunkRecovery(error, { reload = () => window.location.reload() } = {}) {
  if (!isStaleChunkError(error)) return false;
  if (isPaymentInFlight()) return false;
  if (readGuard()) return false;

  writeGuard();
  reload();
  return true;
}

export default {
  isStaleChunkError,
  attemptStaleChunkRecovery,
  hasAlreadyAttemptedRecovery,
  clearRecoveryGuard,
  markPaymentInFlight,
  clearPaymentInFlight,
  isPaymentInFlight,
};
