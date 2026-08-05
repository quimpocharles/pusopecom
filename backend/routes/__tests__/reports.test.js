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
    expect(providerB.attempts).toBe(1);
    expect(providerB.avgDurationMs).toBe(40000);
    expect(providerB.successRate).toBe(100);
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
