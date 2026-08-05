import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('axios');

const { createCheckoutSession } = await import('../mayaGateway.js');

function makeOrder(overrides = {}) {
  return {
    orderNumber: 'PS-20260806-ABCDEF',
    total: 999,
    email: 'buyer@test.local',
    user: null,
    shippingAddress: {
      fullName: 'Juan Dela Cruz',
      phone: '09171234567',
      address: '123 Rizal St',
      city: 'Quezon City',
      province: 'Metro Manila',
      zipCode: '1100',
    },
    items: [{ name: 'Jersey', quantity: 1, product: 'prod-1', price: 999, size: 'M' }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('mayaGateway.createCheckoutSession', () => {
  it('sends a requestReferenceNumber unique per call, not just per order', async () => {
    axios.post
      .mockResolvedValueOnce({ data: { checkoutId: 'chk_1', redirectUrl: 'https://pay.example/chk_1' } })
      .mockResolvedValueOnce({ data: { checkoutId: 'chk_2', redirectUrl: 'https://pay.example/chk_2' } });

    const order = makeOrder();
    await createCheckoutSession(order);
    await createCheckoutSession(order); // simulates "Generate New Payment Link" regenerating a session for the same order

    const [firstCall, secondCall] = axios.post.mock.calls;
    const firstRef = firstCall[1].requestReferenceNumber;
    const secondRef = secondCall[1].requestReferenceNumber;

    // Reproduced bug (Payment Platform Redesign): reusing the bare order
    // number on every regenerated attempt made Maya hand back a reference
    // to the SAME already-lapsed checkout session, so the customer landed
    // on Maya's "Invalid Request... already expired" page immediately.
    expect(firstRef).not.toBe(secondRef);
    expect(firstRef.startsWith(`${order.orderNumber}#`)).toBe(true);
    expect(secondRef.startsWith(`${order.orderNumber}#`)).toBe(true);
  });

  it('still returns the real checkoutId/redirectUrl from Maya\'s response', async () => {
    axios.post.mockResolvedValueOnce({ data: { checkoutId: 'chk_abc', redirectUrl: 'https://pay.example/chk_abc' } });

    const result = await createCheckoutSession(makeOrder());
    expect(result).toEqual({ paymentReference: 'chk_abc', redirectUrl: 'https://pay.example/chk_abc' });
  });
});
