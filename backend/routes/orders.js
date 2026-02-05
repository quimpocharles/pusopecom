import express from 'express';
import { body, validationResult } from 'express-validator';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
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
    body('shippingAddress.zipCode').trim().notEmpty()
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

      const { email, items, shippingAddress, notes } = req.body;

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
        const sizeStock = product.sizes.find(s => s.size === item.size);
        if (!sizeStock || sizeStock.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.name} - Size ${item.size}`
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
          image: product.images[0]
        });

        // Reduce stock
        sizeStock.stock -= item.quantity;
        await product.save();
      }

      const shippingFee = 150;
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

// Get order by order number
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
        order.paymentStatus = 'paid';
        order.orderStatus = 'confirmed';
        await order.save();

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
            const sizeStock = product.sizes.find(s => s.size === item.size);
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
      const { orderStatus, trackingNumber } = req.body;

      const order = await Order.findByIdAndUpdate(
        req.params.id,
        { orderStatus, ...(trackingNumber && { trackingNumber }) },
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
