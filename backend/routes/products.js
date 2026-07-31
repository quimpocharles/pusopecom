import express from 'express';
import { body, validationResult } from 'express-validator';
import * as productRepository from '../repositories/productRepository.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

const sortMap = {
  'alphabetical': 'name',
  'newest': '-createdAt',
  'most-bought': '-totalSold',
  'trending': '-totalViews',
};

// Get all products with filters
router.get('/', async (req, res) => {
  try {
    const {
      sport, team, league, category, gender, sale, minPrice, maxPrice,
      search, featured, page = 1, limit = 12, sort = '-createdAt'
    } = req.query;

    const resolvedSort = sortMap[sort] || sort;
    const { field, direction } = productRepository.parseSort(resolvedSort);
    const skip = (Number(page) - 1) * Number(limit);

    let products;
    let total;

    if (search) {
      const result = await productRepository.search({
        query: search, active: true, sport, team, league, category, gender, sale, minPrice, maxPrice, featured,
        sortField: field, sortDirection: direction, skip, take: Number(limit),
      });
      products = result.products;
      total = result.total;
    } else {
      const where = productRepository.buildListingWhere({
        active: true, sport, team, league, category, gender, sale, minPrice, maxPrice, featured,
      });
      [products, total] = await Promise.all([
        productRepository.find({ where, orderBy: { [field]: direction }, skip, take: Number(limit) }),
        productRepository.count({ where }),
      ]);
    }

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

// Export all products as CSV (Admin only)
router.get('/admin/export',
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const products = await productRepository.find({ where: {}, orderBy: { name: 'asc' } });

      const SIZE_COLS = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

      const escape = (val) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const headers = ['Item(s)', ...SIZE_COLS, 'QTY', 'Unit Price'];

      const rows = products.map((p) => {
        // Aggregate stock per size (handles both simple sizes and color variants)
        const sizeMap = {};
        if (p.colors && p.colors.length > 0) {
          for (const color of p.colors) {
            for (const s of color.sizes || []) {
              sizeMap[s.size] = (sizeMap[s.size] || 0) + s.stock;
            }
          }
        } else {
          for (const s of p.sizes || []) {
            sizeMap[s.size] = (sizeMap[s.size] || 0) + s.stock;
          }
        }

        const unitPrice = (p.salePrice || p.price).toFixed(2);
        const sizeCells = SIZE_COLS.map(sz => escape(sizeMap[sz] > 0 ? sizeMap[sz] : ''));

        return [escape(p.name), ...sizeCells, escape(p.totalStock), escape(unitPrice)].join(',');
      });

      const csv = [headers.join(','), ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="inventory-report.csv"');
      res.send(csv);
    } catch (error) {
      console.error('Export products error:', error);
      res.status(500).json({ success: false, message: 'Failed to export products' });
    }
  }
);

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

      const where = {};
      if (category) where.category = category;
      if (sport) where.sport = sport;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { team: { contains: search, mode: 'insensitive' } }
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);

      const [products, total] = await Promise.all([
        productRepository.find({ where, orderBy: { createdAt: 'desc' }, skip, take: Number(limit) }),
        productRepository.count({ where }),
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
      const product = await productRepository.findById(req.params.id);

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
    const cartProducts = await productRepository.find({ where: { id: { in: ids } } });

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
      recommendations = await productRepository.find({
        where: {
          active: true,
          id: { notIn: ids },
          category: { in: [...complementaryCategories] },
          sport: { in: [...sports] },
          totalStock: { gt: 0 }
        },
        take: Number(limit),
      });
    }

    // Fall back to popular products in the same sport if not enough
    if (recommendations.length < Number(limit)) {
      const existing = new Set([...ids, ...recommendations.map(r => r._id)]);
      const fallback = await productRepository.find({
        where: {
          active: true,
          id: { notIn: [...existing] },
          sport: { in: [...sports] },
          totalStock: { gt: 0 }
        },
        orderBy: [{ featured: 'desc' }, { reviewCount: 'desc' }],
        take: Number(limit) - recommendations.length,
      });

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

    // Prisma's `contains` is a plain string match, not a regex — unlike the
    // old Mongo $regex path, there's no need to escape user input here.
    const products = await productRepository.find({
      where: { active: true, name: { contains: q, mode: 'insensitive' } },
      take: 6,
    });

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
    const product = await productRepository.findBySlug(req.params.slug);

    if (!product || !product.active) {
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
    body('category').isIn(['jersey', 'tshirt', 'cap', 'shorts', 'accessories', 'jacket', 'sweatshirt', 'hoodie']),
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

      const product = await productRepository.create(req.body);

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: product
      });
    } catch (error) {
      console.error('Create product error:', error);
      if (error.code === 'P2002') {
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
      const product = await productRepository.updateById(req.params.id, req.body);

      res.json({
        success: true,
        message: 'Product updated successfully',
        data: product
      });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
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
      await productRepository.deleteById(req.params.id);

      res.json({
        success: true,
        message: 'Product permanently deleted'
      });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
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
      await productRepository.updateById(req.params.id, { active: false });

      res.json({
        success: true,
        message: 'Product deleted successfully'
      });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
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
      const stats = await productRepository.getAdminStats();

      res.json({
        success: true,
        data: stats
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
