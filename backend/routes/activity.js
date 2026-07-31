import express from 'express';
import * as userActivityRepository from '../repositories/userActivityRepository.js';
import * as productRepository from '../repositories/productRepository.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// POST /api/activity/view — log a product view
router.post('/view', optionalAuth, async (req, res) => {
  try {
    const { productId, sessionId } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'productId is required' });
    }

    // include: {} skips the sizes/colors nested relations the repository
    // defaults to — this only needs category/sport, not the full product.
    const product = await productRepository.findById(productId, { include: {} });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    await Promise.all([
      // userActivityRepository.create expects Prisma's own FK field names
      // (userId/productId), not the Mongoose ref names (user/product) the
      // original route used — the one real translation this swap needs.
      userActivityRepository.create({
        userId: req.user?._id || null,
        sessionId: req.user ? null : (sessionId || null),
        type: 'view',
        productId,
        category: product.category,
        sport: product.sport
      }),
      productRepository.updateById(productId, { totalViews: { increment: 1 } })
    ]);

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

    await userActivityRepository.create({
      userId: req.user?._id || null,
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
