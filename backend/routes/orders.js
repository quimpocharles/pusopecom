import express from 'express';
import { body, validationResult } from 'express-validator';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import ShippingEvent from '../models/ShippingEvent.js';
import VenuePickupConfig from '../models/VenuePickupConfig.js';
import { getDomesticRate, getInternationalRate, isSlotActive } from '../lib/shipping/calculateShipping.js';
import { authenticate, isAdmin, optionalAuth } from '../middleware/auth.js';
import { createCheckout, getCheckoutStatus } from '../services/mayaService.js';
import { sendOrderConfirmationEmail } from '../services/emailService.js';

const router = express.Router();

// Create order and initiate Maya checkout
router.post('/',
  optionalAuth,
  [
    body('email').isEmail().normalizeEmail(),
    body('items').isArray({ min: 1 }),
    body('shippingAddress').isObject(),
    body('shippingAddress.fullName').trim().notEmpty(),
    body('shippingAddress.phone').trim().notEmpty(),
    body('shippingAddress.address').trim().notEmpty(),
    body('shippingAddress.city').trim().notEmpty(),
    body('shippingAddress.province').trim().notEmpty(),
    body('shippingAddress.zipCode').trim().notEmpty(),
    body('shippingAddress.country').optional().trim(),
    body('shippingAddress.region').optional().trim(),
    body('shippingAddress.barangay').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { email, items, shippingAddress, notes, shippingMethod, shippingRegion, slotId } = req.body;

      // Validate items and calculate totals
      let subtotal = 0;
      const orderItems = [];

      for (const item of items) {
        const product = await Product.findById(item.product);

        if (!product || !product.active) {
          return res.status(400).json({
            success: false,
            message: `Product not found: ${item.name}`
          });
        }

        // Check stock availability
        let sizeStock;
        let itemImage = product.images[0];

        if (item.color && product.colors?.length > 0) {
          const colorVariant = product.colors.find(c => c.color === item.color);
          if (!colorVariant) {
            return res.status(400).json({
              success: false,
              message: `Color ${item.color} not found for ${product.name}`
            });
          }
          sizeStock = colorVariant.sizes.find(s => s.size === item.size);
          if (colorVariant.image) itemImage = colorVariant.image;
        } else {
          sizeStock = product.sizes.find(s => s.size === item.size);
        }

        if (!sizeStock || sizeStock.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.name}${item.color ? ` - ${item.color}` : ''} - Size ${item.size}`
          });
        }

        const price = product.salePrice || product.price;
        subtotal += price * item.quantity;

        orderItems.push({
          product: product._id,
          name: product.name,
          price,
          quantity: item.quantity,
          size: item.size,
          color: item.color || undefined,
          image: itemImage
        });

        // Reduce stock and increment sold count
        sizeStock.stock -= item.quantity;
        product.totalSold = (product.totalSold || 0) + item.quantity;
        await product.save();
      }

      // Recalculate shipping fee server-side — never trust the client value
      const country = shippingAddress?.country || 'Philippines';
      let shippingFee;

      if (shippingMethod === 'venue_pickup' && country === 'Philippines') {
        // Verify the specific slot is still active at time of order
        const venue = await VenuePickupConfig.findOne().lean();
        const targetSlot = venue?.slots?.find(s => s._id.toString() === slotId);
        const slotValid =
          venue?.enabled &&
          targetSlot &&
          isSlotActive(targetSlot, venue.deadlineHours ?? 6);
        shippingFee = slotValid ? 0 : getDomesticRate(shippingRegion || '', subtotal).fee;
      } else if (country === 'Philippines') {
        shippingFee = getDomesticRate(shippingRegion || '', subtotal).fee;
      } else {
        const intl = getInternationalRate(country);
        shippingFee = intl.fee ?? 0;
      }

      const total = subtotal + shippingFee;

      // Create order
      const order = new Order({
        user: req.user?._id,
        email,
        items: orderItems,
        shippingAddress,
        subtotal,
        shippingFee,
        total,
        shippingMethod: shippingMethod || undefined,
        shippingRegion: shippingRegion || undefined,
        notes
      });

      await order.save();

      // Create Maya checkout session
      try {
        const { checkoutId, redirectUrl } = await createCheckout(order);

        order.mayaPaymentId = checkoutId;
        order.mayaCheckoutUrl = redirectUrl;
        await order.save();

        res.status(201).json({
          success: true,
          message: 'Order created successfully',
          data: {
            orderNumber: order.orderNumber,
            checkoutUrl: redirectUrl
          }
        });
      } catch (mayaError) {
        // If Maya checkout fails, still keep the order but mark it as failed
        console.error('Maya checkout failed:', mayaError);
        order.paymentStatus = 'failed';
        await order.save();

        return res.status(500).json({
          success: false,
          message: 'Failed to initialize payment. Please try again.',
          orderNumber: order.orderNumber
        });
      }
    } catch (error) {
      console.error('Create order error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create order'
      });
    }
  }
);

// Get admin dashboard stats
router.get('/admin/stats',
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        revenueResult,
        monthlyRevenueResult,
        topProducts,
        statusCounts,
        lowStockProducts
      ] = await Promise.all([
        // Total revenue from paid orders
        Order.aggregate([
          { $match: { paymentStatus: 'paid' } },
          { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }
        ]),

        // Revenue this month from paid orders
        Order.aggregate([
          { $match: { paymentStatus: 'paid', createdAt: { $gte: startOfMonth } } },
          { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }
        ]),

        // Top 5 selling products (from paid orders)
        Order.aggregate([
          { $match: { paymentStatus: 'paid' } },
          { $unwind: '$items' },
          {
            $group: {
              _id: '$items.product',
              name: { $first: '$items.name' },
              image: { $first: '$items.image' },
              totalQuantity: { $sum: '$items.quantity' }
            }
          },
          { $sort: { totalQuantity: -1 } },
          { $limit: 5 }
        ]),

        // Orders by status
        Order.aggregate([
          { $group: { _id: '$orderStatus', count: { $sum: 1 } } }
        ]),

        // Low stock products (totalStock <= 5 and active)
        Product.find({ active: true, totalStock: { $lte: 5 } })
          .select('name slug totalStock images')
          .sort('totalStock')
          .limit(10)
          .lean()
      ]);

      const revenue = revenueResult[0] || { total: 0, count: 0 };
      const monthlyRevenue = monthlyRevenueResult[0] || { total: 0, count: 0 };

      const ordersByStatus = {};
      for (const s of statusCounts) {
        ordersByStatus[s._id] = s.count;
      }

      res.json({
        success: true,
        data: {
          totalRevenue: revenue.total,
          paidOrdersCount: revenue.count,
          revenueThisMonth: monthlyRevenue.total,
          monthlyOrdersCount: monthlyRevenue.count,
          topSellingProducts: topProducts,
          ordersByStatus,
          lowStockProducts
        }
      });
    } catch (error) {
      console.error('Get admin stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve admin stats'
      });
    }
  }
);

// Export orders as CSV (Admin only)
router.get('/admin/export',
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const { period = 'all' } = req.query;

      const now = new Date();
      let startDate = null;

      if (period === 'daily') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (period === 'weekly') {
        const day = now.getDay(); // 0=Sun
        const diffToMon = (day === 0 ? -6 : 1 - day);
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon);
      } else if (period === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (period === 'yearly') {
        startDate = new Date(now.getFullYear(), 0, 1);
      }

      const filter = startDate ? { createdAt: { $gte: startDate } } : {};

      const orders = await Order.find(filter)
        .sort('-createdAt')
        .populate('user', 'firstName lastName email')
        .lean();

      const fmt = (d) => {
        const dt = new Date(d);
        return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
      };

      const escape = (val) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const reportStart = startDate ? fmt(startDate) : fmt(orders.length ? orders[orders.length - 1].createdAt : now);
      const reportEnd = fmt(now);

      const meta = [
        `Report Start Date,${reportStart}`,
        `Report End Date,${reportEnd}`,
        ''
      ];

      const headers = [
        'Order #', 'Date', 'Customer', 'Email',
        'Items', 'Subtotal', 'Shipping Fee', 'Total',
        'Payment Status', 'Order Status', 'Courier', 'Tracking #'
      ];

      const rows = orders.map((o) => {
        const customer = o.user
          ? `${o.user.firstName} ${o.user.lastName}`
          : o.shippingAddress?.fullName || '';
        const email = o.user ? o.user.email : o.email;
        const items = (o.items || [])
          .map(i => `${i.name}${i.color ? ` (${i.color})` : ''} ${i.size} x${i.quantity}`)
          .join('; ');
        return [
          escape(o.orderNumber),
          escape(fmt(o.createdAt)),
          escape(customer),
          escape(email),
          escape(items),
          escape(o.subtotal?.toFixed(2)),
          escape(o.shippingFee?.toFixed(2)),
          escape(o.total?.toFixed(2)),
          escape(o.paymentStatus),
          escape(o.orderStatus),
          escape(o.courier || ''),
          escape(o.trackingNumber || '')
        ].join(',');
      });

      const csv = [...meta, headers.join(','), ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="transaction-report.csv"');
      res.send(csv);
    } catch (error) {
      console.error('Export orders error:', error);
      res.status(500).json({ success: false, message: 'Failed to export orders' });
    }
  }
);

// Get order by order number
// Verify payment status with Maya (called when user returns from checkout)
router.post('/:orderNumber/verify-payment', optionalAuth, async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Already resolved — no need to check again
    if (order.paymentStatus === 'paid' || order.paymentStatus === 'failed') {
      return res.json({ success: true, data: { paymentStatus: order.paymentStatus } });
    }

    if (!order.mayaPaymentId) {
      return res.json({ success: true, data: { paymentStatus: order.paymentStatus } });
    }

    // Poll Maya for checkout status
    const checkoutData = await getCheckoutStatus(order.mayaPaymentId);

    if (checkoutData.paymentStatus === 'PAYMENT_SUCCESS') {
      order.paymentStatus = 'paid';
      order.orderStatus = 'confirmed';
      await order.save();

      // Record shipping event for analytics
      try {
        await ShippingEvent.create({
          orderId: order.orderNumber,
          shippingMethod: order.shippingMethod || 'unknown',
          orderTotal: order.total,
          region: order.shippingRegion || null,
        });
      } catch (shippingEventError) {
        console.error('Failed to record shipping event:', shippingEventError);
      }

      // Send confirmation email
      try {
        await sendOrderConfirmationEmail(order.email, order);
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
      }
    } else if (checkoutData.paymentStatus === 'PAYMENT_FAILED' || checkoutData.paymentStatus === 'PAYMENT_EXPIRED') {
      order.paymentStatus = 'failed';
      await order.save();
    }

    res.json({ success: true, data: { paymentStatus: order.paymentStatus } });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify payment' });
  }
});

router.get('/:orderNumber', optionalAuth, async (req, res) => {
  try {
    const order = await Order.findOne({
      orderNumber: req.params.orderNumber
    }).populate('items.product', 'name slug images');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check authorization
    if (order.user && req.user) {
      if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve order'
    });
  }
});

// Get user's orders
router.get('/user/:userId', authenticate, async (req, res) => {
  try {
    if (req.params.userId !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const orders = await Order.find({ user: req.params.userId })
      .sort('-createdAt')
      .populate('items.product', 'name slug images');

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve orders'
    });
  }
});

// Maya webhook handler
router.post('/webhooks/maya', async (req, res) => {
  try {
    const webhookData = req.body;

    console.log('Maya webhook received:', webhookData);

    if (webhookData.status === 'PAYMENT_SUCCESS') {
      const order = await Order.findOne({
        orderNumber: webhookData.requestReferenceNumber
      });

      if (order) {
        const wasAlreadyPaid = order.paymentStatus === 'paid';
        order.paymentStatus = 'paid';
        order.orderStatus = 'confirmed';
        await order.save();

        // Record shipping event only once — skip if verify-payment already did it
        if (!wasAlreadyPaid) {
          try {
            await ShippingEvent.create({
              orderId: order.orderNumber,
              shippingMethod: order.shippingMethod || 'unknown',
              orderTotal: order.total,
              region: order.shippingRegion || null,
            });
          } catch (shippingEventError) {
            console.error('Failed to record shipping event:', shippingEventError);
          }
        }

        // Send confirmation email
        try {
          await sendOrderConfirmationEmail(order.email, order);
        } catch (emailError) {
          console.error('Failed to send confirmation email:', emailError);
        }
      }
    } else if (webhookData.status === 'PAYMENT_FAILED') {
      const order = await Order.findOne({
        orderNumber: webhookData.requestReferenceNumber
      });

      if (order) {
        order.paymentStatus = 'failed';
        await order.save();

        // Restore stock
        for (const item of order.items) {
          const product = await Product.findById(item.product);
          if (product) {
            let sizeStock;
            if (item.color && product.colors?.length > 0) {
              const colorVariant = product.colors.find(c => c.color === item.color);
              if (colorVariant) sizeStock = colorVariant.sizes.find(s => s.size === item.size);
            } else {
              sizeStock = product.sizes.find(s => s.size === item.size);
            }
            if (sizeStock) {
              sizeStock.stock += item.quantity;
              await product.save();
            }
          }
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false });
  }
});

// Update order status (Admin only)
router.patch('/:id/status',
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const { orderStatus, trackingNumber, courier } = req.body;

      const order = await Order.findByIdAndUpdate(
        req.params.id,
        {
          orderStatus,
          ...(trackingNumber !== undefined && { trackingNumber }),
          ...(courier !== undefined && { courier })
        },
        { new: true, runValidators: true }
      );

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      res.json({
        success: true,
        message: 'Order status updated successfully',
        data: order
      });
    } catch (error) {
      console.error('Update order status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update order status'
      });
    }
  }
);

// Get all orders (Admin only)
router.get('/admin/all',
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        paymentStatus
      } = req.query;

      const filter = {};
      if (status) filter.orderStatus = status;
      if (paymentStatus) filter.paymentStatus = paymentStatus;

      const skip = (Number(page) - 1) * Number(limit);

      const [orders, total] = await Promise.all([
        Order.find(filter)
          .sort('-createdAt')
          .skip(skip)
          .limit(Number(limit))
          .populate('user', 'firstName lastName email')
          .populate('items.product', 'name slug'),
        Order.countDocuments(filter)
      ]);

      res.json({
        success: true,
        data: orders,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      console.error('Get all orders error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve orders'
      });
    }
  }
);

export default router;
