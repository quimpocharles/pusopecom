import express from 'express';
import multer from 'multer';
import axios from 'axios';
import mongoose from 'mongoose';
import { generateTryOn as replicateGenerateTryOn } from '../services/replicateService.js';
import { generateTryOn as wavespeedGenerateTryOn } from '../services/wavespeedService.js';
import TryOnLog from '../models/TryOnLog.js';
import Product from '../models/Product.js';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Virtual try-on endpoint
router.post('/', upload.single('userImage'), async (req, res) => {
  try {
    const { productImageUrl, productName, productId } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload your photo'
      });
    }

    if (!productImageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Product image URL is required'
      });
    }

    let result;

    if (process.env.WAVESPEED_API_KEY) {
      // WaveSpeed path — passes buffer + public URL directly (no base64 conversion)
      result = await wavespeedGenerateTryOn(
        req.file.buffer,
        req.file.mimetype,
        productImageUrl,
        productName || 'clothing item'
      );
    } else {
      // Replicate path — existing flow (SeedDream 4.5)
      const userImageBase64 = req.file.buffer.toString('base64');

      let productImageBase64;
      try {
        const productImageResponse = await axios.get(productImageUrl, {
          responseType: 'arraybuffer'
        });
        productImageBase64 = Buffer.from(productImageResponse.data).toString('base64');
      } catch (fetchError) {
        return res.status(400).json({
          success: false,
          message: 'Failed to fetch product image'
        });
      }

      result = await replicateGenerateTryOn(
        userImageBase64,
        productImageBase64,
        productName || 'clothing item'
      );
    }

    // Fire-and-forget: log try-on attempt
    const logProductId = productId && mongoose.Types.ObjectId.isValid(productId)
      ? productId
      : null;
    const logPromise = (async () => {
      let resolvedProductId = logProductId;
      if (!resolvedProductId && productName) {
        const found = await Product.findOne({ name: productName }).select('_id').lean();
        if (found) resolvedProductId = found._id;
      }
      return TryOnLog.create({
        product: resolvedProductId || undefined,
        productName: productName || 'Unknown',
        productImage: productImageUrl,
        success: result.success
      });
    })().catch(err => console.error('TryOnLog write error:', err));

    if (result.success) {
      res.json({
        success: true,
        image: result.image
      });
    } else {
      res.status(422).json({
        success: false,
        message: result.message || 'Failed to generate try-on image. Please try again.'
      });
    }

  } catch (error) {
    console.error('Try-on error:', error);

    // Log failed attempt
    TryOnLog.create({
      productName: req.body?.productName || 'Unknown',
      productImage: req.body?.productImageUrl,
      success: false
    }).catch(err => console.error('TryOnLog write error:', err));

    const isRateLimit = error.message?.toLowerCase().includes('rate limit');
    res.status(isRateLimit ? 429 : 500).json({
      success: false,
      message: error.message || 'Failed to process virtual try-on'
    });
  }
});

export default router;
