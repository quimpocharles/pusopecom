import { describe, it, expect, vi, afterEach } from 'vitest';
import * as orderRepository from '../orderRepository.js';

// A Prisma-shaped unique-constraint violation — Order's only extra unique
// field beyond its primary key is orderNumber, so this is what a
// generated-number collision looks like in practice.
const p2002 = () => Object.assign(new Error('Unique constraint failed'), { code: 'P2002', meta: { target: ['orderNumber'] } });

describe('orderRepository.generateOrderNumber', () => {
  const originalPrefix = process.env.ORDER_NUMBER_PREFIX;
  afterEach(() => {
    if (originalPrefix === undefined) delete process.env.ORDER_NUMBER_PREFIX;
    else process.env.ORDER_NUMBER_PREFIX = originalPrefix;
  });

  it('matches PS-YYYYMMDD-XXXXXX by default', () => {
    const orderNumber = orderRepository.generateOrderNumber(new Date('2026-08-02T12:00:00Z'));
    expect(orderNumber).toMatch(/^PS-20260802-[A-Z0-9]{6}$/);
  });

  it('never contains 0, O, 1, or I in the random suffix (visual-ambiguity guard)', () => {
    // Generate many to make a false negative on this assertion vanishingly unlikely.
    for (let i = 0; i < 200; i++) {
      const suffix = orderRepository.generateOrderNumber().split('-')[2];
      expect(suffix).not.toMatch(/[01OI]/);
    }
  });

  it('produces different numbers on successive calls', () => {
    const a = orderRepository.generateOrderNumber();
    const b = orderRepository.generateOrderNumber();
    expect(a).not.toBe(b);
  });

  it('never embeds a database id — only prefix, date, and random suffix', () => {
    const orderNumber = orderRepository.generateOrderNumber();
    expect(orderNumber.split('-')).toHaveLength(3);
  });
});

describe('orderRepository.create — order number collision retry', () => {
  const baseInput = {
    email: 'buyer@test.local',
    subtotal: 500,
    shippingFee: 99,
    total: 599,
    shippingAddress: { fullName: 'x', phone: 'x', address: 'x', city: 'x', province: 'x', zipCode: 'x' },
    items: [{ product: 'product-1', name: 'Test Product', price: 500, quantity: 1, size: 'M', image: 'x.jpg' }],
  };

  it('retries with a freshly generated number when the first attempt collides, and succeeds', async () => {
    const create = vi.fn()
      .mockRejectedValueOnce(p2002())
      .mockResolvedValueOnce({ id: 'order-1', orderNumber: 'PS-20260802-AAAAAA' });
    const client = { order: { create } };

    const order = await orderRepository.create(baseInput, { client });

    expect(create).toHaveBeenCalledTimes(2);
    // Each attempt must use a distinct generated number, not retry with the same one.
    const [firstCall, secondCall] = create.mock.calls;
    expect(firstCall[0].data.orderNumber).not.toBe(secondCall[0].data.orderNumber);
    expect(order._id).toBe('order-1');
  });

  it('gives up after MAX_ORDER_NUMBER_ATTEMPTS consecutive collisions', async () => {
    const create = vi.fn().mockRejectedValue(p2002());
    const client = { order: { create } };

    await expect(orderRepository.create(baseInput, { client })).rejects.toMatchObject({ code: 'P2002' });
    expect(create).toHaveBeenCalledTimes(5);
  });

  it('does not retry a non-collision error', async () => {
    const dbError = new Error('connection lost');
    const create = vi.fn().mockRejectedValueOnce(dbError);
    const client = { order: { create } };

    await expect(orderRepository.create(baseInput, { client })).rejects.toBe(dbError);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('uses a caller-supplied orderNumber exactly once, with no retry on collision', async () => {
    const create = vi.fn().mockRejectedValueOnce(p2002());
    const client = { order: { create } };

    await expect(
      orderRepository.create({ ...baseInput, orderNumber: 'PS-FIXED-VALUE' }, { client })
    ).rejects.toMatchObject({ code: 'P2002' });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data.orderNumber).toBe('PS-FIXED-VALUE');
  });
});
