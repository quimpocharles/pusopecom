import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('axios');

const { createCheckoutSession, getPaymentStatus } = await import('../xenditGateway.js');

function makeOrder(overrides = {}) {
  return {
    orderNumber: 'PS-20260819-ABCDEF',
    total: 1044,
    email: 'buyer@test.local',
    user: null,
    paymentChannel: 'CARD',
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

describe('xenditGateway.createCheckoutSession', () => {
  it('sends a reference_id unique per call, not just per order — same lesson as Maya (ADR-008)', async () => {
    axios.post
      .mockResolvedValueOnce({ data: { payment_session_id: 'sess_1', payment_link_url: 'https://checkout.xendit.co/sess_1' } })
      .mockResolvedValueOnce({ data: { payment_session_id: 'sess_2', payment_link_url: 'https://checkout.xendit.co/sess_2' } });

    const order = makeOrder();
    await createCheckoutSession(order);
    await createCheckoutSession(order);

    const [firstCall, secondCall] = axios.post.mock.calls;
    const firstRef = firstCall[1].reference_id;
    const secondRef = secondCall[1].reference_id;

    expect(firstRef).not.toBe(secondRef);
    expect(firstRef.startsWith(`${order.orderNumber}#`)).toBe(true);
    expect(secondRef.startsWith(`${order.orderNumber}#`)).toBe(true);
  });

  it('scopes allowed_payment_channels to exactly the channel chosen in our own checkout UI', async () => {
    axios.post.mockResolvedValueOnce({ data: { payment_session_id: 'sess_1', payment_link_url: 'https://checkout.xendit.co/sess_1' } });

    await createCheckoutSession(makeOrder({ paymentChannel: 'GCASH' }));

    const [, body] = axios.post.mock.calls[0];
    expect(body.allowed_payment_channels).toEqual(['GCASH']);
  });

  it('rejects an order with no recognized payment channel rather than falling back to "all channels"', async () => {
    await expect(createCheckoutSession(makeOrder({ paymentChannel: 'BITCOIN' }))).rejects.toThrow();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('returns the real payment_session_id/payment_link_url from Xendit\'s response', async () => {
    axios.post.mockResolvedValueOnce({ data: { payment_session_id: 'sess_abc', payment_link_url: 'https://checkout.xendit.co/sess_abc' } });

    const result = await createCheckoutSession(makeOrder());
    expect(result).toEqual({ paymentReference: 'sess_abc', redirectUrl: 'https://checkout.xendit.co/sess_abc' });
  });
});

describe('xenditGateway.getPaymentStatus', () => {
  it('normalizes COMPLETED to succeeded', async () => {
    axios.get.mockResolvedValueOnce({ data: { status: 'COMPLETED' } });
    const result = await getPaymentStatus('sess_1');
    expect(result.status).toBe('succeeded');
  });

  it('normalizes EXPIRED to expired', async () => {
    axios.get.mockResolvedValueOnce({ data: { status: 'EXPIRED' } });
    const result = await getPaymentStatus('sess_1');
    expect(result.status).toBe('expired');
  });

  it('normalizes CANCELED to failed', async () => {
    axios.get.mockResolvedValueOnce({ data: { status: 'CANCELED' } });
    const result = await getPaymentStatus('sess_1');
    expect(result.status).toBe('failed');
  });

  it('falls through to pending for any unrecognized status, same convention as mayaGateway', async () => {
    axios.get.mockResolvedValueOnce({ data: { status: 'ACTIVE' } });
    const result = await getPaymentStatus('sess_1');
    expect(result.status).toBe('pending');
  });
});
