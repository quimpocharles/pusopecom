import * as tryOnLogRepository from '../../repositories/tryOnLogRepository.js';
import * as fitCheckCampaignRepository from '../../repositories/fitCheckCampaignRepository.js';
import { getDateFilter, getGranularity, dateKey, groupBy, sortByDateKey } from '../../lib/reportQueryHelpers.js';

/**
 * Campaigns whose own [startDate, endDate] window overlaps the report's
 * date range — an unbounded report edge (no startDate/endDate given, i.e.
 * "All Time") overlaps everything, matching how getDateFilter itself
 * treats a missing bound as no constraint rather than "match nothing".
 */
async function findCampaignsOverlappingRange(query) {
  const startDate = query.startDate ? new Date(query.startDate) : null;
  const endDate = query.endDate ? new Date(`${query.endDate}T23:59:59.999Z`) : null;

  const clauses = [];
  if (startDate) clauses.push({ OR: [{ endDate: null }, { endDate: { gte: startDate } }] });
  if (endDate) clauses.push({ OR: [{ startDate: null }, { startDate: { lte: endDate } }] });

  return fitCheckCampaignRepository.find({
    where: clauses.length > 0 ? { AND: clauses } : {},
    orderBy: { priority: 'desc' },
  });
}

export async function computeFitCheckAnalyticsReport(query) {
  const dateFilter = getDateFilter(query);
  const granularity = getGranularity(query.startDate, query.endDate);

  // subscriptionTier resolves #2/#3 (guest vs registered vs premium) below;
  // email powers the same full per-attempt log table computeTryOnReport
  // already built this session — a guest attempt has no `user` row at all
  // (userId is null), so both fields naturally fall through to undefined.
  const logs = await tryOnLogRepository.find({
    where: { ...dateFilter },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { email: true, subscriptionTier: true } } },
  });

  // 1. Daily Fit Checks
  const tryOnOverTime = [...groupBy(logs, (l) => dateKey(l.createdAt, granularity))]
    .map(([date, ls]) => ({ date, count: ls.length }))
    .sort(sortByDateKey);

  // 2. Guest vs Registered (+ 3. Premium, a sub-split of Registered)
  const guestCount = logs.filter((l) => !l.userId).length;
  const registeredCount = logs.filter((l) => l.userId && l.user?.subscriptionTier === 'registered').length;
  const premiumCount = logs.filter((l) => l.userId && l.user?.subscriptionTier === 'premium').length;

  // 4. Success rate / 5. Failure rate
  const totalAttempts = logs.length;
  const successfulAttempts = logs.filter((l) => l.success === true).length;
  const successRate = totalAttempts > 0 ? Math.round((successfulAttempts / totalAttempts) * 10000) / 100 : 0;
  const failureRate = totalAttempts > 0 ? Math.round((100 - successRate) * 100) / 100 : 0;

  // 6. Average generation time — overall, unlike computeTryOnReport's
  // byProvider-only average, across every non-null durationMs regardless
  // of which provider served it.
  const withDuration = logs.filter((l) => l.durationMs != null);
  const avgDurationMs = withDuration.length > 0
    ? Math.round(withDuration.reduce((s, l) => s + l.durationMs, 0) / withDuration.length)
    : null;

  // 7. Average AI cost — per-provider and overall, excluding nulls from
  // the denominator rather than treating an unverified price as $0. Every
  // Replicate row is null (no verified Replicate pricing exists — checked
  // account/billing, model, and versions endpoints directly, confirmed
  // this session across nano-banana/-2/-2-lite) — those rows are excluded,
  // not zeroed, from both the per-provider and overall averages.
  const byProviderCost = [...groupBy(logs, (l) => l.provider ?? 'unknown').entries()]
    .map(([provider, ls]) => {
      const withCost = ls.filter((l) => l.costUsd != null);
      return {
        provider,
        attempts: ls.length,
        avgCostUsd: withCost.length > 0
          ? Math.round((withCost.reduce((s, l) => s + l.costUsd, 0) / withCost.length) * 10000) / 10000
          : null,
        costSampleSize: withCost.length,
      };
    })
    .sort((a, b) => b.attempts - a.attempts);

  const overallWithCost = logs.filter((l) => l.costUsd != null);
  const overallAvgCostUsd = overallWithCost.length > 0
    ? Math.round((overallWithCost.reduce((s, l) => s + l.costUsd, 0) / overallWithCost.length) * 10000) / 10000
    : null;

  // 8. Most tried products
  const mostTriedProducts = [...groupBy(logs, (l) => l.product ?? 'unresolved').values()]
    .map((ls) => ({ productName: ls[0].productName, productImage: ls[0].productImage, count: ls.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Full per-attempt log — same shape/purpose as computeTryOnReport's own
  // tryOnLog (email/"Guest", product, success, date), reproduced here
  // rather than re-fetched from that endpoint so this workspace is a
  // single self-sufficient call, not two. Never sliced here — the /fit-check
  // route paginates it for the live table, same convention as /tryon.
  const tryOnLog = logs.map((l) => ({
    productName: l.productName,
    productImage: l.productImage,
    success: l.success,
    createdAt: l.createdAt,
    email: l.user?.email || 'Guest',
    provider: l.provider,
    aiModel: l.aiModel,
  }));

  // 9. Conversion after Fit Check / 10. Revenue attributed — the real
  // tried→purchased correlation already built for the internal daily
  // report; exposed here as an ad-hoc-date-range admin report for the
  // first time.
  const conversion = await tryOnLogRepository.platformConversionStats({
    since: dateFilter.createdAt?.gte,
    until: dateFilter.createdAt?.lte,
  });

  // 11. Sponsored campaign performance — each overlapping campaign's own
  // all-time analytics (the underlying function has no date-range params;
  // a campaign's lifetime performance is the more useful number than an
  // arbitrary admin-range slice of it).
  const overlappingCampaigns = await findCampaignsOverlappingRange(query);
  const campaignPerformance = await Promise.all(
    overlappingCampaigns.map(async (c) => ({
      id: c._id,
      name: c.name,
      sponsorName: c.sponsorName,
      ...(await fitCheckCampaignRepository.analytics(c._id)),
    }))
  );

  return {
    tryOnOverTime,
    usageBreakdown: { guest: guestCount, registered: registeredCount, premium: premiumCount },
    totalAttempts,
    successfulAttempts,
    successRate,
    failureRate,
    avgDurationMs,
    byProviderCost,
    overallAvgCostUsd,
    mostTriedProducts,
    conversion,
    campaignPerformance,
    tryOnLog,
  };
}

export function fitCheckAnalyticsReportToExportShape(data) {
  return {
    summary: [
      ['Total Attempts', data.totalAttempts],
      ['Success Rate', `${data.successRate}%`],
      ['Failure Rate', `${data.failureRate}%`],
      ['Avg Generation Time (ms)', data.avgDurationMs ?? 'N/A'],
      ['Avg AI Cost (USD)', data.overallAvgCostUsd ?? 'N/A — no verified pricing for all providers'],
      ['Guest Attempts', data.usageBreakdown.guest],
      ['Registered Attempts', data.usageBreakdown.registered],
      ['Premium Attempts', data.usageBreakdown.premium],
      ['Tried → Purchased Conversion', `${Math.round((data.conversion.conversionRate || 0) * 10000) / 100}%`],
      ['Revenue Attributed', data.conversion.revenue],
    ],
    sheets: [
      {
        name: 'Fit Checks Over Time',
        columns: [{ header: 'Date', key: 'date' }, { header: 'Attempts', key: 'count' }],
        rows: data.tryOnOverTime,
        totals: { count: true },
      },
      {
        name: 'Cost & Duration by Provider',
        columns: [
          { header: 'Provider', key: 'provider' }, { header: 'Attempts', key: 'attempts' },
          { header: 'Avg Cost (USD)', key: 'avgCostUsd' }, { header: 'Priced Attempts', key: 'costSampleSize' },
        ],
        rows: data.byProviderCost,
        totals: { attempts: true },
      },
      {
        name: 'Most Tried Products',
        columns: [{ header: 'Product', key: 'productName' }, { header: 'Attempts', key: 'count' }],
        rows: data.mostTriedProducts,
        totals: { count: true },
      },
      {
        name: 'Sponsored Campaign Performance',
        columns: [
          { header: 'Campaign', key: 'name' }, { header: 'Sponsor', key: 'sponsorName' },
          { header: 'Views', key: 'views' }, { header: 'Generations', key: 'generations' },
          { header: 'Unique Fans', key: 'uniqueFans' }, { header: 'Purchases', key: 'purchases' }, { header: 'Revenue', key: 'revenue' },
        ],
        rows: data.campaignPerformance,
        totals: { generations: true, purchases: true, revenue: true },
      },
      {
        name: 'Fit Check Log',
        columns: [
          { header: 'Date', key: 'createdAt' }, { header: 'Email', key: 'email' },
          { header: 'Product', key: 'productName' }, { header: 'Success', key: 'success' },
        ],
        rows: data.tryOnLog,
      },
    ],
  };
}
