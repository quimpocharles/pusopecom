import { describe, it, expect, vi } from 'vitest';
import * as dashboardWidgetRepository from '../dashboardWidgetRepository.js';

describe('dashboardWidgetRepository.list', () => {
  it('self-heals missing widget keys with their default display order', async () => {
    const findMany = vi.fn()
      .mockResolvedValueOnce([{ id: 'w1', key: 'todaysRevenue', active: true, displayOrder: 0 }])
      .mockResolvedValueOnce([
        { id: 'w1', key: 'todaysRevenue', active: true, displayOrder: 0 },
        { id: 'w2', key: 'todaysOrders', active: true, displayOrder: 1 },
        { id: 'w3', key: 'lowStock', active: true, displayOrder: 2 },
        { id: 'w4', key: 'pendingShipments', active: true, displayOrder: 3 },
        { id: 'w5', key: 'failedPayments', active: true, displayOrder: 4 },
        { id: 'w6', key: 'mostViewedProducts', active: true, displayOrder: 5 },
        { id: 'w7', key: 'mostTriedOnProducts', active: true, displayOrder: 6 },
      ]);
    const createMany = vi.fn().mockResolvedValue({ count: 6 });
    const client = { dashboardWidget: { findMany, createMany } };

    const widgets = await dashboardWidgetRepository.list({ client });

    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    expect(widgets).toHaveLength(7);
    expect(widgets.map((w) => w.key)).toEqual([
      'todaysRevenue', 'todaysOrders', 'lowStock', 'pendingShipments',
      'failedPayments', 'mostViewedProducts', 'mostTriedOnProducts',
    ]);
  });

  it('returns widgets sorted by displayOrder, not DB return order', async () => {
    const allSevenOutOfOrder = [
      { id: 'w5', key: 'failedPayments', active: true, displayOrder: 4 },
      { id: 'w1', key: 'todaysRevenue', active: true, displayOrder: 0 },
      { id: 'w7', key: 'mostTriedOnProducts', active: true, displayOrder: 6 },
      { id: 'w2', key: 'todaysOrders', active: true, displayOrder: 1 },
      { id: 'w3', key: 'lowStock', active: true, displayOrder: 2 },
      { id: 'w4', key: 'pendingShipments', active: true, displayOrder: 3 },
      { id: 'w6', key: 'mostViewedProducts', active: true, displayOrder: 5 },
    ];
    const findMany = vi.fn().mockResolvedValue(allSevenOutOfOrder);
    const client = { dashboardWidget: { findMany, createMany: vi.fn() } };

    const widgets = await dashboardWidgetRepository.list({ client });

    expect(widgets.map((w) => w.key)).toEqual([
      'todaysRevenue', 'todaysOrders', 'lowStock', 'pendingShipments',
      'failedPayments', 'mostViewedProducts', 'mostTriedOnProducts',
    ]);
  });
});

describe('dashboardWidgetRepository.setActive', () => {
  it('upserts by key, defaulting displayOrder to its position in the default order on first creation', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'w3', key: 'lowStock', active: false, displayOrder: 2 });
    const client = { dashboardWidget: { upsert } };

    await dashboardWidgetRepository.setActive('lowStock', false, { client });

    expect(upsert).toHaveBeenCalledWith({
      where: { key: 'lowStock' },
      update: { active: false },
      create: { key: 'lowStock', active: false, displayOrder: 2 },
    });
  });
});

describe('dashboardWidgetRepository.upsertMany', () => {
  it('upserts every widget and returns them sorted by displayOrder', async () => {
    const upsert = vi.fn()
      .mockResolvedValueOnce({ id: 'w1', key: 'lowStock', active: true, displayOrder: 1 })
      .mockResolvedValueOnce({ id: 'w2', key: 'todaysRevenue', active: true, displayOrder: 0 });
    const client = { dashboardWidget: { upsert } };

    const widgets = await dashboardWidgetRepository.upsertMany(
      [{ key: 'lowStock', displayOrder: 1 }, { key: 'todaysRevenue', displayOrder: 0 }],
      { client }
    );

    expect(widgets.map((w) => w.key)).toEqual(['todaysRevenue', 'lowStock']);
  });
});
