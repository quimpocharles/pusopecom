// The single source of truth for building customer-facing URLs that must
// never point at a development host in production. Every transactional
// email link, the pass QR/logo assets, and the sitemap derive their base
// from FRONTEND_URL — which in a dev/ngrok workflow is a localhost or
// ngrok tunnel. In production that value must be the real storefront, and
// this guard enforces it: a production build that still has a localhost or
// ngrok FRONTEND_URL fails loudly at startup (see validateProductionConfig)
// rather than shipping emails with links no customer can open.
//
// The fallback host is the canonical production domain. It is NOT
// hardcoded to override FRONTEND_URL in normal operation — FRONTEND_URL
// remains the source of truth and CORS/gateway return URLs keep using it —
// it only stands in when FRONTEND_URL is genuinely unusable in production,
// so a misconfigured deploy degrades to the real domain instead of a dev
// tunnel. When FRONTEND_URL is unset entirely, the same fallback applies
// (this mirrors server.js's sitemap baseUrl handling).
export const PRODUCTION_HOST = 'https://pusostore.com';

const DEV_HOST_PATTERNS = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i,
  /\.ngrok(-free)?\.(dev|app|io)(:\d+)?(\/|$)/i,
];

export function isDevHost(url) {
  if (typeof url !== 'string' || url.trim() === '') return false;
  return DEV_HOST_PATTERNS.some((pattern) => pattern.test(url.trim()));
}

// Resolve the base to use for a customer-facing URL embedded in an EMAIL.
// A dev host is sanitized in EVERY environment, not just production: an
// email outlives the process that sent it, and a localhost/ngrok link is
// dead on arrival for any real recipient regardless of which environment
// sent it (the module's own test suite pins this contract). Browser-side
// redirects are different — Xendit/Maya return URLs and CORS keep using
// raw FRONTEND_URL so a developer's browser returns to their own dev
// frontend; production's guarantee for those comes from
// validateProductionConfig failing fast on a dev-host FRONTEND_URL at
// startup. `env` is injectable for tests.
export function productionBaseUrl(env = process.env) {
  const frontend = env.FRONTEND_URL;
  if (isDevHost(frontend)) return PRODUCTION_HOST;
  if (!frontend || frontend.trim() === '') return PRODUCTION_HOST;
  return frontend.replace(/\/+$/, '');
}

export default { isDevHost, productionBaseUrl, PRODUCTION_HOST };
