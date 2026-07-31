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
    data: { productId: productWithLeague.id, productName: productWithLeague.name, productImage: 'x.jpg', success: true },
  });
  await prisma.tryOnLog.create({
    data: { productName: `${MARKER} Unresolved`, productImage: 'x.jpg', success: false },
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
    expect(res.body.data.totalAttempts).toBeGreaterThanOrEqual(2);
    expect(res.body.data.successfulAttempts).toBeGreaterThanOrEqual(1);
    expect(res.body.data.mostTriedProducts.some((p) => p.productName === productWithLeague.name)).toBe(true);
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
