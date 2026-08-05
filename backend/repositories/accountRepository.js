import prisma from '../lib/prisma.js';
import * as userRepository from './userRepository.js';
import * as orderRepository from './orderRepository.js';
import * as wishlistRepository from './wishlistRepository.js';
import * as tryOnLogRepository from './tryOnLogRepository.js';
import * as notificationRepository from './notificationRepository.js';
import * as followRepository from './followRepository.js';
import * as productRepository from './productRepository.js';
import * as paymentRepository from './paymentRepository.js';

const PREVIEW_SIZE = 5;
// Same recency window ProductCard already uses for its "New" badge —
// reusing it here keeps "recent" meaning one consistent thing across the
// platform rather than each feature inventing its own definition.
const RECENT_DAYS = 14;
const MIN_REAL_MOMENTS = 4;
const FEED_CAP = 15;

// Payment Platform Redesign, Phase 2 — matches the fuller OrderStatus
// vocabulary now. 'awaiting_payment' is deliberately absent: an unpaid
// order isn't a "your order" moment worth celebrating in the feed the way
// a real status change is — Phase 5's dedicated pendingPayments module
// (see getHomeFeed below) covers that case with its own, more actionable
// card instead.
const ORDER_STATUS_TITLE = {
  paid: 'Your order is confirmed',
  processing: 'Your order is being processed',
  packed: 'Your order has been packed',
  shipped: 'Your order has shipped',
  delivered: 'Your order was delivered',
  returned: 'Your return was received',
  cancelled: 'Your order was cancelled',
  expired: 'Your order has expired',
  failed_payment: 'Your payment did not go through',
  confirmed: 'Your order is confirmed', // legacy — no new order reaches this
};

const recentCutoff = () => new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);

/**
 * My PUSO's Home feed — composed live at read-time from existing data, not
 * a persisted event log (see docs/MY_PUSO_MANIFESTO.md and the plan this
 * shipped under: a FeedEvent table is the natural future upgrade once
 * signal volume justifies pagination/dismissal, not needed while most fans
 * have a handful of real signals).
 *
 * Every moment shares one shape — { id, type, title, body, image, link,
 * timestamp } — so the frontend renders one card component keyed by type,
 * not five different hand-built layouts. Real moments sort by recency;
 * if there are fewer than MIN_REAL_MOMENTS, trending products are appended
 * as filler so the feed is never empty — never a fabricated "recommendation
 * engine" (still explicitly deferred), just what's genuinely popular.
 *
 * Also returns `pendingPayments` — Resume Checkout (Payment Platform
 * Redesign, Phase 5), the platform's one always-first, non-negotiable
 * priority per the original spec's Home ordering. Kept as its own array
 * rather than folded into `feed`'s recency sort, since "always first
 * regardless of recency" isn't a sort order the shared moment shape (or
 * MomentCard) needs to grow a special case for.
 */
export async function getHomeFeed(userId, { client = prisma } = {}) {
  const cutoff = recentCutoff();

  const [profile, recentOrders, recentTryOns, followedOrgIds, wishlistItems, unreadNotifications, pendingOrders] =
    await Promise.all([
      userRepository.findById(userId, { client }),
      // 'awaiting_payment' orders are deliberately excluded here — they're
      // covered by the dedicated pendingPayments module below instead of the
      // generic "Order update" moment (see ORDER_STATUS_TITLE's own comment).
      orderRepository.find({ where: { userId, updatedAt: { gte: cutoff }, orderStatus: { not: 'awaiting_payment' } }, orderBy: { updatedAt: 'desc' }, take: PREVIEW_SIZE, client }),
      tryOnLogRepository.find({ where: { userId, success: true, deletedAt: null, createdAt: { gte: cutoff } }, orderBy: { createdAt: 'desc' }, take: PREVIEW_SIZE, client }),
      followRepository.followedOrganizationIds(userId, { client }),
      wishlistRepository.find({ userId, take: 30, client }),
      notificationRepository.find({ userId, read: false, take: PREVIEW_SIZE, client }),
      // Payment Platform Redesign, Phase 5 — Resume Checkout. Not windowed by
      // `cutoff` like the rest of the feed: a pending order stays actionable
      // (and worth surfacing) for its entire retention window, not just 14
      // days — Phase 4's expireStaleOrders sweep is what eventually removes it.
      orderRepository.find({ where: { userId, orderStatus: 'awaiting_payment' }, orderBy: { createdAt: 'desc' }, take: PREVIEW_SIZE, client }),
    ]);

  const latestPendingPayments = await paymentRepository.findLatestForOrders(
    pendingOrders.map((order) => order._id),
    { client }
  );
  const paymentByOrderId = new Map(latestPendingPayments.map((p) => [p.orderId, p]));

  // Sorted soonest-expiring-first — the fan closest to losing their reserved
  // stock is the one who most needs to see this. Same customer-safe payment
  // shape GET /:orderNumber already returns, so the frontend can hand it
  // straight to CompletePaymentButton without reshaping it.
  const pendingPayments = pendingOrders
    .map((order) => {
      const payment = paymentByOrderId.get(order._id);
      return {
        orderNumber: order.orderNumber,
        total: order.total,
        createdAt: order.createdAt,
        payment: payment
          ? { provider: payment.provider, status: payment.status, expiresAt: payment.expiresAt, checkoutUrl: payment.checkoutUrl }
          : null,
      };
    })
    .sort((a, b) => {
      const aExpires = a.payment?.expiresAt ? new Date(a.payment.expiresAt) : null;
      const bExpires = b.payment?.expiresAt ? new Date(b.payment.expiresAt) : null;
      if (!aExpires && !bExpires) return 0;
      if (!aExpires) return 1;
      if (!bExpires) return -1;
      return aExpires - bExpires;
    });

  const followedProducts = followedOrgIds.length
    ? await productRepository.find({
        where: { organizationId: { in: followedOrgIds }, active: true, createdAt: { gte: cutoff } },
        orderBy: { createdAt: 'desc' },
        take: PREVIEW_SIZE,
        include: { organization: true },
        client,
      })
    : [];

  const onSaleWishlistItems = wishlistItems.filter(
    (item) => item.product?.salePrice != null && item.product.salePrice < item.product.price
  );

  const moments = [
    ...recentOrders.map((order) => ({
      id: `order-${order._id}`,
      type: 'order',
      title: ORDER_STATUS_TITLE[order.orderStatus] || 'Order update',
      body: `Order #${order.orderNumber}`,
      image: order.items?.[0]?.image || null,
      link: `/order/${order.orderNumber}`,
      timestamp: order.updatedAt,
    })),
    ...recentTryOns.map((tryOn) => ({
      id: `fitcheck-${tryOn._id}`,
      type: 'fit-check',
      title: 'Your Fit Check is ready',
      body: tryOn.productName,
      image: tryOn.productImage || null,
      link: '/account/fit-check',
      timestamp: tryOn.createdAt,
    })),
    ...followedProducts.map((product) => ({
      id: `following-${product._id}`,
      type: 'following',
      title: `New from ${product.organization?.name || 'an organization you follow'}`,
      body: product.name,
      image: product.images?.[0] || null,
      link: `/products/${product.slug}`,
      timestamp: product.createdAt,
    })),
    ...onSaleWishlistItems.map((item) => ({
      id: `locker-${item._id}`,
      type: 'locker',
      title: 'Now on sale',
      body: item.product.name,
      image: item.product.images?.[0] || null,
      link: `/products/${item.product.slug}`,
      // "On sale" is a live state, not a dated event — there's no price
      // history to know when the sale actually started, so this is
      // honestly "now," not a fabricated timestamp.
      timestamp: new Date(),
    })),
    ...unreadNotifications.map((n) => ({
      id: `notification-${n._id}`,
      type: 'notification',
      title: n.title,
      body: n.body,
      image: null,
      link: n.link || null,
      timestamp: n.createdAt,
    })),
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  let feed = moments.slice(0, FEED_CAP);

  if (feed.length < MIN_REAL_MOMENTS) {
    const trending = await productRepository.find({
      where: { active: true },
      orderBy: [{ featured: 'desc' }, { totalSold: 'desc' }],
      take: MIN_REAL_MOMENTS + 2 - feed.length,
      client,
    });
    feed = feed.concat(
      trending.map((product) => ({
        id: `trending-${product._id}`,
        type: 'trending',
        title: 'Trending in Philippine Sports',
        body: product.name,
        image: product.images?.[0] || null,
        link: `/products/${product.slug}`,
        timestamp: null,
      }))
    );
  }

  return {
    profile: profile
      ? {
          _id: profile._id,
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          avatar: profile.avatar,
          memberSince: profile.createdAt,
        }
      : null,
    pendingPayments,
    feed,
  };
}

export default { getHomeFeed };
