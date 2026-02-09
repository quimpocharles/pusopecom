import express from 'express';
import UserActivity from '../models/UserActivity.js';
import Product from '../models/Product.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// POST /api/activity/view — log a product view
router.post('/view', optionalAuth, async (req, res) => {
  try {
    const { productId, sessionId } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'productId is required' });
    }

    const product = await Product.findById(productId).select('category sport').lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    await UserActivity.create({
      user: req.user?._id || null,
      sessionId: req.user ? null : (sessionId || null),
      type: 'view',
      product: productId,
      category: product.category,
      sport: product.sport
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Track view error:', error);
    res.status(500).json({ success: false, message: 'Failed to track view' });
  }
});

// POST /api/activity/search — log a search query
router.post('/search', optionalAuth, async (req, res) => {
  try {
    const { query, sessionId } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, message: 'query is required' });
    }

    await UserActivity.create({
      user: req.user?._id || null,
      sessionId: req.user ? null : (sessionId || null),
      type: 'search',
      query: query.trim()
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Track search error:', error);
    res.status(500).json({ success: false, message: 'Failed to track search' });
  }
});

export default router;
