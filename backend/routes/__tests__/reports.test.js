import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => { req.user = { _id: 'test-admin', role: 'admin' }; next(); },
  isAdmin: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
}));

const { default: reportsRouter } = await import('../reports.js');

const app = express();
app.use(express.json());
app.use('/api/reports', reportsRouter);

const MARKER = `ReportsTest${Date.now()}`;
const createdProductIds = [];
const createdOrderIds = [];
const createdUserIds = [];

// A wide window guaranteed to contain every fixture created below, without
// pulling in the platform's real historical order data by leaving the
// range unbounded.
const startDate = '2020-01-01';
const endDate = '2035-01-01';
const rangeQS = `startDate=${startDate}&endDate=${endDate}`;

let productWithLeague, productPlain;

beforeAll(async () => {
  productWithLeague = await prisma.product.create({
    data: {
      name: `${MARKER} Jersey`, slug: `reports-test-${Date.now()}-1`, description: 'x',
      price: 500, category: 'jersey', sport: 'basketball', league: `${MARKER}League`, team: `${MARKER}Team`,
      images: [], active: true, totalStock: 0,
    },
  });
  productPlain = await prisma.product.create({
    data: {
      name: `${MARKER} Tee`, slug: `reports-test-${Date.now()}-2`, description: 'x',
      price: 300, category: 'tshirt', sport: 'volleyball', images: [], active: true, totalStock: 3,
    },
  });
  createdProductIds.push(productWithLeague.id, productPlain.id);

  await prisma.user.upsert({
    where: { id: 'reports-test-user' },
    create: { id: 'reports-test-user', email: `${MARKER}-owner@test.local`, firstName: 'Report', lastName: 'Owner' },
    update: {},
  });
  createdUserIds.push('reports-test-user');

  const premiumUser = await prisma.user.create({
    data: { email: `${MARKER}-premium@test.local`, firstName: 'Premium', lastName: 'Fan', subscriptionTier: 'premium' },
  });
  createdUserIds.push(premiumUser.id);

  const shippingAddress = {
    fullName: 'Report Owner', phone: '09170000000', address: '1 Report St',
    city: `${MARKER}City`, province: `${MARKER}Province`, zipCode: '1000',
  };

  const paidLoggedIn = await prisma.order.create({
    data: {
      orderNumber: `${MARKER}-PAID-USER`, userId: 'reports-test-user', email: `${MARKER}-owner@test.local`,
      shipToFullName: shippingAddress.fullName, shipToPhone: shippingAddress.phone,
      shipToAddress: shippingAddress.address, shipToCity: shippingAddress.city,
      shipToProvince: shippingAddress.province, shipToZipCode: shippingAddress.zipCode,
      subtotal: 1000, shippingFee: 0, total: 1000, paymentStatus: 'paid', orderStatus: 'confirmed',
      items: { create: [{ productId: productWithLeague.id, name: productWithLeague.name, price: 500, quantity: 2, size: 'M', image: 'x.jpg' }] },
    },
  });

  const paidGuest = await prisma.order.create({
    data: {
      orderNumber: `${MARKER}-PAID-GUEST`, email: `${MARKER}-guest@test.local`,
      shipToFullName: shippingAddress.fullName, shipToPhone: shippingAddress.phone,
      shipToAddress: shippingAddress.address, shipToCity: shippingAddress.city,
      shipToProvince: shippingAddress.province, shipToZipCode: shippingAddress.zipCode,
      subtotal: 300, shippingFee: 0, total: 300, paymentStatus: 'paid', orderStatus: 'delivered',
      items: { create: [{ productId: productPlain.id, name: productPlain.name, price: 300, quantity: 1, size: 'M', image: 'x.jpg' }] },
    },
  });

  const pendingOrder = await prisma.order.create({
    data: {
      orderNumber: `${MARKER}-PENDING`, email: `${MARKER}-guest2@test.local`,
      shipToFullName: shippingAddress.fullName, shipToPhone: shippingAddress.phone,
      shipToAddress: shippingAddress.address, shipToCity: shippingAddress.city,
      shipToProvince: shippingAddress.province, shipToZipCode: shippingAddress.zipCode,
      subtotal: 500, shippingFee: 0, total: 500, paymentStatus: 'pending', orderStatus: 'processing',
      items: { create: [{ productId: productWithLeague.id, name: productWithLeague.name, price: 500, quantity: 1, size: 'M', image: 'x.jpg' }] },
    },
  });

  const failedOrder = await prisma.order.create({
    data: {
      orderNumber: `${MARKER}-FAILED`, email: `${MARKER}-guest3@test.local`,
      shipToFullName: shippingAddress.fullName, shipToPhone: shippingAddress.phone,
      shipToAddress: shippingAddress.address, shipToCity: shippingAddress.city,
      shipToProvince: shippingAddress.province, shipToZipCode: shippingAddress.zipCode,
      subtotal: 999, shippingFee: 0, total: 999, paymentStatus: 'failed', orderStatus: 'cancelled',
      items: { create: [{ productId: productPlain.id, name: productPlain.name, price: 999, quantity: 1, size: 'M', image: 'x.jpg' }] },
    },
  });
  createdOrderIds.push(paidLoggedIn.id, paidGuest.id, pendingOrder.id, failedOrder.id);

  await prisma.tryOnLog.create({
    data: {
      productId: productWithLeague.id, productName: productWithLeague.name, productImage: 'x.jpg',
      success: true, provider: `${MARKER}-providerA`, durationMs: 3000,
    },
  });
  await prisma.tryOnLog.create({
    data: {
      productName: `${MARKER} Unresolved`, productImage: 'x.jpg',
      success: false, provider: `${MARKER}-providerA`, durationMs: 5000,
    },
  });
  await prisma.tryOnLog.create({
    data: {
      productId: productWithLeague.id, productName: productWithLeague.name, productImage: 'x.jpg',
      success: true, provider: `${MARKER}-providerB`, durationMs: 40000,
    },
  });
  await prisma.tryOnLog.create({
    data: {
      productId: productPlain.id, productName: productPlain.name, productImage: 'x.jpg',
      success: true, provider: `${MARKER}-providerB`, durationMs: 6000, userId: 'reports-test-user',
    },
  });

  // Fit Check Analytics fixtures — a premium attempt with a real, verified
  // cost, and a guest attempt with no cost (mirrors a real Replicate row,
  // where no verified pricing exists) — both under a dedicated provider
  // name so cost-average assertions are immune to the providerA/providerB
  // rows above.
  await prisma.tryOnLog.create({
    data: {
      productName: `${MARKER} CostTest`, productImage: 'x.jpg',
      success: true, provider: `${MARKER}-costProvider`, costUsd: 0.08, userId: premiumUser.id,
    },
  });
  await prisma.tryOnLog.create({
    data: {
      productName: `${MARKER} CostTest`, productImage: 'x.jpg',
      success: true, provider: `${MARKER}-costProvider`, costUsd: null, sessionId: 'test-guest-session',
    },
  });

  await prisma.shippingEvent.create({
    data: { orderId: paidLoggedIn.orderNumber, shippingMethod: `${MARKER}Method`, orderTotal: 1000, region: `${MARKER}Region` },
  });
}, 30000);

afterAll(async () => {
  await prisma.tryOnLog.deleteMany({ where: { OR: [{ productId: { in: createdProductIds } }, { productName: { startsWith: MARKER } }] } });
  await prisma.shippingEvent.deleteMany({ where: { shippingMethod: `${MARKER}Method` } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
  await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.reportRecipient.deleteMany({ where: { email: { contains: MARKER, mode: 'insensitive' } } });
  await prisma.$disconnect();
});

describe('GET /reports/sales', () => {
  it('aggregates revenue/units by category and sport from paid orders only', async () => {
    const res = await request(app).get(`/api/reports/sales?${rangeQS}`);
    expect(res.status).toBe(200);

    const jerseyCategory = res.body.data.salesByCategory.find((c) => c.category === 'jersey');
    expect(jerseyCategory.units).toBeGreaterThanOrEqual(2);
    expect(jerseyCategory.revenue).toBeGreaterThanOrEqual(1000);

    const basketballSport = res.body.data.salesBySport.find((s) => s.sport === 'basketball');
    expect(basketballSport.units).toBeGreaterThanOrEqual(2);

    expect(res.body.data.totalRevenue).toBeGreaterThanOrEqual(1300); // 1000 + 300 paid, not the 500 pending or 999 failed
  }, 15000);
});

describe('GET /reports/executive', () => {
  it('composes KPIs from the same totals computeSalesReport itself returns for the identical range', async () => {
    const [executiveRes, salesRes] = await Promise.all([
      request(app).get(`/api/reports/executive?${rangeQS}`),
      request(app).get(`/api/reports/sales?${rangeQS}`),
    ]);
    expect(executiveRes.status).toBe(200);

    // Composition correctness: Executive must never recompute its own,
    // possibly-diverging version of these totals.
    expect(executiveRes.body.data.kpis.totalRevenue).toBe(salesRes.body.data.totalRevenue);
    expect(executiveRes.body.data.kpis.totalOrders).toBe(salesRes.body.data.totalOrders);
    expect(executiveRes.body.data.kpis.averageOrderValue).toBe(salesRes.body.data.averageOrderValue);
  }, 15000);

  it('computes a period-over-period delta against an equal-length prior window, never NaN', async () => {
    const res = await request(app).get(`/api/reports/executive?${rangeQS}`);
    expect(res.status).toBe(200);

    const { delta } = res.body.data.kpis;
    expect(typeof delta.revenue).toBe('number');
    expect(Number.isNaN(delta.revenue)).toBe(false);
    // This fixture range has real paid revenue; a same-or-earlier fabricated
    // range (2020-01-01 back) has none — a strictly earlier window with zero
    // revenue means the delta is a real percentage increase, not undefined
    // or negative-infinity from a divide-by-zero.
    expect(delta.revenue).toBeGreaterThanOrEqual(0);
  }, 15000);

  it('flags the fixture out-of-stock and low-stock products in the alerts feed', async () => {
    const res = await request(app).get(`/api/reports/executive?${rangeQS}`);
    expect(res.status).toBe(200);

    const alerts = res.body.data.alerts;
    expect(alerts.some((a) => a.severity === 'critical' && /out of stock/.test(a.message))).toBe(true);
    expect(alerts.some((a) => a.severity === 'warning' && /low on stock/.test(a.message))).toBe(true);

    // Critical alerts must sort before every warning, not just be present —
    // once the list touches a 'warning', nothing after it may be 'critical'.
    const severities = alerts.map((a) => a.severity);
    const firstWarningIndex = severities.indexOf('warning');
    if (firstWarningIndex !== -1) {
      expect(severities.slice(firstWarningIndex)).not.toContain('critical');
    }
  }, 15000);

  it('returns a non-empty, deterministic executive summary referencing the real revenue figure', async () => {
    const res = await request(app).get(`/api/reports/executive?${rangeQS}`);
    expect(res.status).toBe(200);

    const summary = res.body.data.executiveSummary;
    expect(Array.isArray(summary)).toBe(true);
    expect(summary.length).toBeGreaterThan(0);
    expect(summary[0]).toContain('Revenue was');
  }, 15000);

  it('exports the same composed data as CSV/Excel via the shared sendReportExport contract', async () => {
    const res = await request(app).get(`/api/reports/executive/export?${rangeQS}&format=xlsx`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
  }, 15000);
});

describe('GET /reports/products', () => {
  it('ranks best sellers, groups by league/team, and reports stock levels', async () => {
    const res = await request(app).get(`/api/reports/products?${rangeQS}`);
    expect(res.status).toBe(200);

    expect(res.body.data.bestSellers.some((p) => p.name === productWithLeague.name && p.units >= 2)).toBe(true);

    const league = res.body.data.salesByLeague.find((l) => l.league === `${MARKER}League`);
    expect(league.units).toBeGreaterThanOrEqual(2);
    const team = res.body.data.salesByTeam.find((t) => t.team === `${MARKER}Team`);
    expect(team.units).toBeGreaterThanOrEqual(2);

    expect(res.body.data.stockLevels).toHaveProperty('outOfStock');
    expect(res.body.data.lowStockProducts.some((p) => p._id === productWithLeague.id)).toBe(true); // totalStock: 0
  }, 15000);
});

describe('GET /reports/orders', () => {
  it('breaks down status/payment counts and computes failed-payment totals across all orders, not just paid', async () => {
    const res = await request(app).get(`/api/reports/orders?${rangeQS}`);
    expect(res.status).toBe(200);

    const paidCount = res.body.data.paymentBreakdown.find((p) => p.status === 'paid');
    expect(paidCount.count).toBeGreaterThanOrEqual(2);
    const failedCount = res.body.data.paymentBreakdown.find((p) => p.status === 'failed');
    expect(failedCount.count).toBeGreaterThanOrEqual(1);

    expect(res.body.data.failedPayments.count).toBeGreaterThanOrEqual(1);
    expect(res.body.data.failedPayments.totalValue).toBeGreaterThanOrEqual(999);
  }, 15000);
});

describe('GET /reports/customers', () => {
  it('resolves a logged-in top customer\'s name, and falls back to email for a guest', async () => {
    const res = await request(app).get(`/api/reports/customers?${rangeQS}`);
    expect(res.status).toBe(200);

    const named = res.body.data.topCustomers.find((c) => c.email === `${MARKER}-owner@test.local`);
    expect(named.name).toBe('Report Owner');
    expect(named.totalSpent).toBeGreaterThanOrEqual(1000);

    const guest = res.body.data.topCustomers.find((c) => c.email === `${MARKER}-guest@test.local`);
    expect(guest.name).toBe(`${MARKER}-guest@test.local`); // no user record — falls back to email

    const province = res.body.data.geographicDistribution.find((p) => p.province === `${MARKER}Province`);
    expect(province.orders).toBeGreaterThanOrEqual(2);
  }, 15000);
});

describe('GET /reports/tryon', () => {
  it('computes success rate and the most-tried products list', async () => {
    const res = await request(app).get(`/api/reports/tryon?${rangeQS}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totalAttempts).toBeGreaterThanOrEqual(3);
    expect(res.body.data.successfulAttempts).toBeGreaterThanOrEqual(2);
    expect(res.body.data.mostTriedProducts.some((p) => p.productName === productWithLeague.name)).toBe(true);
  }, 15000);

  it('breaks down attempts by provider with average duration and per-provider success rate', async () => {
    const res = await request(app).get(`/api/reports/tryon?${rangeQS}`);
    expect(res.status).toBe(200);

    // Provider labels are MARKER-scoped (not real WaveSpeed model names) so
    // this test can assert exact counts/averages, immune to any other test
    // file's fixtures or real production try-on rows sharing the range.
    const providerA = res.body.data.byProvider.find((p) => p.provider === `${MARKER}-providerA`);
    expect(providerA.attempts).toBe(2);
    expect(providerA.avgDurationMs).toBe(4000); // (3000 + 5000) / 2
    expect(providerA.successRate).toBe(50); // one success, one failure in the fixture

    const providerB = res.body.data.byProvider.find((p) => p.provider === `${MARKER}-providerB`);
    expect(providerB.attempts).toBe(2);
    expect(providerB.avgDurationMs).toBe(23000); // (40000 + 6000) / 2
    expect(providerB.successRate).toBe(100);
  }, 15000);

  it('resolves the real email for a logged-in attempt and labels a guest attempt "Guest"', async () => {
    const res = await request(app).get(`/api/reports/tryon?${rangeQS}`);
    expect(res.status).toBe(200);

    const ownerRow = res.body.data.tryOnLog.find((r) => r.productName === productPlain.name && r.email !== 'Guest');
    expect(ownerRow.email).toBe(`${MARKER}-owner@test.local`);

    const guestRow = res.body.data.tryOnLog.find((r) => r.productName === `${MARKER} Unresolved`);
    expect(guestRow.email).toBe('Guest');
  }, 15000);

  it('paginates the full log without truncating the aggregate totals above it', async () => {
    const fullPage = await request(app).get(`/api/reports/tryon?${rangeQS}&pageSize=100`);
    expect(fullPage.body.data.tryOnLogTotal).toBeGreaterThanOrEqual(4); // at least this fixture's 4 rows
    expect(fullPage.body.data.tryOnLog.length).toBe(fullPage.body.data.tryOnLogTotal);

    const onePerPage = await request(app).get(`/api/reports/tryon?${rangeQS}&page=1&pageSize=1`);
    expect(onePerPage.body.data.tryOnLog.length).toBe(1);
    expect(onePerPage.body.data.page).toBe(1);
    expect(onePerPage.body.data.pageSize).toBe(1);
    // Pagination narrows the log table only — the totals computed over the
    // whole date range must stay identical to the unpaginated request.
    expect(onePerPage.body.data.totalAttempts).toBe(fullPage.body.data.totalAttempts);
    expect(onePerPage.body.data.tryOnLogTotal).toBe(fullPage.body.data.tryOnLogTotal);
  }, 15000);
});

describe('GET /reports/fit-check', () => {
  it('buckets guest vs registered vs premium usage, including at least the fixture premium/guest rows', async () => {
    const res = await request(app).get(`/api/reports/fit-check?${rangeQS}`);
    expect(res.status).toBe(200);
    expect(res.body.data.usageBreakdown.premium).toBeGreaterThanOrEqual(1);
    expect(res.body.data.usageBreakdown.guest).toBeGreaterThanOrEqual(1);
    expect(res.body.data.usageBreakdown.registered).toBeGreaterThanOrEqual(1);
  }, 15000);

  it('averages AI cost per provider excluding null (unverified) costs from the denominator, never treating them as $0', async () => {
    const res = await request(app).get(`/api/reports/fit-check?${rangeQS}`);
    expect(res.status).toBe(200);

    const costProvider = res.body.data.byProviderCost.find((p) => p.provider === `${MARKER}-costProvider`);
    expect(costProvider.attempts).toBe(2); // one priced (0.08), one null
    expect(costProvider.costSampleSize).toBe(1); // only the priced one counts toward the average
    expect(costProvider.avgCostUsd).toBeCloseTo(0.08); // NOT (0.08 + 0) / 2 = 0.04

    expect(typeof res.body.data.overallAvgCostUsd === 'number' || res.body.data.overallAvgCostUsd === null).toBe(true);
    expect(Number.isNaN(res.body.data.overallAvgCostUsd)).toBe(false);
  }, 15000);

  it('computes success and failure rate summing to 100, and an overall avg generation time across all providers', async () => {
    const res = await request(app).get(`/api/reports/fit-check?${rangeQS}`);
    expect(res.status).toBe(200);
    expect(Math.round((res.body.data.successRate + res.body.data.failureRate) * 100) / 100).toBe(100);
    // Overall, unlike computeTryOnReport's byProvider-only average — must
    // be present whenever any row has a non-null durationMs.
    expect(res.body.data.avgDurationMs).not.toBeNull();
  }, 15000);

  it('returns conversion/revenue attribution and a campaign performance array (empty is valid, never missing)', async () => {
    const res = await request(app).get(`/api/reports/fit-check?${rangeQS}`);
    expect(res.status).toBe(200);
    expect(res.body.data.conversion).toHaveProperty('conversionRate');
    expect(res.body.data.conversion).toHaveProperty('revenue');
    expect(Array.isArray(res.body.data.campaignPerformance)).toBe(true);
  }, 15000);

  it('paginates its own full log independently of GET /reports/tryon', async () => {
    const res = await request(app).get(`/api/reports/fit-check?${rangeQS}&page=1&pageSize=1`);
    expect(res.status).toBe(200);
    expect(res.body.data.tryOnLog.length).toBe(1);
    expect(res.body.data.tryOnLogTotal).toBeGreaterThanOrEqual(6); // 4 original + 2 cost fixtures
  }, 15000);

  it('exports via the shared CSV/Excel contract', async () => {
    const res = await request(app).get(`/api/reports/fit-check/export?${rangeQS}&format=xlsx`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
  }, 15000);
});

describe('GET /reports/shipping', () => {
  it('groups shipping events by method+region', async () => {
    const res = await request(app).get(`/api/reports/shipping?${rangeQS}`);
    expect(res.status).toBe(200);
    const entry = res.body.data.methodBreakdown.find((m) => m._id.method === `${MARKER}Method`);
    expect(entry.count).toBe(1);
    expect(entry.totalRevenue).toBe(1000);
    expect(res.body.data.rawEvents.some((e) => e.shippingMethod === `${MARKER}Method`)).toBe(true);
  }, 15000);
});

describe('GET /reports/checkout-recovery (Payment Platform Redesign, Phase 7)', () => {
  const orderIds = [];
  const shippingAddress = {
    fullName: 'Recovery Test', phone: '09170000001', address: '1 Recovery St',
    city: `${MARKER}City`, province: `${MARKER}Province`, zipCode: '1000',
  };

  async function makeOrder(suffix, overrides = {}) {
    const order = await prisma.order.create({
      data: {
        orderNumber: `${MARKER}-RECOVERY-${suffix}`, email: `${MARKER}-recovery-${suffix}@test.local`,
        shipToFullName: shippingAddress.fullName, shipToPhone: shippingAddress.phone,
        shipToAddress: shippingAddress.address, shipToCity: shippingAddress.city,
        shipToProvince: shippingAddress.province, shipToZipCode: shippingAddress.zipCode,
        subtotal: 800, shippingFee: 0, total: 800,
        ...overrides,
      },
    });
    orderIds.push(order.id);
    return order;
  }

  let recoveredOrder, lostOrder, firstTryOrder;

  beforeAll(async () => {
    // Recovered: first attempt expired, second attempt succeeded.
    recoveredOrder = await makeOrder('RECOVERED', { paymentStatus: 'paid', orderStatus: 'paid' });
    await prisma.payment.create({
      data: { orderId: recoveredOrder.id, provider: 'maya', status: 'expired', createdAt: new Date(Date.now() - 60000) },
    });
    await prisma.payment.create({
      data: { orderId: recoveredOrder.id, provider: 'maya', status: 'succeeded', paidAt: new Date() },
    });

    // Never recovered: two real attempts, both failed, order stays failed.
    lostOrder = await makeOrder('LOST', { paymentStatus: 'failed', orderStatus: 'failed_payment' });
    await prisma.payment.create({ data: { orderId: lostOrder.id, provider: 'maya', status: 'failed' } });
    await prisma.payment.create({ data: { orderId: lostOrder.id, provider: 'maya', status: 'expired' } });

    // Happy path — one attempt, succeeded. Not a "recovery" (no friction).
    firstTryOrder = await makeOrder('FIRSTTRY', { paymentStatus: 'paid', orderStatus: 'paid' });
    await prisma.payment.create({
      data: { orderId: firstTryOrder.id, provider: 'maya', status: 'succeeded', paidAt: new Date() },
    });
  }, 20000);

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  });

  it('counts recovered vs. never-recovered orders, excluding single-attempt successes from "recovered"', async () => {
    const res = await request(app).get(`/api/reports/checkout-recovery?${rangeQS}`);
    expect(res.status).toBe(200);
    expect(res.body.data.recoveredPayments).toBeGreaterThanOrEqual(1);
    expect(res.body.data.neverRecovered).toBeGreaterThanOrEqual(1);
    // revenueRecovered counts the recovered order's total, not the
    // single-attempt firstTryOrder's — both are 'paid', only one recovered.
    expect(res.body.data.revenueRecovered).toBeGreaterThanOrEqual(800);
  }, 15000);

  it('computes provider success rate from resolved Payment attempts', async () => {
    const res = await request(app).get(`/api/reports/checkout-recovery?${rangeQS}`);
    const maya = res.body.data.providerBreakdown.find((p) => p.provider === 'maya');
    expect(maya).toBeTruthy();
    expect(maya.total).toBeGreaterThanOrEqual(5); // 2 + 2 + 1 across the three fixtures
    expect(maya.succeeded).toBeGreaterThanOrEqual(2);
  }, 15000);

  it('counts expired sessions and retry attempts across orders', async () => {
    const res = await request(app).get(`/api/reports/checkout-recovery?${rangeQS}`);
    expect(res.body.data.expiredSessions).toBeGreaterThanOrEqual(2); // 1 from recoveredOrder, 1 from lostOrder
    expect(res.body.data.retryCount).toBeGreaterThanOrEqual(2); // 1 extra attempt each for recoveredOrder + lostOrder
  }, 15000);
});

describe('GET /reports/webhook-health', () => {
  it('reports how many Payments had a webhook processed recently, and when the most recent one landed', async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `${MARKER}-WEBHOOKHEALTH`, email: `${MARKER}-webhook@test.local`,
        shipToFullName: 'Webhook Test', shipToPhone: '09170000002', shipToAddress: '1 St',
        shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
        subtotal: 500, total: 500, paymentStatus: 'paid',
      },
    });
    const payment = await prisma.payment.create({
      data: { orderId: order.id, provider: 'maya', status: 'succeeded', webhookProcessedAt: new Date() },
    });

    try {
      const res = await request(app).get('/api/reports/webhook-health');
      expect(res.status).toBe(200);
      expect(res.body.data.processedLast24h).toBeGreaterThanOrEqual(1);
      expect(res.body.data.lastWebhookAt).not.toBeNull();
    } finally {
      await prisma.payment.delete({ where: { id: payment.id } });
      await prisma.order.delete({ where: { id: order.id } });
    }
  }, 15000);
});

describe('Report recipients admin CRUD', () => {
  it('adds, lists, deactivates, and removes a recipient', async () => {
    const email = `${MARKER}-recipient@test.local`;

    const createRes = await request(app).post('/api/reports/recipients').send({ email });
    expect(createRes.status).toBe(201);
    // normalizeEmail() lowercases, same as the existing orders.js email validator
    expect(createRes.body.data.email).toBe(email.toLowerCase());
    expect(createRes.body.data.active).toBe(true);
    const id = createRes.body.data._id;

    const listRes = await request(app).get('/api/reports/recipients');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((r) => r.email === email.toLowerCase())).toBe(true);

    const patchRes = await request(app).patch(`/api/reports/recipients/${id}`).send({ active: false });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.active).toBe(false);

    const deleteRes = await request(app).delete(`/api/reports/recipients/${id}`);
    expect(deleteRes.status).toBe(200);

    const afterDelete = await prisma.reportRecipient.findUnique({ where: { id } });
    expect(afterDelete).toBeNull();
  }, 15000);

  it('rejects an invalid email and a duplicate email', async () => {
    const email = `${MARKER}-dup@test.local`;

    const invalid = await request(app).post('/api/reports/recipients').send({ email: 'not-an-email' });
    expect(invalid.status).toBe(400);

    const first = await request(app).post('/api/reports/recipients').send({ email });
    expect(first.status).toBe(201);

    const dup = await request(app).post('/api/reports/recipients').send({ email });
    expect(dup.status).toBe(409);
  }, 15000);

  it('404s updating/deleting a non-existent recipient', async () => {
    const patchRes = await request(app).patch('/api/reports/recipients/00000000-0000-0000-0000-000000000000').send({ active: false });
    expect(patchRes.status).toBe(404);

    const deleteRes = await request(app).delete('/api/reports/recipients/00000000-0000-0000-0000-000000000000');
    expect(deleteRes.status).toBe(404);
  });
});

describe('Report exports (CSV + Excel)', () => {
  it('GET /sales/export defaults to CSV with the revenue-over-time sheet as the primary table', async () => {
    const res = await request(app).get(`/api/reports/sales/export?${rangeQS}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/sales-report\.csv/);
    expect(res.text.split('\n')[0]).toBe('Date,Revenue,Orders');
  }, 15000);

  it('GET /sales/export?format=xlsx returns a multi-sheet workbook with a Summary sheet', async () => {
    const res = await request(app).get(`/api/reports/sales/export?${rangeQS}&format=xlsx`).buffer(true).parse((response, cb) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/spreadsheetml/);
    expect(res.headers['content-disposition']).toMatch(/sales-report\.xlsx/);

    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.body);
    const sheetNames = workbook.worksheets.map((ws) => ws.name);
    expect(sheetNames).toEqual(['Summary', 'Revenue Over Time', 'By Category', 'By Sport']);
    expect(workbook.getWorksheet('Revenue Over Time').getRow(1).getCell(1).value).toBe('Date');
  }, 15000);

  // Every report's export endpoint follows the same computeXReport -> sendReportExport
  // wiring — one correctness check above (sales) is enough to prove the pattern;
  // this loop just confirms the other five didn't get miswired (wrong route,
  // missing sheets, format branching broken).
  it.each(['products', 'orders', 'customers', 'tryon', 'shipping', 'checkout-recovery'])('GET /%s/export responds with CSV by default and XLSX on request', async (report) => {
    const csvRes = await request(app).get(`/api/reports/${report}/export?${rangeQS}`);
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers['content-type']).toMatch(/text\/csv/);

    const xlsxRes = await request(app).get(`/api/reports/${report}/export?${rangeQS}&format=xlsx`).buffer(true).parse((response, cb) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(xlsxRes.status).toBe(200);
    expect(xlsxRes.headers['content-type']).toMatch(/spreadsheetml/);
  }, 15000);
});

describe('Report Archive endpoints', () => {
  const createdRunIds = [];

  afterAll(async () => {
    await prisma.reportRun.deleteMany({ where: { id: { in: createdRunIds } } });
  });

  async function makeRun(overrides = {}) {
    const run = await prisma.reportRun.create({
      data: {
        status: 'sent',
        reportDate: new Date('2026-08-01'),
        data: { sales: { grossRevenue: 1000 } },
        recipients: [`${MARKER}-archive@test.local`],
        ...overrides,
      },
    });
    createdRunIds.push(run.id);
    return run;
  }

  it('GET /archive lists runs without the full data blob, GET /archive/:id returns it in full', async () => {
    const run = await makeRun();

    const listRes = await request(app).get('/api/reports/archive');
    expect(listRes.status).toBe(200);
    const row = listRes.body.data.find((r) => r._id === run.id);
    expect(row).toBeTruthy();
    expect(row.hasData).toBe(true);
    expect(row.data).toBeUndefined();

    const detailRes = await request(app).get(`/api/reports/archive/${run.id}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.data).toEqual({ sales: { grossRevenue: 1000 } });
  }, 15000);

  it('GET /archive/:id/download returns an Excel workbook built from the frozen snapshot', async () => {
    const run = await makeRun({
      data: {
        sales: { grossRevenue: 1000, netRevenue: 900, orders: 2, avgOrderValue: 500, shippingRevenue: 100, refundedAmount: 100 },
        products: { topSelling: [{ name: 'Jersey', quantity: 3, revenue: 1000 }] },
        organizations: { byOrganization: [], byLeague: [] },
        customers: { newCustomers: 1, returningCustomers: 0 },
        payments: { successful: 2, failed: 0, pending: 0, refunded: 0, byMethod: [] },
        shipping: { awaitingShipment: 1, inTransit: 0, delivered: 0 },
        tryOn: { sessions: 0, successful: 0, successRate: 0, mostTriedOn: [] },
      },
    });

    const res = await request(app).get(`/api/reports/archive/${run.id}/download?format=xlsx`).buffer(true).parse((response, cb) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/spreadsheetml/);

    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.body);
    expect(workbook.getWorksheet('Top Selling Products').getRow(2).getCell(1).value).toBe('Jersey');
  }, 15000);

  it('GET /archive/:id/download 404s for a skipped run with no data', async () => {
    const run = await makeRun({ status: 'skipped', data: null, recipients: [] });

    const res = await request(app).get(`/api/reports/archive/${run.id}/download`);
    expect(res.status).toBe(404);
  }, 15000);

  it('DELETE /archive/:id removes the run', async () => {
    const run = await makeRun();

    const res = await request(app).delete(`/api/reports/archive/${run.id}`);
    expect(res.status).toBe(200);

    const stillThere = await prisma.reportRun.findUnique({ where: { id: run.id } });
    expect(stillThere).toBeNull();
  }, 15000);

  it('404s for a non-existent run on GET/download/delete', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    expect((await request(app).get(`/api/reports/archive/${fakeId}`)).status).toBe(404);
    expect((await request(app).get(`/api/reports/archive/${fakeId}/download`)).status).toBe(404);
    expect((await request(app).delete(`/api/reports/archive/${fakeId}`)).status).toBe(404);
  });
});

describe('GET/PATCH /schedules', () => {
  afterAll(async () => {
    // These are singleton-per-frequency config rows, not MARKER-scoped
    // fixtures — clean up explicitly so this test never leaves the real
    // schedule toggles in a different state than it found them.
    await prisma.reportSchedule.deleteMany({ where: { frequency: 'weekly' } });
  });

  it('lists all four frequencies, self-healing any missing rows, defaulting to active', async () => {
    const res = await request(app).get('/api/reports/schedules');
    expect(res.status).toBe(200);
    expect(res.body.data.map((s) => s.frequency).sort()).toEqual(['daily', 'monthly', 'quarterly', 'weekly']);
    expect(res.body.data.every((s) => s.active === true)).toBe(true);
  });

  it('PATCH toggles a single frequency without affecting the others', async () => {
    const patchRes = await request(app).patch('/api/reports/schedules/weekly').send({ active: false });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.active).toBe(false);

    const listRes = await request(app).get('/api/reports/schedules');
    const weekly = listRes.body.data.find((s) => s.frequency === 'weekly');
    const daily = listRes.body.data.find((s) => s.frequency === 'daily');
    expect(weekly.active).toBe(false);
    expect(daily.active).toBe(true);
  }, 15000);
});

describe('Dashboard Widgets config + data', () => {
  afterAll(async () => {
    await prisma.dashboardWidget.deleteMany({ where: { key: 'lowStock' } });
  });

  it('GET /dashboard-widgets/config self-heals all seven widget keys, defaulting to active', async () => {
    const res = await request(app).get('/api/reports/dashboard-widgets/config');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(7);
    expect(res.body.data.map((w) => w.key)).toContain('mostTriedOnProducts');
  });

  it('PATCH toggles a single widget', async () => {
    const res = await request(app).patch('/api/reports/dashboard-widgets/config/lowStock').send({ active: false });
    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(false);
  });

  it('GET /dashboard-widgets/data returns computed values for every widget type', async () => {
    const res = await request(app).get('/api/reports/dashboard-widgets/data');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('todaysRevenue');
    expect(res.body.data).toHaveProperty('todaysOrders');
    expect(res.body.data).toHaveProperty('lowStock');
    expect(res.body.data).toHaveProperty('pendingShipments');
    expect(res.body.data).toHaveProperty('failedPayments');
    expect(Array.isArray(res.body.data.mostViewedProducts)).toBe(true);
    expect(Array.isArray(res.body.data.mostTriedOnProducts)).toBe(true);
  }, 15000);

});

// Self-contained fixture set, not the shared top-level one above — the
// Organizations report queries exclusively the new Organization/Team FK
// model, an entirely different domain from the legacy league/team strings
// every other fixture in this file uses.
describe('GET /reports/organizations', () => {
  const orgMarker = `OrgReportTest${Date.now()}`;
  let institution, league, team, orgProduct, orgOrder, followUser;

  beforeAll(async () => {
    institution = await prisma.organization.create({
      data: { name: `${orgMarker} Institution`, slug: `${orgMarker}-institution`, kind: 'institution' },
    });
    league = await prisma.organization.create({
      data: { name: `${orgMarker} League`, slug: `${orgMarker}-league`, kind: 'league' },
    });
    await prisma.organizationParticipation.create({
      data: { memberOrganizationId: institution.id, inOrganizationId: league.id },
    });

    team = await prisma.team.create({
      data: { organizationId: institution.id, name: `${orgMarker} Team`, slug: `${orgMarker}-team`, sport: 'basketball' },
    });

    orgProduct = await prisma.product.create({
      data: {
        name: `${orgMarker} Product`, slug: `${orgMarker}-product`, description: 'x',
        price: 700, category: 'jersey', sport: 'basketball', images: [], active: true,
        organizationId: institution.id, teamId: team.id,
      },
    });

    orgOrder = await prisma.order.create({
      data: {
        orderNumber: `PS-${orgMarker}`, email: `${orgMarker}@test.local`,
        shipToFullName: 'Org Test', shipToPhone: '09171234567', shipToAddress: '1 St',
        shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
        subtotal: 1400, total: 1400, paymentStatus: 'paid', orderStatus: 'delivered',
        items: { create: [{ productId: orgProduct.id, name: orgProduct.name, price: 700, quantity: 2, size: 'M', image: 'x.jpg' }] },
      },
    });

    followUser = await prisma.user.create({
      data: { email: `${orgMarker}-follower@test.local`, firstName: 'Org', lastName: 'Follower' },
    });
    await prisma.follow.create({ data: { userId: followUser.id, organizationId: institution.id } });

    await prisma.tryOnLog.create({
      data: { productId: orgProduct.id, productName: orgProduct.name, productImage: 'x.jpg', success: true },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.tryOnLog.deleteMany({ where: { productId: orgProduct.id } });
    await prisma.follow.deleteMany({ where: { organizationId: institution.id } });
    await prisma.user.delete({ where: { id: followUser.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: orgOrder.id } });
    await prisma.order.delete({ where: { id: orgOrder.id } });
    await prisma.product.delete({ where: { id: orgProduct.id } });
    await prisma.team.delete({ where: { id: team.id } });
    await prisma.organizationParticipation.deleteMany({ where: { memberOrganizationId: institution.id } });
    await prisma.organization.delete({ where: { id: institution.id } });
    await prisma.organization.delete({ where: { id: league.id } });
  });

  it('computes revenue by organization, correctly labeled by kind', async () => {
    const res = await request(app).get('/api/reports/organizations?startDate=2020-01-01&endDate=2035-01-01');
    expect(res.status).toBe(200);

    const row = res.body.data.revenueByOrganization.find((o) => o.organizationId === institution.id);
    expect(row.revenue).toBe(1400); // 700 * 2
    expect(row.units).toBe(2);
    expect(row.kind).toBe('institution');

    expect(res.body.data.topInstitutions.some((o) => o.organizationId === institution.id)).toBe(true);
  }, 15000);

  it('rolls a member institution\'s revenue up to the league it participates in', async () => {
    const res = await request(app).get('/api/reports/organizations?startDate=2020-01-01&endDate=2035-01-01');
    expect(res.status).toBe(200);

    const leagueRow = res.body.data.topLeagues.find((l) => l.organizationId === league.id);
    expect(leagueRow).toBeDefined();
    expect(leagueRow.revenue).toBe(1400); // attributed up from the institution's own revenue
  }, 15000);

  it('groups revenue by the new Team FK, with the owning organization\'s name attached', async () => {
    const res = await request(app).get('/api/reports/organizations?startDate=2020-01-01&endDate=2035-01-01');
    expect(res.status).toBe(200);

    const teamRow = res.body.data.topTeams.find((t) => t.teamId === team.id);
    expect(teamRow.revenue).toBe(1400);
    expect(teamRow.organizationName).toBe(institution.name);
  }, 15000);

  it('counts real followers per organization', async () => {
    const res = await request(app).get('/api/reports/organizations?startDate=2020-01-01&endDate=2035-01-01');
    expect(res.status).toBe(200);

    const followedRow = res.body.data.topFollowed.find((o) => o.organizationId === institution.id);
    expect(followedRow.followers).toBe(1);
  }, 15000);

  it('counts Fit Checks tried on the organization\'s own products', async () => {
    const res = await request(app).get('/api/reports/organizations?startDate=2020-01-01&endDate=2035-01-01');
    expect(res.status).toBe(200);

    const engagementRow = res.body.data.fitCheckEngagement.find((o) => o.organizationId === institution.id);
    expect(engagementRow.attempts).toBe(1);
  }, 15000);

  it('reports migration progress as real counts, not a guessed percentage', async () => {
    const res = await request(app).get('/api/reports/organizations?startDate=2020-01-01&endDate=2035-01-01');
    expect(res.status).toBe(200);

    const { migration } = res.body.data;
    expect(migration.migratedProductCount).toBeGreaterThanOrEqual(1);
    expect(migration.totalProductCount).toBeGreaterThanOrEqual(migration.migratedProductCount);
  }, 15000);

  it('exports via the shared CSV/Excel contract', async () => {
    const res = await request(app).get('/api/reports/organizations/export?startDate=2020-01-01&endDate=2035-01-01&format=xlsx');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
  }, 15000);
});

// Self-contained fixture set — Order/Payment/Refund rows scoped to their
// own marker, not the shared top-level fixtures above.
describe('GET /reports/finance', () => {
  const financeMarker = `FinanceTest${Date.now()}`;
  let order, payment;

  beforeAll(async () => {
    order = await prisma.order.create({
      data: {
        orderNumber: `${financeMarker}-ORDER`, email: `${financeMarker}@test.local`,
        shipToFullName: 'Finance Test', shipToPhone: '09170000003', shipToAddress: '1 St',
        shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
        subtotal: 1000, total: 1000, paymentStatus: 'paid', orderStatus: 'delivered',
      },
    });

    payment = await prisma.payment.create({
      data: { orderId: order.id, provider: `${financeMarker}-provider`, status: 'succeeded', paidAt: new Date() },
    });
    await prisma.payment.create({
      data: { orderId: order.id, provider: `${financeMarker}-provider`, status: 'failed' },
    });

    // Succeeded refund, resolved 5 hours after it was opened — exercises
    // both net revenue and the avg-velocity calculation.
    await prisma.refund.create({
      data: {
        orderId: order.id, paymentId: payment.id, amount: 300, status: 'succeeded',
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
        processedAt: new Date(),
      },
    });
    // Still open — counts toward the live queue, never toward net revenue.
    await prisma.refund.create({ data: { orderId: order.id, amount: 100, status: 'pending' } });
  }, 20000);

  afterAll(async () => {
    await prisma.refund.deleteMany({ where: { orderId: order.id } });
    await prisma.payment.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
  });

  it('computes gross, refunded, and net revenue for the range', async () => {
    const res = await request(app).get(`/api/reports/finance?${rangeQS}`);
    expect(res.status).toBe(200);
    expect(res.body.data.grossRevenue).toBeGreaterThanOrEqual(1000);
    expect(res.body.data.refundedAmount).toBeGreaterThanOrEqual(300);
    expect(res.body.data.netRevenue).toBe(res.body.data.grossRevenue - res.body.data.refundedAmount);
  }, 15000);

  it('counts the live pending refund queue and computes avg velocity from succeeded refunds only', async () => {
    const res = await request(app).get(`/api/reports/finance?${rangeQS}`);
    expect(res.status).toBe(200);
    expect(res.body.data.refundQueueCount).toBeGreaterThanOrEqual(1);
    expect(res.body.data.avgRefundVelocityHours).not.toBeNull();
    expect(res.body.data.avgRefundVelocityHours).toBeGreaterThan(0);
  }, 15000);

  it('computes payment-provider success rate from resolved attempts only, scoped to this fixture\'s own marker-prefixed provider', async () => {
    const res = await request(app).get(`/api/reports/finance?${rangeQS}`);
    expect(res.status).toBe(200);
    const provider = res.body.data.providerSuccessRate.find((p) => p.provider === `${financeMarker}-provider`);
    expect(provider).toBeTruthy();
    expect(provider.total).toBe(2);
    expect(provider.succeeded).toBe(1);
    expect(provider.successRate).toBe(50);
  }, 15000);

  it('flags fee breakdown as explicitly unavailable, never fabricating a number', async () => {
    const res = await request(app).get(`/api/reports/finance?${rangeQS}`);
    expect(res.status).toBe(200);
    expect(res.body.data.feeBreakdownAvailable).toBe(false);
  }, 15000);

  it('exports via the shared CSV/Excel contract', async () => {
    const res = await request(app).get(`/api/reports/finance/export?${rangeQS}&format=xlsx`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
  }, 15000);
});
