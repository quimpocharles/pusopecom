import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import prisma from './lib/prisma.js';
import * as productRepository from './repositories/productRepository.js';
import { generateAndSendDailySalesReport } from './services/dailySalesService.js';

// Import routes
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import tryonRoutes from './routes/tryon.js';
import reviewRoutes from './routes/reviews.js';
import leagueRoutes from './routes/leagues.js';
import reportRoutes from './routes/reports.js';
import uploadRoutes from './routes/upload.js';
import settingsRoutes from './routes/settings.js';
import activityRoutes from './routes/activity.js';
import shippingRoutes from './routes/shipping.js';
import pickupRoutes from './routes/pickup.js';

// Create Express app
const app = express();

// Trust Railway/Vercel reverse proxy (required for express-rate-limit)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "http://localhost:5001", "https:"],
    }
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from public folder
app.use('/images', express.static('public/images'));

// Rate limiting (disabled in development)
const isDev = process.env.NODE_ENV === 'development';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  skip: () => isDev
});

app.use('/api/', limiter);

// Stricter rate limit for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many authentication attempts, please try again later.',
  skip: () => isDev
});

app.use('/api/auth/', authLimiter);

// Try-on rate limits (Replicate API is expensive)
const tryonUserLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // per user (IP)
  message: "You've reached the try-on limit. Please try again in an hour.",
  skip: () => isDev
});

const tryonGlobalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 500, // across all users
  keyGenerator: () => 'global_tryon',
  message: 'Virtual try-on is temporarily unavailable due to high demand. Please try again later.',
  skip: () => isDev
});

app.use('/api/tryon', tryonGlobalLimiter, tryonUserLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tryon', tryonRoutes);
app.use('/api/products', reviewRoutes);
app.use('/api/leagues', leagueRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/admin/pickup', pickupRoutes);

// Sitemap endpoint
app.get('/api/sitemap.xml', async (req, res) => {
  try {
    const products = await productRepository.find({ where: { active: true } });
    const baseUrl = process.env.FRONTEND_URL || 'https://pusostore.com';

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    const staticPages = ['/', '/products'];
    for (const page of staticPages) {
      xml += `  <url><loc>${baseUrl}${page}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n`;
    }

    for (const product of products) {
      xml += `  <url><loc>${baseUrl}/products/${product.slug}</loc><lastmod>${product.updatedAt.toISOString()}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
    }

    xml += '</urlset>';
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('Sitemap error:', error);
    res.status(500).send('Failed to generate sitemap');
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// Schedule daily sales report at 11:59 PM Philippine time (UTC+8)
cron.schedule('59 23 * * *', async () => {
  try {
    await generateAndSendDailySalesReport();
  } catch (error) {
    console.error('Daily sales report failed:', error);
  }
}, { timezone: 'Asia/Manila' });

// Start server — the database check runs first and blocks listen, so the
// app fails fast on a bad DATABASE_URL instead of accepting traffic it
// can't serve. (The original mongoose.connect() call didn't actually
// block app.listen() either; blocking here is a deliberate hardening
// while this exact bootstrap code is already being touched to drop
// mongoose entirely.)
const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('Connected to PostgreSQL');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  await prisma.$disconnect();
  process.exit(0);
});

export default app;
