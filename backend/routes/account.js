import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import * as userRepository from '../repositories/userRepository.js';
import * as orderRepository from '../repositories/orderRepository.js';
import * as wishlistRepository from '../repositories/wishlistRepository.js';
import * as tryOnLogRepository from '../repositories/tryOnLogRepository.js';
import * as notificationRepository from '../repositories/notificationRepository.js';
import * as organizationRepository from '../repositories/organizationRepository.js';
import * as followRepository from '../repositories/followRepository.js';
import * as accountRepository from '../repositories/accountRepository.js';
import * as accountCache from '../lib/accountCache.js';
import * as recommendationService from '../services/recommendationService.js';

const router = express.Router();

// Every route on this router is mounted behind `authenticate` (see
// server.js), so req.user is always present here. None of these routes
// take a :userId param — they always read req.user._id, which structurally
// removes the "did we check ownership correctly" bug class that
// /api/orders/user/:userId (left untouched — still used by Orders.jsx) has
// to guard against manually on every request.

const paginationParams = (req, defaultLimit = 10) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Number(req.query.limit) || defaultLimit);
  return { page, limit, skip: (page - 1) * limit };
};

const paginationMeta = (page, limit, total) => ({
  page,
  limit,
  total,
  pages: Math.ceil(total / limit),
});

// GET /api/account/home — My PUSO's Home: a live-composed feed of what
// changed since the fan's last visit (see accountRepository.getHomeFeed and
// docs/MY_PUSO_MANIFESTO.md), cached ~60s.
router.get('/home', async (req, res) => {
  try {
    const home = await accountCache.getOrSetHome(req.user._id, () =>
      accountRepository.getHomeFeed(req.user._id)
    );
    const recommendations = await recommendationService.getRecommendations(req.user._id);

    res.json({ success: true, data: { ...home, recommendations } });
  } catch (error) {
    logger.error({ err: error }, 'Get home feed error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to load home' });
  }
});

// GET /api/account/orders
router.get('/orders', async (req, res) => {
  try {
    const { page, limit, skip } = paginationParams(req);
    const { status } = req.query;
    const where = { userId: req.user._id, ...(status && { orderStatus: status }) };

    const [orders, total] = await Promise.all([
      orderRepository.find({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { items: { include: { product: true } } },
      }),
      orderRepository.count({ where }),
    ]);

    res.json({ success: true, data: orders, pagination: paginationMeta(page, limit, total) });
  } catch (error) {
    logger.error({ err: error }, 'Get account orders error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to load orders' });
  }
});

// GET /api/account/orders/:orderNumber
router.get('/orders/:orderNumber', async (req, res) => {
  try {
    const order = await orderRepository.findByOrderNumber(req.params.orderNumber, {
      include: { items: { include: { product: true } } },
    });
    if (!order || order.user !== req.user._id) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    logger.error({ err: error }, 'Get account order error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to load order' });
  }
});

// GET /api/account/try-ons
router.get('/try-ons', async (req, res) => {
  try {
    const { page, limit, skip } = paginationParams(req);
    const success = req.query.success !== undefined ? req.query.success === 'true' : undefined;
    const favorited = req.query.favorited !== undefined ? req.query.favorited === 'true' : undefined;
    const purchasedOnly = req.query.purchased === 'true';

    // Fetched once per request regardless of the purchased filter — every
    // row's `purchased`/`purchasedOrderNumber` badge needs it either way,
    // not just the filtered view. Real query, not N+1 per try-on.
    const purchasedMap = await orderRepository.findPurchasedProductMap(req.user._id);
    const purchasedProductIds = [...purchasedMap.keys()];

    if (purchasedOnly && purchasedProductIds.length === 0) {
      return res.json({ success: true, data: [], pagination: paginationMeta(page, limit, 0) });
    }

    const filterArgs = {
      userId: req.user._id,
      success,
      favorited,
      ...(purchasedOnly && { productIdIn: purchasedProductIds }),
    };

    const [tryOns, total] = await Promise.all([
      tryOnLogRepository.findByUser({ ...filterArgs, skip, take: limit }),
      tryOnLogRepository.countByUser(req.user._id, filterArgs),
    ]);

    const enriched = tryOns.map((t) => {
      // withRelationFallback collapses productId into `product` (either the
      // populated object, when included, or the bare id as a fallback) —
      // there is no top-level `productId` left to read on the serialized row.
      const productId = t.product?._id || (typeof t.product === 'string' ? t.product : null);
      return {
        ...t,
        purchased: !!productId && purchasedMap.has(productId),
        purchasedOrderNumber: productId ? purchasedMap.get(productId) || null : null,
      };
    });

    res.json({ success: true, data: enriched, pagination: paginationMeta(page, limit, total) });
  } catch (error) {
    logger.error({ err: error }, 'Get account try-ons error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to load try-on history' });
  }
});

// GET /api/account/try-ons/:id
router.get('/try-ons/:id', async (req, res) => {
  try {
    const [tryOn] = await tryOnLogRepository.find({
      where: { id: req.params.id, userId: req.user._id, deletedAt: null },
      include: { product: { include: { sizes: true, colors: { include: { sizes: true } } } } },
    });
    if (!tryOn) {
      return res.status(404).json({ success: false, message: 'Try-on not found' });
    }
    res.json({ success: true, data: tryOn });
  } catch (error) {
    logger.error({ err: error }, 'Get account try-on error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to load try-on' });
  }
});

// DELETE /api/account/try-ons/:id — soft delete. Confirmation happens
// client-side; this endpoint just marks deletedAt, never removes the row
// (docs/... Fit Check plan — admins can still see it, the Cloudinary asset
// is destroyed only much later by the existing 90-day cleanup cron).
router.delete('/try-ons/:id', async (req, res) => {
  try {
    const removed = await tryOnLogRepository.softDelete(req.params.id, req.user._id);
    if (!removed) {
      return res.status(404).json({ success: false, message: 'Try-on not found' });
    }
    await accountCache.invalidateHome(req.user._id);
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Delete try-on error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to delete try-on' });
  }
});

router.patch('/try-ons/:id/favorite', async (req, res) => {
  try {
    const { favorited } = req.body;
    if (typeof favorited !== 'boolean') {
      return res.status(400).json({ success: false, message: 'favorited must be a boolean' });
    }
    const updated = await tryOnLogRepository.setFavorite(req.params.id, req.user._id, favorited);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Try-on not found' });
    }
    res.json({ success: true, data: { favorited } });
  } catch (error) {
    logger.error({ err: error }, 'Favorite try-on error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update favorite' });
  }
});

// GET /api/account/wishlist
router.get('/wishlist', async (req, res) => {
  try {
    const { page, limit, skip } = paginationParams(req);

    const [items, total] = await Promise.all([
      wishlistRepository.find({ userId: req.user._id, skip, take: limit }),
      wishlistRepository.count(req.user._id),
    ]);

    res.json({ success: true, data: items, pagination: paginationMeta(page, limit, total) });
  } catch (error) {
    logger.error({ err: error }, 'Get wishlist error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to load wishlist' });
  }
});

router.post('/wishlist/:productId', async (req, res) => {
  try {
    const item = await wishlistRepository.add(req.user._id, req.params.productId);
    await accountCache.invalidateHome(req.user._id);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    logger.error({ err: error }, 'Add to wishlist error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to add to wishlist' });
  }
});

router.delete('/wishlist/:productId', async (req, res) => {
  try {
    const removed = await wishlistRepository.remove(req.user._id, req.params.productId);
    if (!removed) {
      return res.status(404).json({ success: false, message: 'Not in wishlist' });
    }
    await accountCache.invalidateHome(req.user._id);
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Remove from wishlist error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to remove from wishlist' });
  }
});

// GET /api/account/following — My PUSO's Following (docs/MY_PUSO_MANIFESTO.md
// § Following). Mirrors the wishlist route trio exactly.
router.get('/following', async (req, res) => {
  try {
    const { page, limit, skip } = paginationParams(req);

    const [items, total] = await Promise.all([
      followRepository.find({ userId: req.user._id, skip, take: limit }),
      followRepository.count(req.user._id),
    ]);

    res.json({ success: true, data: items, pagination: paginationMeta(page, limit, total) });
  } catch (error) {
    logger.error({ err: error }, 'Get following error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to load following' });
  }
});

router.post('/following/:organizationId', async (req, res) => {
  try {
    const item = await followRepository.follow(req.user._id, req.params.organizationId);
    await accountCache.invalidateHome(req.user._id);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }
    logger.error({ err: error }, 'Follow organization error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to follow organization' });
  }
});

router.delete('/following/:organizationId', async (req, res) => {
  try {
    const removed = await followRepository.unfollow(req.user._id, req.params.organizationId);
    if (!removed) {
      return res.status(404).json({ success: false, message: 'Not following this organization' });
    }
    await accountCache.invalidateHome(req.user._id);
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Unfollow organization error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to unfollow organization' });
  }
});

// GET /api/account/organizations — purchased-from, derived, not paginated
// (see accountRepository/organizationRepository.findPurchasedByUser — no
// follow/favorite feature exists, this reflects real order history only).
router.get('/organizations', async (req, res) => {
  try {
    const organizations = await organizationRepository.findPurchasedByUser(req.user._id);
    res.json({ success: true, data: organizations });
  } catch (error) {
    logger.error({ err: error }, 'Get account organizations error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to load organizations' });
  }
});

// GET /api/account/addresses — read-only; mutations stay at the existing
// /api/auth/addresses/* routes (single source of truth, untouched).
router.get('/addresses', async (req, res) => {
  try {
    const { page, limit, skip } = paginationParams(req);
    const user = await userRepository.findById(req.user._id);
    const all = user?.addresses || [];
    const paged = all.slice(skip, skip + limit);

    res.json({ success: true, data: paged, pagination: paginationMeta(page, limit, all.length) });
  } catch (error) {
    logger.error({ err: error }, 'Get account addresses error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to load addresses' });
  }
});

// GET/PUT /api/account/profile — PUT delegates to the same repository
// function /api/auth/profile already uses; no duplicated update logic.
router.get('/profile', async (req, res) => {
  try {
    const user = await userRepository.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({
      success: true,
      data: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatar: user.avatar,
        authProvider: user.authProvider,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Get account profile error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to load profile' });
  }
});

router.put('/profile', async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;
    if (!firstName || !lastName) {
      return res.status(400).json({ success: false, message: 'First and last name are required' });
    }

    const updates = { firstName, lastName };
    if (phone !== undefined) updates.phone = phone;

    const user = await userRepository.updateById(req.user._id, updates);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await accountCache.invalidateHome(req.user._id);
    res.json({ success: true, data: { _id: user._id, firstName: user.firstName, lastName: user.lastName, phone: user.phone } });
  } catch (error) {
    logger.error({ err: error }, 'Update account profile error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

// GET /api/account/notifications
router.get('/notifications', async (req, res) => {
  try {
    const { page, limit, skip } = paginationParams(req);
    const read = req.query.read !== undefined ? req.query.read === 'true' : undefined;

    const [notifications, total] = await Promise.all([
      notificationRepository.find({ userId: req.user._id, read, skip, take: limit }),
      notificationRepository.count(req.user._id, { read }),
    ]);

    res.json({ success: true, data: notifications, pagination: paginationMeta(page, limit, total) });
  } catch (error) {
    logger.error({ err: error }, 'Get notifications error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to load notifications' });
  }
});

// PATCH /api/account/notifications/read — body: { ids: [...] } marks those
// specific notifications; omitted marks all unread as read.
router.patch('/notifications/read', async (req, res) => {
  try {
    const { ids } = req.body;
    const count = Array.isArray(ids) && ids.length > 0
      ? await notificationRepository.markRead(req.user._id, ids)
      : await notificationRepository.markAllRead(req.user._id);

    await accountCache.invalidateHome(req.user._id);
    res.json({ success: true, data: { updated: count } });
  } catch (error) {
    logger.error({ err: error }, 'Mark notifications read error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update notifications' });
  }
});

// GET /api/account/security — real fields only. No "active sessions" list:
// session revocation isn't built yet, so that's honestly absent rather
// than faked.
router.get('/security', async (req, res) => {
  try {
    const user = await userRepository.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({
      success: true,
      data: {
        authProvider: user.authProvider,
        emailVerified: user.emailVerified,
        accountLocked: user.accountLocked,
        failedLoginAttempts: user.failedLoginAttempts,
        memberSince: user.createdAt,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Get account security error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to load security info' });
  }
});

export default router;
