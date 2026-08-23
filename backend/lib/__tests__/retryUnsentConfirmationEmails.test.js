import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/orderRepository.js', () => ({
  findPaidWithoutConfirmationEmail: vi.fn(),
}));
vi.mock('../orderConfirmationEmail.js', () => ({
  sendOrderConfirmation: vi.fn(),
}));

const { retryUnsentConfirmationEmails } = await import('../retryUnsentConfirmationEmails.js');
const orderRepository = await import('../../repositories/orderRepository.js');
const sender = await import('../orderConfirmationEmail.js');

beforeEach(() => vi.clearAllMocks());

describe('retryUnsentConfirmationEmails', () => {
  it('sends every eligible paid order and reports counts', async () => {
    const orders = [{ orderNumber: 'PS-1' }, { orderNumber: 'PS-2' }];
    orderRepository.findPaidWithoutConfirmationEmail.mockResolvedValue(orders);
    sender.sendOrderConfirmation.mockResolvedValue('sent');

    const result = await retryUnsentConfirmationEmails({ now: new Date('2026-08-23T12:00:00Z') });

    expect(result).toMatchObject({ candidateCount: 2, sentCount: 2, skippedCount: 0, errors: [] });
    expect(sender.sendOrderConfirmation).toHaveBeenCalledTimes(2);
    expect(orderRepository.findPaidWithoutConfirmationEmail).toHaveBeenCalledWith({
      cutoff: new Date('2026-08-23T11:50:00Z'),
      staleBefore: new Date('2026-08-23T11:45:00Z'),
      take: 25,
    });
  });

  it('continues after one email failure and records the failed order', async () => {
    const orders = [{ orderNumber: 'PS-1' }, { orderNumber: 'PS-2' }];
    orderRepository.findPaidWithoutConfirmationEmail.mockResolvedValue(orders);
    sender.sendOrderConfirmation
      .mockRejectedValueOnce(new Error('SMTP down'))
      .mockResolvedValueOnce('sent');

    const result = await retryUnsentConfirmationEmails();

    expect(result.sentCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].orderNumber).toBe('PS-1');
  });

  it('does nothing when no paid orders need confirmation delivery', async () => {
    orderRepository.findPaidWithoutConfirmationEmail.mockResolvedValue([]);

    const result = await retryUnsentConfirmationEmails();

    expect(result).toMatchObject({ candidateCount: 0, sentCount: 0, skippedCount: 0, errors: [] });
    expect(sender.sendOrderConfirmation).not.toHaveBeenCalled();
  });

  it('counts a claim lost to another worker as skipped, not failed', async () => {
    orderRepository.findPaidWithoutConfirmationEmail.mockResolvedValue([{ orderNumber: 'PS-1' }]);
    sender.sendOrderConfirmation.mockResolvedValue('skipped');

    const result = await retryUnsentConfirmationEmails();

    expect(result).toMatchObject({ candidateCount: 1, sentCount: 0, skippedCount: 1, errors: [] });
  });
});
