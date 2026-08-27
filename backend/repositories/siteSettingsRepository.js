import prisma from '../lib/prisma.js';

/**
 * The Prisma schema flattens what used to be nested Mongoose subdocuments
 * to plain columns (tryOnAdVideoUrl, fitCheckDailyLimitGuest, etc. — see
 * the schema comment on SiteSettings). This module is the one place that
 * reshapes flat columns back into a nested API shape on the way out, and
 * flattens the same nested shape back down on the way in — callers should
 * never need to know the database is flat.
 *
 * `tryOn` (title/image/productUrl) was removed from this shape entirely
 * during the Settings IA redesign — confirmed dead (Home.jsx's Fit Check
 * teaser reads from Campaign(placement='tryOn') exclusively; nothing ever
 * read settingsService's tryOn group outside the admin form that wrote
 * it). `tryOnAd` is a separate, genuinely live feature and stays.
 */
function toNestedShape(row) {
  if (!row) return row;
  return {
    _id: row.id,
    tryOnAd: {
      videoUrl: row.tryOnAdVideoUrl,
      buttonText: row.tryOnAdButtonText,
      buttonUrl: row.tryOnAdButtonUrl,
    },
    // Distinct from tryOn/tryOnAd above on purpose — those are homepage
    // teaser *content* (an admin-editable headline/video for the section),
    // this is Fit Check *operational config* (daily allowances). Different
    // domain concepts that happen to both live on the same settings
    // singleton — kept in their own nested group rather than blurred
    // together, matching CLAUDE.md's "vocabulary matches the domain" rule.
    fitCheck: {
      dailyLimitGuest: row.fitCheckDailyLimitGuest,
      dailyLimitRegistered: row.fitCheckDailyLimitRegistered,
      dailyLimitPremium: row.fitCheckDailyLimitPremium,
      guestRetentionHours: row.fitCheckGuestRetentionHours,
      // Phase 2 — Bonus Fit Checks. Nested one level deeper than the daily
      // limits above since these govern a distinct mechanic (a durable
      // top-up ledger, not the resetting daily counter).
      bonus: {
        enabled: row.fitCheckBonusEnabled,
        profileComplete: row.fitCheckBonusProfileComplete,
        emailVerified: row.fitCheckBonusEmailVerified,
        firstPurchase: row.fitCheckBonusFirstPurchase,
      },
      // Phase 4 — Trending Fit Checks.
      trending: {
        windowDays: row.fitCheckTrendingWindowDays,
        limit: row.fitCheckTrendingLimit,
      },
    },
    // Payment Platform Redesign, Phase 4 — how long an unpaid order stays
    // recoverable before lib/expireStaleOrders.js's hourly sweep marks it
    // Expired. Its own top-level group, not nested under fitCheck's
    // sibling groups — a different domain entirely.
    payment: {
      orderExpirationEnabled: row.orderExpirationEnabled,
      orderRetentionHours: row.orderRetentionHours,
      // Which paymentService.js GATEWAYS entry new orders are created
      // against — see the schema comment on this column.
      defaultPaymentGateway: row.defaultPaymentGateway,
    },
    updatedBy: row.updatedByUser
      ? { firstName: row.updatedByUser.firstName, lastName: row.updatedByUser.lastName }
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const WITH_UPDATED_BY = { updatedByUser: { select: { firstName: true, lastName: true } } };

function flattenPartialUpdate(existingNested, { tryOnAd, fitCheck, payment } = {}) {
  // Mirrors the original route's Object.assign(settings.tryOnAd, req.body.tryOnAd)
  // — a partial merge per sub-object, not a wholesale replace, so a caller
  // updating only one field doesn't blow away its siblings.
  const merged = {
    tryOnAd: { ...existingNested.tryOnAd, ...tryOnAd },
    fitCheck: {
      ...existingNested.fitCheck,
      ...fitCheck,
      bonus: { ...existingNested.fitCheck.bonus, ...fitCheck?.bonus },
      trending: { ...existingNested.fitCheck.trending, ...fitCheck?.trending },
    },
    payment: { ...existingNested.payment, ...payment },
  };
  return {
    tryOnAdVideoUrl: merged.tryOnAd.videoUrl,
    tryOnAdButtonText: merged.tryOnAd.buttonText,
    tryOnAdButtonUrl: merged.tryOnAd.buttonUrl,
    fitCheckDailyLimitGuest: merged.fitCheck.dailyLimitGuest,
    fitCheckDailyLimitRegistered: merged.fitCheck.dailyLimitRegistered,
    fitCheckDailyLimitPremium: merged.fitCheck.dailyLimitPremium,
    fitCheckGuestRetentionHours: merged.fitCheck.guestRetentionHours,
    fitCheckBonusEnabled: merged.fitCheck.bonus.enabled,
    fitCheckBonusProfileComplete: merged.fitCheck.bonus.profileComplete,
    fitCheckBonusEmailVerified: merged.fitCheck.bonus.emailVerified,
    fitCheckBonusFirstPurchase: merged.fitCheck.bonus.firstPurchase,
    fitCheckTrendingWindowDays: merged.fitCheck.trending.windowDays,
    fitCheckTrendingLimit: merged.fitCheck.trending.limit,
    orderExpirationEnabled: merged.payment.orderExpirationEnabled,
    orderRetentionHours: merged.payment.orderRetentionHours,
    defaultPaymentGateway: merged.payment.defaultPaymentGateway,
  };
}

/** Matches siteSettingsSchema.statics.get() — find the first row, creating it with defaults if none exists. */
export async function get({ client = prisma } = {}) {
  let settings = await client.siteSettings.findFirst({ include: WITH_UPDATED_BY });
  if (!settings) {
    settings = await client.siteSettings.create({ data: {}, include: WITH_UPDATED_BY });
  }
  return toNestedShape(settings);
}

/** Accepts the same { tryOnAd, fitCheck, payment } partial shape the route already receives, plus who made the change. */
export async function update(partialNested, { updatedByUserId, client = prisma } = {}) {
  const existing = await get({ client });
  const flatData = flattenPartialUpdate(existing, partialNested);
  const updated = await client.siteSettings.update({
    where: { id: existing._id },
    data: { ...flatData, ...(updatedByUserId !== undefined && { updatedByUserId }) },
    include: WITH_UPDATED_BY,
  });
  return toNestedShape(updated);
}

export default { get, update };
