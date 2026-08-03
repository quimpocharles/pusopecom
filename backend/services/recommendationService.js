/**
 * Reserved seam for the Customer Portal's recommendation engine — the shape
 * exists so the dashboard response never needs a breaking change when this
 * is implemented, but no logic runs yet (explicit scoping decision, not an
 * oversight).
 *
 * Intended future signals, once built: organizations purchased from
 * (organizationRepository.findPurchasedByUser), order history
 * (orderRepository), try-on history (tryOnLogRepository.findByUser),
 * wishlist (wishlistRepository.find), recently viewed
 * (userActivityRepository.find with type: 'view'), preferred sizes (no
 * signal exists yet — would need its own tracking), and trending products
 * (productRepository, e.g. totalSold/totalViews over a recent window).
 */
export async function getRecommendations(_userId) {
  return [];
}

export default { getRecommendations };
