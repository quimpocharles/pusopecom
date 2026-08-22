// Canonical email form used for user identity lookups and storage.
// Local registration/login apply express-validator's default normalizeEmail()
// (lowercase, Gmail dots removed, plus-tags stripped). If Google OAuth stored
// the provider's un-normalized email, a user who registered locally as
// `ab@gmail.com` then signed in via Google as `a.b@gmail.com` would be treated
// as a brand-new account — a second identity, or worse a colliding one. This
// normalizer keeps every email boundary on the same form so local and OAuth
// identity stay one account. It never guesses a domain's rules beyond Gmail.
export function canonicalEmail(raw) {
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim().toLowerCase();
  const at = trimmed.indexOf('@');
  if (at === -1) return trimmed;
  let local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.replace(/\./g, '');
    local = local.replace(/\+.*$/, '');
  }
  return `${local}@${domain}`;
}

export default { canonicalEmail };
