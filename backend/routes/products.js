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
      league,
      category,
      gender,
      sale,
      minPrice,
      maxPrice,
      search,
      featured,
      page = 1,
      limit = 12,
      sort = '-createdAt'
    } = req.query;

    const sortMap = {
      'alphabetical': 'name',
      'newest': '-createdAt',
      'most-bought': '-totalSold',
      'trending': '-totalViews',
    };
    const resolvedSort = sortMap[sort] || sort;

    const filter = { active: true };

    if (sport) {
      const values = sport.split(',').map(v => new RegExp(`^${v.trim()}$`, 'i'));
      const sportOrConditions = [
        ...values.map(v => ({ sport: { $regex: v } })),
        { sport: 'general' }
      ];
      if (!filter.$and) filter.$and = [];
      filter.$and.push({ $or: sportOrConditions });
    }
    if (team) filter.team = { $regex: team, $options: 'i' };
    if (league) filter.league = { $regex: `^${league}$`, $options: 'i' };
    if (category) {
      const values = category.split(',').map(v => new RegExp(`^${v.trim()}$`, 'i'));
      filter.category = values.length === 1 ? { $regex: values[0] } : { $in: values };
    }
    if (gender) {
      const values = gender.split(',').map(v => new RegExp(`^${v.trim()}$`, 'i'));
      filter.gender = values.length === 1 ? { $regex: values[0] } : { $in: values };
    }
    if (sale === 'true') filter.salePrice = { $exists: true, $gt: 0 };
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
        .sort(resolvedSort)
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

// Get all products including inactive (Admin only)
router.get('/admin/all',
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        category,
        sport
      } = req.query;

      const filter = {};
      if (category) filter.category = category;
      if (sport) filter.sport = sport;
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { team: { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);

      const [products, total] = await Promise.all([
        Product.find(filter)
          .sort('-createdAt')
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
      console.error('Get admin products error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve products'
      });
    }
  }
);

// Get single product by ID (Admin only - for edit form, includes inactive)
router.get('/admin/:id',
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);

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
      console.error('Get admin product error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve product'
      });
    }
  }
);

// Cart-based product recommendations
const COMPLEMENTARY_CATEGORIES = {
  jersey: ['shorts', 'cap', 'accessories'],
  tshirt: ['shorts', 'cap', 'accessories'],
  shorts: ['jersey', 'tshirt', 'cap'],
  cap: ['jersey', 'tshirt', 'accessories'],
  accessories: ['jersey', 'tshirt', 'shorts']
};

router.get('/recommendations/cart', async (req, res) => {
  try {
    const { cartProductIds, limit = 4 } = req.query;

    if (!cartProductIds) {
      return res.json({ success: true, data: [] });
    }

    const ids = cartProductIds.split(',').filter(Boolean);
    if (ids.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Load cart products to get their categories/sports
    const cartProducts = await Product.find({ _id: { $in: ids } })
      .select('category sport')
      .lean();

    if (cartProducts.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Build complementary category set based on what's in cart
    const complementaryCategories = new Set();
    const sports = new Set();
    for (const p of cartProducts) {
      const complements = COMPLEMENTARY_CATEGORIES[p.category] || [];
      complements.forEach(c => complementaryCategories.add(c));
      sports.add(p.sport);
    }

    // Remove categories already in cart
    const cartCategories = new Set(cartProducts.map(p => p.category));
    for (const cat of cartCategories) {
      complementaryCategories.delete(cat);
    }

    let recommendations = [];

    // Try complementary categories in the same sport(s)
    if (complementaryCategories.size > 0) {
      recommendations = await Product.find({
        active: true,
        _id: { $nin: ids },
        category: { $in: [...complementaryCategories] },
        sport: { $in: [...sports] },
        totalStock: { $gt: 0 }
      })
        .select('name slug images price salePrice category sport sizes colors totalStock')
        .limit(Number(limit))
        .lean();
    }

    // Fall back to popular products in the same sport if not enough
    if (recommendations.length < Number(limit)) {
      const existing = new Set([...ids, ...recommendations.map(r => r._id.toString())]);
      const fallback = await Product.find({
        active: true,
        _id: { $nin: [...existing] },
        sport: { $in: [...sports] },
        totalStock: { $gt: 0 }
      })
        .select('name slug images price salePrice category sport sizes colors totalStock')
        .sort('-featured -reviewCount')
        .limit(Number(limit) - recommendations.length)
        .lean();

      recommendations = [...recommendations, ...fallback];
    }

    res.json({ success: true, data: recommendations });
  } catch (error) {
    console.error('Cart recommendations error:', error);
    res.status(500).json({ success: false, message: 'Failed to get recommendations' });
  }
});

// Search suggestions (autocomplete)
router.get('/search/suggestions', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({ success: true, data: [] });
    }

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const products = await Product.find({
      active: true,
      name: { $regex: escaped, $options: 'i' }
    })
      .select('name slug images price salePrice')
      .limit(6)
      .lean();

    res.json({
      success: true,
      data: products.map(p => ({
        name: p.name,
        slug: p.slug,
        image: p.images?.[0] || null,
        price: p.price,
        salePrice: p.salePrice || null
      }))
    });
  } catch (error) {
    console.error('Search suggestions error:', error);
    res.status(500).json({ success: false, message: 'Failed to get suggestions' });
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
    body('images').isArray({ min: 1 })
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

// Hard delete product (superadmin only)
router.delete('/:id/permanent',
  authenticate,
  isAdmin,
  async (req, res) => {
    if (req.user.email !== 'quimpo.charles@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }
    try {
      const product = await Product.findByIdAndDelete(req.params.id);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      res.json({
        success: true,
        message: 'Product permanently deleted'
      });
    } catch (error) {
      console.error('Hard delete product error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete product'
      });
    }
  }
);

// Delete product (Admin only — soft delete)
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
      const [total, active, featured, byCategory, bySport, byGender] = await Promise.all([
        Product.countDocuments(),
        Product.countDocuments({ active: true }),
        Product.countDocuments({ featured: true }),
        Product.aggregate([
          { $group: { _id: '$category', count: { $sum: 1 } } }
        ]),
        Product.aggregate([
          { $group: { _id: '$sport', count: { $sum: 1 } } }
        ]),
        Product.aggregate([
          { $group: { _id: '$gender', count: { $sum: 1 } } }
        ])
      ]);

      res.json({
        success: true,
        data: {
          total,
          active,
          featured,
          byCategory,
          bySport,
          byGender
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
