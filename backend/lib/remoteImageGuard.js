// Guards against server-side request forgery when the backend is asked to
// fetch a third-party URL (Fit Check's product garment image). A client-
// supplied URL fetched with axios.get is an SSRF primitive: pointed at
// internal services (cloud metadata, localhost, DB/admin ports) it lets an
// attacker read or probe resources the server can reach but they can't.
// The only legitimate product-image host is Cloudinary, so the guard is a
// strict https + hostname allowlist, not a DNS round-trip or IP-range check
// (those are race-prone and can't be done reliably from app code anyway).
// Callers reject anything that isn't a Cloudinary URL.
const CLOUDINARY_HOST_SUFFIX = 'cloudinary.com';

export function assertSafeRemoteImageUrl(rawUrl, { logger } = {}) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch (e) {
    logger?.warn?.({ url: rawUrl }, 'Rejected non-parseable remote image URL');
    return false;
  }

  if (url.protocol !== 'https:') {
    logger?.warn?.({ url: rawUrl, protocol: url.protocol }, 'Rejected non-https remote image URL');
    return false;
  }

  const host = url.hostname.toLowerCase();
  if (host === CLOUDINARY_HOST_SUFFIX || host.endsWith(`.${CLOUDINARY_HOST_SUFFIX}`)) {
    return true;
  }

  logger?.warn?.({ url: rawUrl, host }, 'Rejected remote image URL outside the Cloudinary allowlist');
  return false;
}

export default { assertSafeRemoteImageUrl };
