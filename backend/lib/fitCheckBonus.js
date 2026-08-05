import * as siteSettingsRepository from '../repositories/siteSettingsRepository.js';
import * as bonusFitCheckGrantRepository from '../repositories/bonusFitCheckGrantRepository.js';

const AMOUNT_KEY_BY_REASON = {
  profile_complete: 'profileComplete',
  email_verified: 'emailVerified',
  first_purchase: 'firstPurchase',
};

/**
 * Grant for one of Phase 2's wired event reasons. Reads the admin-configured
 * amount and enabled flag from SiteSettings at call time — "no values
 * hardcoded" per CLAUDE.md — and relies on bonusFitCheckGrantRepository
 * .grant's own idempotency to no-op if this user already has the
 * once-per-user grant for `reason`. Callers treat this as fire-and-forget
 * (`.catch(...)`, same as tryOnLogRepository.migrateGuestSession) — a bonus
 * grant failing must never fail the real event it's attached to.
 */
export async function grantEventBonus(userId, reason) {
  const settings = await siteSettingsRepository.get();
  if (!settings.fitCheck.bonus.enabled) return;

  const amount = settings.fitCheck.bonus[AMOUNT_KEY_BY_REASON[reason]];
  if (!amount) return;

  await bonusFitCheckGrantRepository.grant(userId, reason, amount);
}

export default { grantEventBonus };
