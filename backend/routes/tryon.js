import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import multer from 'multer';
import axios from 'axios';
import cloudinary from '../config/cloudinary.js';
import { generateTryOn as replicateGenerateTryOn } from '../services/replicateService.js';
import { generateTryOn as wavespeedGenerateTryOn } from '../services/wavespeedService.js';
import * as tryOnLogRepository from '../repositories/tryOnLogRepository.js';
import * as productRepository from '../repositories/productRepository.js';
import * as accountCache from '../lib/accountCache.js';
import * as fitCheckQuota from '../lib/fitCheckQuota.js';
import * as bonusFitCheckGrantRepository from '../repositories/bonusFitCheckGrantRepository.js';
import { optionalAuth, authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Bumped whenever the WaveSpeed prompt in wavespeedService.js changes
// meaningfully, so old Fit Check rows keep recording which prompt actually
// produced them rather than silently reading as whatever the current one is.
const PROMPT_VERSION = 'v1';

// Real per-model prices, matching wavespeedService.js's own documented
// comments — not invented. Replicate has no per-call price published here,
// so its rows simply carry no costUsd rather than a guessed number.
const MODEL_COST_USD = {
  seedream: 0.035,
  'nano-banana-2': 0.07,
  'nano-banana-pro': 0.14,
};

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

// Records which provider/model actually served the request — read once per
// request so a mid-flight env var change never mislabels an in-progress
// attempt. Split into two real fields (not the old compound
// "wavespeed:nano-banana-2" string) now that the Fit Check gallery needs
// them separately filterable/reportable.
function currentProviderAndModel() {
  if (process.env.WAVESPEED_API_KEY) {
    return { provider: 'wavespeed', aiModel: (process.env.WAVESPEED_MODEL || 'seedream').toLowerCase() };
  }
  return { provider: 'replicate', aiModel: null };
}

/**
 * Durably re-hosts the AI result on Cloudinary — neither provider's own
 * image reference is meant to last (WaveSpeed's is provider-hosted and
 * time-limited; Replicate returns a raw base64 data URI, not a URL at
 * all). cloudinary.uploader.upload() accepts a remote https URL or a
 * base64 data URI as-is, so both provider shapes go through the same call.
 * A distinct folder from the temporary one the user's own uploaded photo
 * passes through — this asset is never auto-deleted (see
 * tryOnLogRepository.deleteOlderThan for the eventual cleanup policy).
 */
async function uploadGeneratedImage(imageRef) {
  const result = await cloudinary.uploader.upload(imageRef, { folder: 'puso-shop/tryon-results' });
  return { url: result.secure_url, publicId: result.public_id };
}

// GET /api/tryon/quota — read-only allowance status, powers the "3/5
// Remaining, Resets in 14h 12m" display shown throughout the experience.
// Unauthenticated-friendly on purpose: a guest's own 1/day allowance needs
// to be visible before they've ever logged in, so this can't live behind
// the authenticate-gated /api/account/* router the way the rest of the
// Fit Check gallery does.
router.get('/quota', optionalAuth, async (req, res) => {
  try {
    const status = await fitCheckQuota.getStatus({
      userId: req.user?._id,
      sessionId: req.user ? undefined : req.query.sessionId,
      tier: req.user?.subscriptionTier,
    });
    res.json({ success: true, data: status });
  } catch (error) {
    logger.error({ err: error }, 'Get Fit Check quota error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to load Fit Check quota' });
  }
});

// Virtual try-on endpoint
// optionalAuth added for the Customer Portal's per-user try-on history —
// the shared frontend api client already attaches the bearer token to every
// request when logged in, so this attributes try-ons to an account with no
// frontend change needed. Guest behavior is unchanged (req.user stays
// undefined). sessionId (guest attribution, mirrors activity.js's
// convention) is now sent by the frontend for guest requests — see
// VirtualTryOn.jsx — and also powers the daily quota check below.
router.post('/', optionalAuth, upload.single('userImage'), async (req, res) => {
  const { provider, aiModel } = currentProviderAndModel();
  const costUsd = aiModel ? MODEL_COST_USD[aiModel] ?? null : null;
  let genStart;

  try {
    const { productImageUrl, productName, productId, sessionId } = req.body;

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

    // Daily allowance — checked and consumed atomically (one Redis INCR)
    // before the AI call, so a request that's over quota never reaches the
    // paid provider at all. Sponsored-campaign overrides and bonus grants
    // are explicitly future phases (see docs/... Fit Check roadmap) — this
    // is the base tier-limit check only.
    let quotaStatus;
    try {
      quotaStatus = await fitCheckQuota.consume({
        userId: req.user?._id,
        sessionId: req.user ? undefined : sessionId,
        tier: req.user?.subscriptionTier,
      });
    } catch (quotaError) {
      if (quotaError instanceof fitCheckQuota.QuotaExceededError) {
        return res.status(429).json({ success: false, message: quotaError.message, quota: quotaError.status });
      }
      throw quotaError;
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

      // The generated result is the Fit Check gallery's hero image — durably
      // re-upload it before writing the row. A failed re-upload still
      // writes the row (generatedImageUrl stays null, frontend treats that
      // as "image unavailable"), it just doesn't lose the log entry.
      let generatedImageUrl;
      let generatedImagePublicId;
      if (result.success && result.image) {
        try {
          const uploaded = await uploadGeneratedImage(result.image);
          generatedImageUrl = uploaded.url;
          generatedImagePublicId = uploaded.publicId;
        } catch (uploadError) {
          logger.error({ err: uploadError }, 'Failed to persist Fit Check result image');
        }
      }

      const logged = await tryOnLogRepository.create({
        productId: resolvedProductId || undefined,
        productName: productName || 'Unknown',
        productImage: productImageUrl,
        success: result.success,
        provider,
        aiModel,
        promptVersion: PROMPT_VERSION,
        costUsd,
        generatedImageUrl,
        generatedImagePublicId,
        durationMs,
        userId: req.user?._id,
        sessionId: req.user ? undefined : (req.body?.sessionId || undefined),
      });
      if (req.user) await accountCache.invalidateHome(req.user._id);
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
        message: result.message || 'Failed to generate Fit Check image. Please try again.'
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
      aiModel,
      promptVersion: PROMPT_VERSION,
      costUsd,
      durationMs,
      userId: req.user?._id,
      sessionId: req.user ? undefined : (req.body?.sessionId || undefined),
    })
      .then(() => req.user && accountCache.invalidateHome(req.user._id))
      .catch(err => logger.error({ err }, 'TryOnLog write error'));

    const isRateLimit = error.message?.toLowerCase().includes('rate limit');
    res.status(isRateLimit ? 429 : 500).json({
      success: false,
      message: error.message || 'Failed to process Fit Check'
    });
  }
});

// GET /api/tryon/admin/bonus-grants/:userId — a user's full Bonus Fit
// Check ledger + current balance, backing the admin grant panel (Phase 2:
// "configurable from the Admin Dashboard" implies inspectable/reportable,
// not just a bigger number — see BonusFitCheckGrant's schema comment).
router.get('/admin/bonus-grants/:userId', authenticate, isAdmin, async (req, res) => {
  try {
    const [grants, balance] = await Promise.all([
      bonusFitCheckGrantRepository.findByUser(req.params.userId),
      bonusFitCheckGrantRepository.getBalance(req.params.userId),
    ]);
    res.json({ success: true, data: { grants, balance } });
  } catch (error) {
    logger.error({ err: error }, 'Get Fit Check bonus grants error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to load bonus grants' });
  }
});

// POST /api/tryon/admin/bonus-grant — a human admin manually grants bonus
// Fit Checks to one user (reason: admin_grant). Always creates a new row —
// unlike the event-triggered reasons, an admin can grant to the same user
// more than once on purpose, so there's no idempotency guard here.
router.post('/admin/bonus-grant', authenticate, isAdmin, async (req, res) => {
  try {
    const { userId, amount, note } = req.body;
    const parsedAmount = Number(amount);

    if (!userId || !Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'A userId and a positive whole-number amount are required' });
    }

    const grantRow = await bonusFitCheckGrantRepository.grant(userId, 'admin_grant', parsedAmount, { note });
    res.status(201).json({ success: true, data: grantRow });
  } catch (error) {
    logger.error({ err: error }, 'Grant Fit Check bonus error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to grant Fit Checks' });
  }
});

export default router;
