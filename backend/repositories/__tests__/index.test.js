import { describe, it, expect } from 'vitest';
import * as repos from '../index.js';

// Cheap but real: catches import typos, circular-import issues, and any
// repository accidentally forgetting a default export — before any of
// this is wired into a route.
describe('repositories barrel export', () => {
  const expected = [
    'userRepository',
    'productRepository',
    'orderRepository',
    'leagueRepository',
    'reviewRepository',
    'shippingEventRepository',
    'siteSettingsRepository',
    'tryOnLogRepository',
    'userActivityRepository',
    'venuePickupConfigRepository',
    'organizationRepository',
    'teamRepository',
    'athleteAffiliationRepository',
  ];

  it.each(expected)('exports %s as an object with at least one method', (name) => {
    expect(repos[name]).toBeDefined();
    expect(typeof repos[name]).toBe('object');
    expect(Object.values(repos[name]).some((v) => typeof v === 'function')).toBe(true);
  });
});
