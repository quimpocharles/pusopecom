import { describe, it, expect, vi } from 'vitest';
import * as orderEventRepository from '../orderEventRepository.js';

describe('orderEventRepository.create', () => {
  it('writes the given fields and returns a serialized (_id) row', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'evt-1',
      orderId: 'order-1',
      type: 'created',
      actor: 'customer',
      actorUserId: null,
      message: 'Order placed with 1 item',
      metadata: { total: 599 },
      createdAt: new Date('2026-08-02T12:00:00Z'),
    });
    const client = { orderEvent: { create } };

    const event = await orderEventRepository.create(
      { orderId: 'order-1', type: 'created', actor: 'customer', message: 'Order placed with 1 item', metadata: { total: 599 } },
      { client }
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        orderId: 'order-1',
        type: 'created',
        actor: 'customer',
        actorUserId: undefined,
        message: 'Order placed with 1 item',
        metadata: { total: 599 },
      },
    });
    expect(event._id).toBe('evt-1');
    expect(event.id).toBeUndefined();
  });
});

describe('orderEventRepository.findByOrder', () => {
  it('queries ascending by createdAt and collapses actorUser/actorUserId per withRelationFallback', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: 'evt-1', orderId: 'order-1', type: 'created', actor: 'customer', actorUserId: null, actorUser: null, message: 'x', metadata: null, createdAt: new Date() },
      { id: 'evt-2', orderId: 'order-1', type: 'status_updated', actor: 'admin', actorUserId: 'admin-1', actorUser: { id: 'admin-1', firstName: 'A', lastName: 'B', email: 'a@b.com' }, message: 'status: processing → shipped', metadata: null, createdAt: new Date() },
    ]);
    const client = { orderEvent: { findMany } };

    const events = await orderEventRepository.findByOrder('order-1', { client });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { orderId: 'order-1' },
      orderBy: { createdAt: 'asc' },
    }));
    expect(events).toHaveLength(2);
    // actorUser present — takes precedence over the bare actorUserId scalar
    expect(events[1].actorUser).toEqual({ _id: 'admin-1', firstName: 'A', lastName: 'B', email: 'a@b.com' });
    expect(events[1].actorUserId).toBeUndefined();
    // actorUser absent (system/webhook/customer events) — falls back to null, not dropped
    expect(events[0].actorUser).toBeNull();
  });
});
