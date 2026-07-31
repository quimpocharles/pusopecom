import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import { body, validationResult } from 'express-validator';
import * as reviewRepository from '../repositories/reviewRepository.js';
import * as productRepository from '../repositories/productRepository.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Helper: recalculate product rating stats
async function recalcStats(productId) {
  const { avgRating, reviewCount } = await reviewRepository.getStats(productId);
  await productRepository.updateById(productId, { avgRating, reviewCount });
}

// GET /api/products/reviews/my — get product IDs the current user has reviewed
router.get('/reviews/my', authenticate, async (req, res) => {
  try {
    const reviews = await reviewRepository.find({ where: { email: req.user.email } });
    // .product already falls back to the bare id when not populated
    // (reviewRepository's own relation-fallback handling) — no .toString()
    // needed, Prisma already returns it as a plain string.
    const reviewedProductIds = reviews.map(r => r.product);
    res.json({ success: true, data: reviewedProductIds });
  } catch (error) {
    logger.error({ err: error }, 'Get my reviews error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve reviews' });
  }
});

// GET /api/products/:slug/reviews
router.get('/:slug/reviews', async (req, res) => {
  try {
    const product = await productRepository.findBySlug(req.params.slug);
    if (!product || !product.active) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [reviews, total, ratingDist] = await Promise.all([
      reviewRepository.find({
        where: { productId: product._id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      reviewRepository.count({ where: { productId: product._id } }),
      reviewRepository.getRatingDistribution(product._id),
    ]);

    // Matches the original .select('-email -__v') — don't leak reviewer
    // emails in a public review listing. Prisma has no __v field at all.
    const publicReviews = reviews.map(({ email, ...rest }) => rest);

    res.json({
      success: true,
      data: publicReviews,
      summary: {
        avgRating: product.avgRating,
        reviewCount: product.reviewCount,
        distribution: ratingDist,
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Get reviews error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve reviews' });
  }
});

// POST /api/products/:slug/reviews (authenticated users only)
router.post(
  '/:slug/reviews',
  authenticate,
  [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
    body('title').optional().trim(),
    body('body').optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const product = await productRepository.findBySlug(req.params.slug);
      if (!product || !product.active) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      const review = await reviewRepository.create({
        productId: product._id,
        author: req.user.firstName
          ? `${req.user.firstName} ${req.user.lastName ? req.user.lastName.charAt(0) + '.' : ''}`.trim()
          : req.user.email.split('@')[0],
        email: req.user.email,
        rating: req.body.rating,
        title: req.body.title,
        body: req.body.body,
      });

      await recalcStats(product._id);

      res.status(201).json({ success: true, data: review });
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(400).json({ success: false, message: 'You have already reviewed this product' });
      }
      logger.error({ err: error }, 'Create review error');
      Sentry.captureException(error);
      res.status(500).json({ success: false, message: 'Failed to create review' });
    }
  }
);

export default router;
