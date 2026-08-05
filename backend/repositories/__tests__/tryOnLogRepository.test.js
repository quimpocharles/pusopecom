import { describe, it, expect, vi } from 'vitest';
import * as tryOnLogRepository from '../tryOnLogRepository.js';

describe('tryOnLogRepository.mostTried', () => {
  it('groups by product via SQL, ranks by count, and resolves display fields from a sample row', async () => {
    // With a single `by` field, Prisma's `_count: true` in groupBy returns
    // `_count` as a bare number, not `{ productId: n }` — this mock used to
    // (wrongly) shape it as an object, which meant this test was verifying
    // nothing real; see the same fix in mostTried/trending/analytics.
    const groupBy = vi.fn().mockResolvedValue([
      { productId: 'p1', _count: 5 },
      { productId: 'p2', _count: 2 },
    ]);
    const findFirst = vi.fn()
      .mockResolvedValueOnce({ productName: 'Jersey', productImage: 'jersey.jpg' })
      .mockResolvedValueOnce({ productName: 'Cap', productImage: 'cap.jpg' });
    const client = { tryOnLog: { groupBy, findFirst } };

    const result = await tryOnLogRepository.mostTried(5, { client });

    expect(groupBy).toHaveBeenCalledWith({
      by: ['productId'],
      where: { productId: { not: null } },
      _count: true,
      orderBy: { _count: { productId: 'desc' } },
      take: 5,
    });
    expect(result).toEqual([
      { productName: 'Jersey', productImage: 'jersey.jpg', count: 5 },
      { productName: 'Cap', productImage: 'cap.jpg', count: 2 },
    ]);
  });

  it('returns an empty array when nothing has been tried on', async () => {
    const client = { tryOnLog: { groupBy: vi.fn().mockResolvedValue([]), findFirst: vi.fn() } };
    expect(await tryOnLogRepository.mostTried(5, { client })).toEqual([]);
  });
});
