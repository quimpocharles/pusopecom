import express from 'express';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// All routes require admin auth
router.use(authenticate, isAdmin);

// Helper: parse date range from query params
function getDateFilter(query) {
  const filter = {};
  if (query.startDate) filter.$gte = new Date(query.startDate);
  if (query.endDate) {
    const end = new Date(query.endDate);
    end.setHours(23, 59, 59, 999);
    filter.$lte = end;
  }
  return Object.keys(filter).length > 0 ? { createdAt: filter } : {};
}

// Helper: choose time granularity based on date range
function getGranularity(startDate, endDate) {
  if (!startDate && !endDate) return 'month';
  const start = startDate ? new Date(startDate) : new Date('2020-01-01');
  const end = endDate ? new Date(endDate) : new Date();
  const days = (end - start) / (1000 * 60 * 60 * 24);
  if (days <= 31) return 'day';
  if (days <= 180) return 'week';
  return 'month';
}

function getDateGroupExpression(granularity) {
  if (granularity === 'day') {
    return { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
  }
  if (granularity === 'week') {
    return {
      $dateToString: {
        format: '%Y-W%V',
        date: '$createdAt'
      }
    };
  }
  return { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
}

// GET /api/reports/sales
router.get('/sales', async (req, res) => {
  try {
    const dateFilter = getDateFilter(req.query);
    const granularity = getGranularity(req.query.startDate, req.query.endDate);
    const paidMatch = { paymentStatus: 'paid', ...dateFilter };

    const [revenueOverTime, salesByCategory, salesBySport, totals] = await Promise.all([
      // Revenue over time
      Order.aggregate([
        { $match: paidMatch },
        {
          $group: {
            _id: getDateGroupExpression(granularity),
            revenue: { $sum: '$total' },
            orders: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      // Sales by category
      Order.aggregate([
        { $match: paidMatch },
        { $unwind: '$items' },
        {
          $lookup: {
            from: 'products',
            localField: 'items.product',
            foreignField: '_id',
            as: 'productInfo'
          }
        },
        { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ['$productInfo.category', 'unknown'] },
            revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
            units: { $sum: '$items.quantity' }
          }
        },
        { $sort: { revenue: -1 } }
      ]),

      // Sales by sport
      Order.aggregate([
        { $match: paidMatch },
        { $unwind: '$items' },
        {
          $lookup: {
            from: 'products',
            localField: 'items.product',
            foreignField: '_id',
            as: 'productInfo'
          }
        },
        { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ['$productInfo.sport', 'unknown'] },
            revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
            units: { $sum: '$items.quantity' }
          }
        },
        { $sort: { revenue: -1 } }
      ]),

      // Totals
      Order.aggregate([
        { $match: paidMatch },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$total' },
            totalOrders: { $sum: 1 },
            averageOrderValue: { $avg: '$total' }
          }
        }
      ])
    ]);

    const summary = totals[0] || { totalRevenue: 0, totalOrders: 0, averageOrderValue: 0 };

    res.json({
      success: true,
      data: {
        revenueOverTime: revenueOverTime.map(r => ({ date: r._id, revenue: r.revenue, orders: r.orders })),
        salesByCategory: salesByCategory.map(s => ({ category: s._id, revenue: s.revenue, units: s.units })),
        salesBySport: salesBySport.map(s => ({ sport: s._id, revenue: s.revenue, units: s.units })),
        totalRevenue: summary.totalRevenue,
        totalOrders: summary.totalOrders,
        averageOrderValue: Math.round(summary.averageOrderValue * 100) / 100
      }
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
    const paidMatch = { paymentStatus: 'paid', ...dateFilter };

    const [bestSellers, worstSellers, salesByLeague, salesByTeam, stockLevels, lowStockProducts] = await Promise.all([
      // Best sellers - top 10
      Order.aggregate([
        { $match: paidMatch },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product',
            name: { $first: '$items.name' },
            image: { $first: '$items.image' },
            units: { $sum: '$items.quantity' },
            revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
          }
        },
        { $sort: { units: -1 } },
        { $limit: 10 }
      ]),

      // Worst sellers - bottom 10 with >0 sales
      Order.aggregate([
        { $match: paidMatch },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product',
            name: { $first: '$items.name' },
            image: { $first: '$items.image' },
            units: { $sum: '$items.quantity' },
            revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
          }
        },
        { $sort: { units: 1 } },
        { $limit: 10 }
      ]),

      // Sales by league
      Order.aggregate([
        { $match: paidMatch },
        { $unwind: '$items' },
        {
          $lookup: {
            from: 'products',
            localField: 'items.product',
            foreignField: '_id',
            as: 'productInfo'
          }
        },
        { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
        {
          $match: { 'productInfo.league': { $exists: true, $ne: '' } }
        },
        {
          $group: {
            _id: '$productInfo.league',
            revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
            units: { $sum: '$items.quantity' }
          }
        },
        { $sort: { revenue: -1 } }
      ]),

      // Sales by team - top 15
      Order.aggregate([
        { $match: paidMatch },
        { $unwind: '$items' },
        {
          $lookup: {
            from: 'products',
            localField: 'items.product',
            foreignField: '_id',
            as: 'productInfo'
          }
        },
        { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
        {
          $match: { 'productInfo.team': { $exists: true, $ne: '' } }
        },
        {
          $group: {
            _id: '$productInfo.team',
            revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
            units: { $sum: '$items.quantity' }
          }
        },
        { $sort: { revenue: -1 } },
        { $limit: 15 }
      ]),

      // Stock levels
      Promise.all([
        Product.countDocuments({ active: true, totalStock: 0 }),
        Product.countDocuments({ active: true, totalStock: { $gt: 0, $lte: 5 } }),
        Product.countDocuments({ active: true, totalStock: { $gt: 5 } })
      ]),

      // Low stock products
      Product.find({ active: true, totalStock: { $lte: 5 } })
        .select('name totalStock images slug')
        .sort('totalStock')
        .limit(15)
        .lean()
    ]);

    res.json({
      success: true,
      data: {
        bestSellers: bestSellers.map(p => ({ name: p.name, image: p.image, units: p.units, revenue: p.revenue })),
        worstSellers: worstSellers.map(p => ({ name: p.name, image: p.image, units: p.units, revenue: p.revenue })),
        salesByLeague: salesByLeague.map(s => ({ league: s._id, revenue: s.revenue, units: s.units })),
        salesByTeam: salesByTeam.map(s => ({ team: s._id, revenue: s.revenue, units: s.units })),
        stockLevels: {
          outOfStock: stockLevels[0],
          lowStock: stockLevels[1],
          healthy: stockLevels[2]
        },
        lowStockProducts
      }
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
    const allMatch = { ...dateFilter };

    const [ordersOverTime, statusBreakdown, paymentBreakdown, fulfillmentData, failedPayments] = await Promise.all([
      // Orders over time
      Order.aggregate([
        { $match: allMatch },
        {
          $group: {
            _id: getDateGroupExpression(granularity),
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      // Status breakdown
      Order.aggregate([
        { $match: allMatch },
        { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),

      // Payment breakdown
      Order.aggregate([
        { $match: allMatch },
        { $group: { _id: '$paymentStatus', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),

      // Fulfillment rate
      Order.aggregate([
        { $match: allMatch },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            delivered: { $sum: { $cond: [{ $eq: ['$orderStatus', 'delivered'] }, 1, 0] } },
            cancelled: { $sum: { $cond: [{ $eq: ['$orderStatus', 'cancelled'] }, 1, 0] } }
          }
        }
      ]),

      // Failed payments
      Order.aggregate([
        { $match: { paymentStatus: 'failed', ...dateFilter } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalValue: { $sum: '$total' }
          }
        }
      ])
    ]);

    const fulfillment = fulfillmentData[0] || { total: 0, delivered: 0, cancelled: 0 };
    const eligibleOrders = fulfillment.total - fulfillment.cancelled;
    const fulfillmentRate = eligibleOrders > 0
      ? Math.round((fulfillment.delivered / eligibleOrders) * 10000) / 100
      : 0;

    const failed = failedPayments[0] || { count: 0, totalValue: 0 };

    res.json({
      success: true,
      data: {
        ordersOverTime: ordersOverTime.map(r => ({ date: r._id, count: r.count })),
        statusBreakdown: statusBreakdown.map(s => ({ status: s._id, count: s.count })),
        paymentBreakdown: paymentBreakdown.map(s => ({ status: s._id, count: s.count })),
        fulfillmentRate,
        totalOrders: fulfillment.total,
        deliveredOrders: fulfillment.delivered,
        cancelledOrders: fulfillment.cancelled,
        failedPayments: { count: failed.count, totalValue: failed.totalValue }
      }
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
    const paidMatch = { paymentStatus: 'paid', ...dateFilter };

    const [topCustomers, geographicDistribution, cityDistribution, newVsReturning, customerGrowth] = await Promise.all([
      // Top customers by spend
      Order.aggregate([
        { $match: paidMatch },
        {
          $group: {
            _id: { $ifNull: ['$user', '$email'] },
            email: { $first: '$email' },
            totalSpent: { $sum: '$total' },
            orderCount: { $sum: 1 }
          }
        },
        { $sort: { totalSpent: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'userInfo'
          }
        },
        {
          $project: {
            email: 1,
            totalSpent: 1,
            orderCount: 1,
            name: {
              $cond: {
                if: { $gt: [{ $size: '$userInfo' }, 0] },
                then: {
                  $concat: [
                    { $arrayElemAt: ['$userInfo.firstName', 0] },
                    ' ',
                    { $arrayElemAt: ['$userInfo.lastName', 0] }
                  ]
                },
                else: '$email'
              }
            }
          }
        }
      ]),

      // Geographic distribution - provinces
      Order.aggregate([
        { $match: paidMatch },
        {
          $group: {
            _id: '$shippingAddress.province',
            orders: { $sum: 1 },
            revenue: { $sum: '$total' }
          }
        },
        { $sort: { orders: -1 } },
        { $limit: 15 }
      ]),

      // City distribution
      Order.aggregate([
        { $match: paidMatch },
        {
          $group: {
            _id: '$shippingAddress.city',
            orders: { $sum: 1 },
            revenue: { $sum: '$total' }
          }
        },
        { $sort: { orders: -1 } },
        { $limit: 15 }
      ]),

      // New vs returning
      Order.aggregate([
        { $match: paidMatch },
        {
          $group: {
            _id: { $ifNull: ['$user', '$email'] },
            orderCount: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: null,
            newCustomers: { $sum: { $cond: [{ $eq: ['$orderCount', 1] }, 1, 0] } },
            returningCustomers: { $sum: { $cond: [{ $gt: ['$orderCount', 1] }, 1, 0] } }
          }
        }
      ]),

      // Customer growth (new user registrations over time)
      (() => {
        const granularity = getGranularity(req.query.startDate, req.query.endDate);
        const userDateFilter = {};
        if (req.query.startDate) userDateFilter.$gte = new Date(req.query.startDate);
        if (req.query.endDate) {
          const end = new Date(req.query.endDate);
          end.setHours(23, 59, 59, 999);
          userDateFilter.$lte = end;
        }
        const userMatch = Object.keys(userDateFilter).length > 0
          ? { createdAt: userDateFilter }
          : {};

        let dateFormat;
        if (granularity === 'day') dateFormat = '%Y-%m-%d';
        else if (granularity === 'week') dateFormat = '%Y-W%V';
        else dateFormat = '%Y-%m';

        return User.aggregate([
          { $match: userMatch },
          {
            $group: {
              _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]);
      })()
    ]);

    const nvr = newVsReturning[0] || { newCustomers: 0, returningCustomers: 0 };

    res.json({
      success: true,
      data: {
        topCustomers: topCustomers.map(c => ({
          name: c.name,
          email: c.email,
          totalSpent: c.totalSpent,
          orderCount: c.orderCount
        })),
        geographicDistribution: geographicDistribution.map(g => ({
          province: g._id,
          orders: g.orders,
          revenue: g.revenue
        })),
        cityDistribution: cityDistribution.map(c => ({
          city: c._id,
          orders: c.orders,
          revenue: c.revenue
        })),
        newVsReturning: {
          newCustomers: nvr.newCustomers,
          returningCustomers: nvr.returningCustomers
        },
        customerGrowth: customerGrowth.map(g => ({ date: g._id, count: g.count }))
      }
    });
  } catch (error) {
    console.error('Customers report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate customers report' });
  }
});

export default router;
