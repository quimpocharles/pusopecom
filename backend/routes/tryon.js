import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import multer from 'multer';
import axios from 'axios';
import { generateTryOn as replicateGenerateTryOn } from '../services/replicateService.js';
import { generateTryOn as wavespeedGenerateTryOn } from '../services/wavespeedService.js';
import * as tryOnLogRepository from '../repositories/tryOnLogRepository.js';
import * as productRepository from '../repositories/productRepository.js';
import * as accountCache from '../lib/accountCache.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

// Records which provider/model actually served the request, e.g.
// "wavespeed:nano-banana-2" or "replicate" — read once per request so a
// mid-flight env var change never mislabels an in-progress attempt.
function currentProvider() {
  return process.env.WAVESPEED_API_KEY
    ? `wavespeed:${(process.env.WAVESPEED_MODEL || 'seedream').toLowerCase()}`
    : 'replicate';
}

// Virtual try-on endpoint
// optionalAuth added for the Customer Portal's per-user try-on history —
// the shared frontend api client already attaches the bearer token to every
// request when logged in, so this attributes try-ons to an account with no
// frontend change needed. Guest behavior is unchanged (req.user stays
// undefined). sessionId (guest attribution, mirrors activity.js's
// convention) isn't sent by the frontend to this endpoint yet — stays
// undefined until that's wired up separately.
router.post('/', optionalAuth, upload.single('userImage'), async (req, res) => {
  const provider = currentProvider();
  let genStart;

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
    genStart = Date.now();

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

    const durationMs = Date.now() - genStart;

    // Fire-and-forget: log try-on attempt
    const logProductId = productId && UUID_RE.test(productId)
      ? productId
      : null;
    const logPromise = (async () => {
      let resolvedProductId = logProductId;
      if (!resolvedProductId && productName) {
        const [found] = await productRepository.find({ where: { name: productName }, take: 1 });
        if (found) resolvedProductId = found._id;
      }
      const logged = await tryOnLogRepository.create({
        productId: resolvedProductId || undefined,
        productName: productName || 'Unknown',
        productImage: productImageUrl,
        success: result.success,
        provider,
        durationMs,
        userId: req.user?._id,
        sessionId: req.user ? undefined : (req.body?.sessionId || undefined),
      });
      if (req.user) await accountCache.invalidateDashboard(req.user._id);
      return logged;
    })().catch(err => logger.error({ err }, 'TryOnLog write error'));

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
    logger.error({ err: error }, 'Try-on error');
    Sentry.captureException(error);

    // Log failed attempt — durationMs is null if the failure happened
    // before genStart was set (e.g. validation errors never reach the provider)
    const durationMs = genStart ? Date.now() - genStart : null;
    tryOnLogRepository.create({
      productName: req.body?.productName || 'Unknown',
      productImage: req.body?.productImageUrl,
      success: false,
      provider,
      durationMs,
      userId: req.user?._id,
      sessionId: req.user ? undefined : (req.body?.sessionId || undefined),
    })
      .then(() => req.user && accountCache.invalidateDashboard(req.user._id))
      .catch(err => logger.error({ err }, 'TryOnLog write error'));

    const isRateLimit = error.message?.toLowerCase().includes('rate limit');
    res.status(isRateLimit ? 429 : 500).json({
      success: false,
      message: error.message || 'Failed to process virtual try-on'
    });
  }
});

export default router;
