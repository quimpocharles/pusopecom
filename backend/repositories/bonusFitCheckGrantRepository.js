import prisma from '../lib/prisma.js';

// Reasons that should only ever grant once per user — the trigger sites in
// routes/auth.js and routes/orders.js call grant() every time their event
// fires (e.g. every login isn't a re-verification, but a defensive caller
// could still call this twice), so idempotency lives here, not at each call
// site. admin_grant is deliberately excluded — an admin can grant bonus
// Fit Checks to the same user more than once, on purpose.
const ONCE_PER_USER_REASONS = new Set(['profile_complete', 'email_verified', 'first_purchase']);

/**
 * Creates a grant, unless `reason` is one of the once-per-user reasons and
 * this user already has one — in which case it's a no-op (returns null).
 * Amount is passed in by the caller (read from SiteSettings at the call
 * site) rather than looked up here, so this module stays a plain ledger
 * with no config-reading responsibility of its own.
 */
export async function grant(userId, reason, amount, { note, client = prisma } = {}) {
  if (ONCE_PER_USER_REASONS.has(reason)) {
    const existing = await client.bonusFitCheckGrant.findFirst({ where: { userId, reason } });
    if (existing) return null;
  }
  return client.bonusFitCheckGrant.create({
    data: { userId, reason, amount, note },
  });
}

/** Sum of (amount - consumedCount) across every grant a user holds. Never negative. */
export async function getBalance(userId, { client = prisma } = {}) {
  const result = await client.bonusFitCheckGrant.aggregate({
    where: { userId },
    _sum: { amount: true, consumedCount: true },
  });
  const amount = result._sum.amount || 0;
  const consumed = result._sum.consumedCount || 0;
  return Math.max(0, amount - consumed);
}

/**
 * Atomically draws down one unit of bonus balance, oldest grant first.
 * Same real-transaction discipline as productRepository.decrementStock —
 * `FOR UPDATE` locks the chosen row for the transaction's duration, so two
 * concurrent Fit Checks racing for the last unit of bonus balance can't
 * both succeed: the second transaction blocks until the first commits,
 * then re-reads a consumedCount that already reflects the first's draw.
 * Returns true if a unit was consumed, false if the user has no balance left.
 */
export async function consumeOne(userId, { client = prisma } = {}) {
  return client.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT id FROM bonus_fit_check_grants
      WHERE "userId" = ${userId} AND "consumedCount" < amount
      ORDER BY "grantedAt" ASC
      LIMIT 1
      FOR UPDATE
    `;
    if (rows.length === 0) return false;

    await tx.bonusFitCheckGrant.update({
      where: { id: rows[0].id },
      data: { consumedCount: { increment: 1 } },
    });
    return true;
  });
}

/** Full grant history for one user, newest first — the audit trail backing the admin grant panel. */
export async function findByUser(userId, { client = prisma } = {}) {
  return client.bonusFitCheckGrant.findMany({
    where: { userId },
    orderBy: { grantedAt: 'desc' },
  });
}

export default { grant, getBalance, consumeOne, findByUser };
