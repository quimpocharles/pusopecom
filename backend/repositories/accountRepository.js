import prisma from '../lib/prisma.js';
import * as userRepository from './userRepository.js';
import * as orderRepository from './orderRepository.js';
import * as wishlistRepository from './wishlistRepository.js';
import * as tryOnLogRepository from './tryOnLogRepository.js';
import * as notificationRepository from './notificationRepository.js';
import * as organizationRepository from './organizationRepository.js';

const PREVIEW_SIZE = 5;

/**
 * The Customer Portal's single dashboard-aggregation read. Every piece runs
 * in one Promise.all — mirrors orderRepository.getRevenueStats() and
 * productRepository.getAdminStats()'s existing parallel-count pattern
 * rather than a chain of sequential awaits.
 *
 * Deliberately does NOT include `recommendations` — that's
 * services/recommendationService.js's concern (reserved shape, no logic
 * yet), not a data-repository one.
 */
export async function getDashboardSummary(userId, { client = prisma } = {}) {
  const [
    profile,
    ordersCount,
    recentOrders,
    wishlistCount,
    wishlistPreview,
    tryOnsCount,
    recentTryOns,
    unreadNotificationsCount,
    recentNotifications,
    organizations,
  ] = await Promise.all([
    userRepository.findById(userId, { client }),
    orderRepository.count({ where: { userId }, client }),
    orderRepository.find({ where: { userId }, orderBy: { createdAt: 'desc' }, take: PREVIEW_SIZE, client }),
    wishlistRepository.count(userId, { client }),
    wishlistRepository.find({ userId, take: PREVIEW_SIZE, client }),
    tryOnLogRepository.countByUser(userId, { client }),
    tryOnLogRepository.findByUser({ userId, take: PREVIEW_SIZE, client }),
    notificationRepository.count(userId, { read: false, client }),
    notificationRepository.find({ userId, take: PREVIEW_SIZE, client }),
    organizationRepository.findPurchasedByUser(userId, { client }),
  ]);

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
    stats: {
      orders: ordersCount,
      wishlist: wishlistCount,
      tryOns: tryOnsCount,
      organizations: organizations.length,
      notifications: unreadNotificationsCount,
    },
    recentOrders,
    recentTryOns,
    wishlistPreview,
    notifications: recentNotifications,
    organizations,
  };
}

export default { getDashboardSummary };
