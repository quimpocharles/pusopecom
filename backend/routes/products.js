import express from 'express';
import { body, validationResult } from 'express-validator';
import Product from '../models/Product.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all products with filters
router.get('/', async (req, res) => {
  try {
    const {
      sport,
      team,
      category,
      minPrice,
      maxPrice,
      search,
      featured,
      page = 1,
      limit = 12,
      sort = '-createdAt'
    } = req.query;

    const filter = { active: true };

    if (sport) filter.sport = sport;
    if (team) filter.team = { $regex: team, $options: 'i' };
    if (category) filter.category = category;
    if (featured) filter.featured = featured === 'true';

    if (minPrice || maxPrice) {
      filter.$or = [
        {
          salePrice: {
            ...(minPrice && { $gte: Number(minPrice) }),
            ...(maxPrice && { $lte: Number(maxPrice) })
          }
        },
        {
          $and: [
            { salePrice: { $exists: false } },
            {
              price: {
                ...(minPrice && { $gte: Number(minPrice) }),
                ...(maxPrice && { $lte: Number(maxPrice) })
              }
            }
          ]
        }
      ];
    }

    if (search) {
      filter.$text = { $search: search };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .select('-__v'),
      Product.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve products'
    });
  }
});

// Get single product by slug
router.get('/:slug', async (req, res) => {
  try {
    const product = await Product.findOne({
      slug: req.params.slug,
      active: true
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve product'
    });
  }
});

// Create product (Admin only)
router.post('/',
  authenticate,
  isAdmin,
  [
    body('name').trim().notEmpty(),
    body('description').trim().notEmpty(),
    body('price').isFloat({ min: 0 }),
    body('category').isIn(['jersey', 'tshirt', 'cap', 'shorts', 'accessories']),
    body('sport').isIn(['basketball', 'volleyball', 'football', 'general']),
    body('images').isArray({ min: 1 }),
    body('sizes').isArray({ min: 1 })
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

      const product = new Product(req.body);
      await product.save();

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: product
      });
    } catch (error) {
      console.error('Create product error:', error);
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Product slug already exists'
        });
      }
      res.status(500).json({
        success: false,
        message: 'Failed to create product'
      });
    }
  }
);

// Update product (Admin only)
router.put('/:id',
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const product = await Product.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      res.json({
        success: true,
        message: 'Product updated successfully',
        data: product
      });
    } catch (error) {
      console.error('Update product error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update product'
      });
    }
  }
);

// Delete product (Admin only)
router.delete('/:id',
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const product = await Product.findByIdAndUpdate(
        req.params.id,
        { active: false },
        { new: true }
      );

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      res.json({
        success: true,
        message: 'Product deleted successfully'
      });
    } catch (error) {
      console.error('Delete product error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete product'
      });
    }
  }
);

// Get product statistics (Admin only)
router.get('/admin/stats',
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const [total, active, featured, byCategory, bySport] = await Promise.all([
        Product.countDocuments(),
        Product.countDocuments({ active: true }),
        Product.countDocuments({ featured: true }),
        Product.aggregate([
          { $group: { _id: '$category', count: { $sum: 1 } } }
        ]),
        Product.aggregate([
          { $group: { _id: '$sport', count: { $sum: 1 } } }
        ])
      ]);

      res.json({
        success: true,
        data: {
          total,
          active,
          featured,
          byCategory,
          bySport
        }
      });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve statistics'
      });
    }
  }
);

export default router;
