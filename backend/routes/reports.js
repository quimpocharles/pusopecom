import express from 'express';
import * as orderRepository from '../repositories/orderRepository.js';
import * as productRepository from '../repositories/productRepository.js';
import * as userRepository from '../repositories/userRepository.js';
import * as tryOnLogRepository from '../repositories/tryOnLogRepository.js';
import * as shippingEventRepository from '../repositories/shippingEventRepository.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// All routes require admin auth
router.use(authenticate, isAdmin);

/**
 * Every report below fetches the relevant rows once via a repository call,
 * then groups/sums them in plain JS — replacing Mongo aggregation
 * pipelines ($group/$lookup/$unwind) rather than hand-translating each one
 * into raw SQL. Deliberate: these are admin-dashboard reads, not the
 * checkout hot path, and the resulting datasets (orders/try-on logs/
 * shipping events for a date range) are small enough that fetch-then-
 * reduce is both simpler and easier to verify than reproducing Mongo's
 * exact $dateToString bucketing and $lookup joins in SQL. Worth revisiting
 * with real SQL aggregation if order volume grows enough to make this a
 * real cost — not a concern at this platform's current scale.
 */

// Helper: parse date range from query params into a Prisma-shaped filter
export function getDateFilter(query) {
  const range = {};
  if (query.startDate) range.gte = new Date(query.startDate);
  if (query.endDate) {
    const end = new Date(query.endDate);
    end.setHours(23, 59, 59, 999);
    range.lte = end;
  }
  return Object.keys(range).length > 0 ? { createdAt: range } : {};
}

// Helper: choose time granularity based on date range
export function getGranularity(startDate, endDate) {
  if (!startDate && !endDate) return 'month';
  const start = startDate ? new Date(startDate) : new Date('2020-01-01');
  const end = endDate ? new Date(endDate) : new Date();
  const days = (end - start) / (1000 * 60 * 60 * 24);
  if (days <= 31) return 'day';
  if (days <= 180) return 'week';
  return 'month';
}

/**
 * Buckets a date into the same key shape Mongo's $dateToString produced
 * ('%Y-%m-%d', '%Y-W%V', '%Y-%m'), so every report's date-bucketed output
 * is unchanged for API consumers. The week case needs real ISO-8601 week
 * math (weeks start Monday, week 1 contains the year's first Thursday,
 * matching Mongo's %V) — not just a naive days-since-epoch divide.
 */
export function dateKey(date, granularity) {
  const d = new Date(date);
  if (granularity === 'day') return d.toISOString().slice(0, 10);
  if (granularity === 'month') return d.toISOString().slice(0, 7);

  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = utc.getUTCDay() || 7; // Mon=1..Sun=7
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum); // shift to this week's Thursday
  const isoYear = utc.getUTCFullYear();
  const yearStart = Date.UTC(isoYear, 0, 1);
  const weekNum = Math.ceil(((utc.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${isoYear}-W${String(weekNum).padStart(2, '0')}`;
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

const sortByDateKey = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

// GET /api/reports/sales
router.get('/sales', async (req, res) => {
  try {
    const dateFilter = getDateFilter(req.query);
    const granularity = getGranularity(req.query.startDate, req.query.endDate);

    const paidOrders = await orderRepository.find({
      where: { paymentStatus: 'paid', ...dateFilter },
      include: { items: { include: { product: true } } },
    });

    const revenueOverTime = [...groupBy(paidOrders, (o) => dateKey(o.createdAt, granularity))]
      .map(([date, orders]) => ({ date, revenue: orders.reduce((s, o) => s + o.total, 0), orders: orders.length }))
      .sort(sortByDateKey);

    const allItems = paidOrders.flatMap((o) => o.items);

    const salesByCategory = [...groupBy(allItems, (i) => i.product?.category ?? 'unknown')]
      .map(([category, items]) => ({
        category,
        revenue: items.reduce((s, i) => s + i.price * i.quantity, 0),
        units: items.reduce((s, i) => s + i.quantity, 0),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const salesBySport = [...groupBy(allItems, (i) => i.product?.sport ?? 'unknown')]
      .map(([sport, items]) => ({
        sport,
        revenue: items.reduce((s, i) => s + i.price * i.quantity, 0),
        units: items.reduce((s, i) => s + i.quantity, 0),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const totalRevenue = paidOrders.reduce((s, o) => s + o.total, 0);
    const totalOrders = paidOrders.length;
    const averageOrderValue = totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0;

    res.json({
      success: true,
      data: { revenueOverTime, salesByCategory, salesBySport, totalRevenue, totalOrders, averageOrderValue },
    });
  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate sales report' });
  }
});

// GET /api/reports/products
router.get('/products', async (req, res) => {
  try {
    const dateFilter = getDateFilter(req.query);

    const paidOrders = await orderRepository.find({
      where: { paymentStatus: 'paid', ...dateFilter },
      include: { items: { include: { product: true } } },
    });
    const allItems = paidOrders.flatMap((o) => o.items);

    const productAgg = [...groupBy(allItems, (i) => i.product._id)].map(([, items]) => ({
      name: items[0].name,
      image: items[0].image,
      units: items.reduce((s, i) => s + i.quantity, 0),
      revenue: items.reduce((s, i) => s + i.price * i.quantity, 0),
    }));
    const bestSellers = [...productAgg].sort((a, b) => b.units - a.units).slice(0, 10);
    const worstSellers = [...productAgg].sort((a, b) => a.units - b.units).slice(0, 10);

    const salesByLeague = [...groupBy(allItems.filter((i) => i.product.league), (i) => i.product.league)]
      .map(([league, items]) => ({
        league,
        revenue: items.reduce((s, i) => s + i.price * i.quantity, 0),
        units: items.reduce((s, i) => s + i.quantity, 0),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const salesByTeam = [...groupBy(allItems.filter((i) => i.product.team), (i) => i.product.team)]
      .map(([team, items]) => ({
        team,
        revenue: items.reduce((s, i) => s + i.price * i.quantity, 0),
        units: items.reduce((s, i) => s + i.quantity, 0),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 15);

    const [outOfStock, lowStock, healthy, lowStockProducts] = await Promise.all([
      productRepository.count({ where: { active: true, totalStock: 0 } }),
      productRepository.count({ where: { active: true, totalStock: { gt: 0, lte: 5 } } }),
      productRepository.count({ where: { active: true, totalStock: { gt: 5 } } }),
      productRepository.find({
        where: { active: true, totalStock: { lte: 5 } },
        orderBy: { totalStock: 'asc' },
        take: 15,
      }),
    ]);

    res.json({
      success: true,
      data: {
        bestSellers,
        worstSellers,
        salesByLeague,
        salesByTeam,
        stockLevels: { outOfStock, lowStock, healthy },
        lowStockProducts,
      },
    });
  } catch (error) {
    console.error('Products report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate products report' });
  }
});

// GET /api/reports/orders
router.get('/orders', async (req, res) => {
  try {
    const dateFilter = getDateFilter(req.query);
    const granularity = getGranularity(req.query.startDate, req.query.endDate);

    const orders = await orderRepository.find({ where: { ...dateFilter }, include: {} });

    const ordersOverTime = [...groupBy(orders, (o) => dateKey(o.createdAt, granularity))]
      .map(([date, os]) => ({ date, count: os.length }))
      .sort(sortByDateKey);

    const statusBreakdown = [...groupBy(orders, (o) => o.orderStatus)]
      .map(([status, os]) => ({ status, count: os.length }))
      .sort((a, b) => b.count - a.count);

    const paymentBreakdown = [...groupBy(orders, (o) => o.paymentStatus)]
      .map(([status, os]) => ({ status, count: os.length }))
      .sort((a, b) => b.count - a.count);

    const total = orders.length;
    const delivered = orders.filter((o) => o.orderStatus === 'delivered').length;
    const cancelled = orders.filter((o) => o.orderStatus === 'cancelled').length;
    const eligibleOrders = total - cancelled;
    const fulfillmentRate = eligibleOrders > 0 ? Math.round((delivered / eligibleOrders) * 10000) / 100 : 0;

    const failedOrders = orders.filter((o) => o.paymentStatus === 'failed');
    const failedPayments = { count: failedOrders.length, totalValue: failedOrders.reduce((s, o) => s + o.total, 0) };

    res.json({
      success: true,
      data: {
        ordersOverTime,
        statusBreakdown,
        paymentBreakdown,
        fulfillmentRate,
        totalOrders: total,
        deliveredOrders: delivered,
        cancelledOrders: cancelled,
        failedPayments,
      },
    });
  } catch (error) {
    console.error('Orders report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate orders report' });
  }
});

// GET /api/reports/customers
router.get('/customers', async (req, res) => {
  try {
    const dateFilter = getDateFilter(req.query);
    const granularity = getGranularity(req.query.startDate, req.query.endDate);

    // No `user` include — order.user then falls back to the bare userId
    // (or null for a guest order), matching the raw $user field Mongo's
    // pipeline grouped by before any $lookup.
    const paidOrders = await orderRepository.find({ where: { paymentStatus: 'paid', ...dateFilter }, include: {} });

    const byCustomer = groupBy(paidOrders, (o) => o.user || o.email);
    const customerAgg = [...byCustomer.values()].map((os) => ({
      userId: os[0].user || null,
      email: os[0].email,
      totalSpent: os.reduce((s, o) => s + o.total, 0),
      orderCount: os.length,
    }));

    const top10 = [...customerAgg].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10);
    const userIds = top10.filter((c) => c.userId).map((c) => c.userId);
    const users = userIds.length ? await userRepository.find({ where: { id: { in: userIds } } }) : [];
    const userById = new Map(users.map((u) => [u._id, u]));

    const topCustomers = top10.map((c) => {
      const user = c.userId ? userById.get(c.userId) : null;
      return {
        name: user ? `${user.firstName} ${user.lastName}` : c.email,
        email: c.email,
        totalSpent: c.totalSpent,
        orderCount: c.orderCount,
      };
    });

    const geographicDistribution = [...groupBy(paidOrders, (o) => o.shippingAddress.province)]
      .map(([province, os]) => ({ province, orders: os.length, revenue: os.reduce((s, o) => s + o.total, 0) }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 15);

    const cityDistribution = [...groupBy(paidOrders, (o) => o.shippingAddress.city)]
      .map(([city, os]) => ({ city, orders: os.length, revenue: os.reduce((s, o) => s + o.total, 0) }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 15);

    const newCustomers = customerAgg.filter((c) => c.orderCount === 1).length;
    const returningCustomers = customerAgg.filter((c) => c.orderCount > 1).length;

    const usersInRange = await userRepository.find({ where: { ...dateFilter } });
    const customerGrowth = [...groupBy(usersInRange, (u) => dateKey(u.createdAt, granularity))]
      .map(([date, us]) => ({ date, count: us.length }))
      .sort(sortByDateKey);

    res.json({
      success: true,
      data: {
        topCustomers,
        geographicDistribution,
        cityDistribution,
        newVsReturning: { newCustomers, returningCustomers },
        customerGrowth,
      },
    });
  } catch (error) {
    console.error('Customers report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate customers report' });
  }
});

// GET /api/reports/tryon
router.get('/tryon', async (req, res) => {
  try {
    const dateFilter = getDateFilter(req.query);
    const granularity = getGranularity(req.query.startDate, req.query.endDate);

    const logs = await tryOnLogRepository.find({ where: { ...dateFilter }, orderBy: { createdAt: 'desc' } });

    const tryOnOverTime = [...groupBy(logs, (l) => dateKey(l.createdAt, granularity))]
      .map(([date, ls]) => ({ date, count: ls.length }))
      .sort(sortByDateKey);

    const totalAttempts = logs.length;
    const successfulAttempts = logs.filter((l) => l.success === true).length;
    const successRate = totalAttempts > 0 ? Math.round((successfulAttempts / totalAttempts) * 10000) / 100 : 0;

    // product falls back to the bare productId (or null) — no `include`
    // requested, same reasoning as the customers report above. Entries
    // with no resolved product all group together under one null bucket,
    // matching the original pipeline's exact (if imprecise) behavior.
    const mostTriedProducts = [...groupBy(logs, (l) => l.product ?? 'unresolved').values()]
      .map((ls) => ({ productName: ls[0].productName, productImage: ls[0].productImage, count: ls.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const recentTryOns = logs.slice(0, 10).map((l) => ({
      productName: l.productName,
      productImage: l.productImage,
      success: l.success,
      createdAt: l.createdAt,
    }));

    // Real observed speed/reliability per WaveSpeed model (or Replicate) —
    // added to answer empirically which model to run in production,
    // rather than relying on provider documentation, which turned out to
    // be incomplete/inconsistent on latency. Rows logged before this field
    // existed fall back to 'unknown'; durationMs can be null on an attempt
    // that failed before generation started, so the average excludes those
    // rather than counting them as 0ms.
    const byProvider = [...groupBy(logs, (l) => l.provider ?? 'unknown').entries()]
      .map(([provider, ls]) => {
        const withDuration = ls.filter((l) => l.durationMs != null);
        const avgDurationMs = withDuration.length > 0
          ? Math.round(withDuration.reduce((s, l) => s + l.durationMs, 0) / withDuration.length)
          : null;
        const successCount = ls.filter((l) => l.success === true).length;
        return {
          provider,
          attempts: ls.length,
          avgDurationMs,
          successRate: ls.length > 0 ? Math.round((successCount / ls.length) * 10000) / 100 : 0,
        };
      })
      .sort((a, b) => b.attempts - a.attempts);

    res.json({
      success: true,
      data: { tryOnOverTime, totalAttempts, successfulAttempts, successRate, mostTriedProducts, recentTryOns, byProvider },
    });
  } catch (error) {
    console.error('Try-on report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate try-on report' });
  }
});

// GET /api/reports/shipping
router.get('/shipping', async (req, res) => {
  try {
    const dateFilter = getDateFilter(req.query);

    const rawEvents = await shippingEventRepository.find({ where: { ...dateFilter }, orderBy: { createdAt: 'desc' } });

    const methodBreakdown = [...groupBy(rawEvents, (e) => `${e.shippingMethod}::${e.region ?? ''}`).values()]
      .map((events) => ({
        _id: { method: events[0].shippingMethod, region: events[0].region },
        count: events.length,
        totalRevenue: events.reduce((s, e) => s + e.orderTotal, 0),
      }))
      .sort((a, b) => b.count - a.count);

    res.json({ success: true, data: { methodBreakdown, rawEvents, totalOrders: rawEvents.length } });
  } catch (error) {
    console.error('Shipping report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate shipping report' });
  }
});

export default router;
