import express from 'express';
import { body, validationResult } from 'express-validator';
import Review from '../models/Review.js';
import Product from '../models/Product.js';

const router = express.Router();

// Helper: recalculate product rating stats
async function recalcStats(productId) {
  const stats = await Review.aggregate([
    { $match: { product: productId } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  if (stats.length > 0) {
    await Product.findByIdAndUpdate(productId, {
      avgRating: Math.round(stats[0].avgRating * 10) / 10,
      reviewCount: stats[0].reviewCount,
    });
  } else {
    await Product.findByIdAndUpdate(productId, { avgRating: 0, reviewCount: 0 });
  }
}

// GET /api/products/:slug/reviews
router.get('/:slug/reviews', async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug, active: true });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [reviews, total, distribution] = await Promise.all([
      Review.find({ product: product._id })
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .select('-email -__v'),
      Review.countDocuments({ product: product._id }),
      Review.aggregate([
        { $match: { product: product._id } },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
        { $sort: { _id: -1 } },
      ]),
    ]);

    // Build rating distribution { 5: 20, 4: 15, 3: 5, 2: 1, 1: 0 }
    const ratingDist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    distribution.forEach((d) => { ratingDist[d._id] = d.count; });

    res.json({
      success: true,
      data: reviews,
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
    console.error('Get reviews error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve reviews' });
  }
});

// POST /api/products/:slug/reviews
router.post(
  '/:slug/reviews',
  [
    body('author').trim().notEmpty().withMessage('Name is required'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
    body('title').optional().trim(),
    body('body').optional().trim(),
    body('email').optional().isEmail().normalizeEmail(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const product = await Product.findOne({ slug: req.params.slug, active: true });
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      const review = new Review({
        product: product._id,
        author: req.body.author,
        email: req.body.email || undefined,
        rating: req.body.rating,
        title: req.body.title,
        body: req.body.body,
      });

      await review.save();
      await recalcStats(product._id);

      res.status(201).json({ success: true, data: review });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({ success: false, message: 'You have already reviewed this product' });
      }
      console.error('Create review error:', error);
      res.status(500).json({ success: false, message: 'Failed to create review' });
    }
  }
);

export default router;
