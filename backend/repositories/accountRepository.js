import prisma from '../lib/prisma.js';
import * as userRepository from './userRepository.js';
import * as orderRepository from './orderRepository.js';
import * as wishlistRepository from './wishlistRepository.js';
import * as tryOnLogRepository from './tryOnLogRepository.js';
import * as notificationRepository from './notificationRepository.js';
import * as followRepository from './followRepository.js';
import * as productRepository from './productRepository.js';

const PREVIEW_SIZE = 5;
// Same recency window ProductCard already uses for its "New" badge —
// reusing it here keeps "recent" meaning one consistent thing across the
// platform rather than each feature inventing its own definition.
const RECENT_DAYS = 14;
const MIN_REAL_MOMENTS = 4;
const FEED_CAP = 15;

const ORDER_STATUS_TITLE = {
  processing: 'Your order is being processed',
  confirmed: 'Your order is confirmed',
  shipped: 'Your order has shipped',
  delivered: 'Your order was delivered',
  cancelled: 'Your order was cancelled',
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
 */
export async function getHomeFeed(userId, { client = prisma } = {}) {
  const cutoff = recentCutoff();

  const [profile, recentOrders, recentTryOns, followedOrgIds, wishlistItems, unreadNotifications] =
    await Promise.all([
      userRepository.findById(userId, { client }),
      orderRepository.find({ where: { userId, updatedAt: { gte: cutoff } }, orderBy: { updatedAt: 'desc' }, take: PREVIEW_SIZE, client }),
      tryOnLogRepository.find({ where: { userId, success: true, createdAt: { gte: cutoff } }, orderBy: { createdAt: 'desc' }, take: PREVIEW_SIZE, client }),
      followRepository.followedOrganizationIds(userId, { client }),
      wishlistRepository.find({ userId, take: 30, client }),
      notificationRepository.find({ userId, read: false, take: PREVIEW_SIZE, client }),
    ]);

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
    feed,
  };
}

export default { getHomeFeed };
