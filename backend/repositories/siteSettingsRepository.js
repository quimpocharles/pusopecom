import prisma from '../lib/prisma.js';

/**
 * SiteSettings.tryOn / .tryOnAd were nested Mongoose subdocuments; the
 * Prisma schema flattens them to plain columns (tryOnTitle, tryOnImage,
 * etc. — see the schema comment on SiteSettings). Flattening was the right
 * call for the database, but the API contract must not change: every
 * existing caller (AdminSettings.jsx, Home.jsx's tryOnSettings.productUrl)
 * expects the original nested shape. This module is the one place that
 * reshapes flat columns back into { tryOn: {...}, tryOnAd: {...} } on the
 * way out, and flattens the same nested shape back down on the way in —
 * routes/settings.js should never need to know the database is flat.
 */
function toNestedShape(row) {
  if (!row) return row;
  return {
    _id: row.id,
    tryOn: {
      title: row.tryOnTitle,
      image: row.tryOnImage,
      productUrl: row.tryOnProductUrl,
    },
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
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function flattenPartialUpdate(existingNested, { tryOn, tryOnAd, fitCheck, payment } = {}) {
  // Mirrors the original route's Object.assign(settings.tryOn, req.body.tryOn)
  // — a partial merge per sub-object, not a wholesale replace, so a caller
  // updating only `tryOn.title` doesn't blow away `tryOn.image`.
  const merged = {
    tryOn: { ...existingNested.tryOn, ...tryOn },
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
    tryOnTitle: merged.tryOn.title,
    tryOnImage: merged.tryOn.image,
    tryOnProductUrl: merged.tryOn.productUrl,
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
  };
}

/** Matches siteSettingsSchema.statics.get() — find the first row, creating it with defaults if none exists. */
export async function get({ client = prisma } = {}) {
  let settings = await client.siteSettings.findFirst();
  if (!settings) {
    settings = await client.siteSettings.create({ data: {} });
  }
  return toNestedShape(settings);
}

/** Accepts the same { tryOn, tryOnAd } partial shape the route already receives. */
export async function update(partialNested, { client = prisma } = {}) {
  const existing = await get({ client });
  const flatData = flattenPartialUpdate(existing, partialNested);
  const updated = await client.siteSettings.update({ where: { id: existing._id }, data: flatData });
  return toNestedShape(updated);
}

export default { get, update };
