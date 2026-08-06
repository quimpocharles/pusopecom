import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// Exported — Enterprise Fulfillment Blueprint, Phase 2 reuses this exact
// upload mechanics for customer-submitted return photos (routes/returns.js),
// with its own folder rather than a second copy of the stream-upload logic
// and its documented Cloudinary SDK unhandled-rejection workaround below.
export const uploadToCloudinary = (buffer, folder = 'puso-shop/products') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        transformation: [
          { width: 1200, height: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
        ],
        // cloudinary@1.41.3's call_api() creates an internal Q deferred for
        // every upload but never exposes it when options.stream is set — on
        // any upload error (e.g. a DNS failure reaching Cloudinary) that
        // deferred is rejected with nothing ever attached to consume it, and
        // Q's own unhandled-rejection tracker forwards that straight to
        // process's real 'unhandledRejection' event, independently of our
        // own callback/stream handling below. server.js exits the whole
        // process on that event, so a single failed upload was taking the
        // server down. disable_promises skips that internal bookkeeping
        // entirely — verified via a direct repro against the real SDK.
        disable_promises: true,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    // The stream itself can also emit 'error' independently of the callback
    // above — an EventEmitter's unhandled 'error' event throws synchronously
    // with no listener here, so this still needs its own handler.
    stream.on('error', reject);
    stream.end(buffer);
  });
};

// Single image upload
router.post('/', authenticate, isAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    const result = await uploadToCloudinary(req.file.buffer);

    res.json({
      success: true,
      data: { url: result.secure_url, publicId: result.public_id },
    });
  } catch (error) {
    logger.error({ err: error }, 'Upload error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to upload image' });
  }
});

// Multiple image upload
router.post('/multiple', authenticate, isAdmin, upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No image files provided' });
    }

    const results = await Promise.all(
      req.files.map((file) => uploadToCloudinary(file.buffer))
    );

    res.json({
      success: true,
      data: results.map((r) => ({ url: r.secure_url, publicId: r.public_id })),
    });
  } catch (error) {
    logger.error({ err: error }, 'Upload error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to upload images' });
  }
});

// Video upload (for try-on ad)
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  },
});

router.post('/video', authenticate, isAdmin, videoUpload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No video file provided' });
    }
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'puso-shop/ads', resource_type: 'video', disable_promises: true },
        (error, result) => { if (error) reject(error); else resolve(result); }
      );
      stream.on('error', reject); // see the matching comment on uploadToCloudinary above
      stream.end(req.file.buffer);
    });
    res.json({ success: true, data: { url: result.secure_url, publicId: result.public_id } });
  } catch (error) {
    logger.error({ err: error }, 'Video upload error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to upload video' });
  }
});

// Multer error handler
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err.message === 'Only image files are allowed') {
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
});

export default router;
