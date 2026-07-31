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
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function flattenPartialUpdate(existingNested, { tryOn, tryOnAd } = {}) {
  // Mirrors the original route's Object.assign(settings.tryOn, req.body.tryOn)
  // — a partial merge per sub-object, not a wholesale replace, so a caller
  // updating only `tryOn.title` doesn't blow away `tryOn.image`.
  const merged = {
    tryOn: { ...existingNested.tryOn, ...tryOn },
    tryOnAd: { ...existingNested.tryOnAd, ...tryOnAd },
  };
  return {
    tryOnTitle: merged.tryOn.title,
    tryOnImage: merged.tryOn.image,
    tryOnProductUrl: merged.tryOn.productUrl,
    tryOnAdVideoUrl: merged.tryOnAd.videoUrl,
    tryOnAdButtonText: merged.tryOnAd.buttonText,
    tryOnAdButtonUrl: merged.tryOnAd.buttonUrl,
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
