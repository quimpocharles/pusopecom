import { describe, it, expect, vi } from 'vitest';
import {
  claimConfirmationEmailDelivery,
  releaseConfirmationEmailClaim,
  markConfirmationEmailSent,
  findPaidWithoutConfirmationEmail,
} from '../orderRepository.js';

describe('confirmation email repository operations', () => {
  it('atomically claims an unsent paid order when no fresh claim exists', async () => {
    const client = { order: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } };
    const claimedAt = new Date('2026-08-23T12:00:00Z');
    const staleBefore = new Date('2026-08-23T11:45:00Z');

    await expect(claimConfirmationEmailDelivery('o1', { client, claimedAt, staleBefore })).resolves.toBe(true);

    expect(client.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'o1',
        paymentStatus: 'paid',
        confirmationEmailSentAt: null,
        OR: [{ confirmationEmailClaimedAt: null }, { confirmationEmailClaimedAt: { lt: staleBefore } }],
      },
      data: { confirmationEmailClaimedAt: claimedAt },
    });
  });

  it('releases only the claim timestamp owned by this worker', async () => {
    const claimedAt = new Date('2026-08-23T12:00:00Z');
    const client = { order: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } };

    await expect(releaseConfirmationEmailClaim('o1', { client, claimedAt })).resolves.toBe(true);

    expect(client.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'o1', confirmationEmailClaimedAt: claimedAt },
      data: { confirmationEmailClaimedAt: null },
    });
  });

  it('marks success only for the current claim and clears that claim', async () => {
    const claimedAt = new Date('2026-08-23T12:00:00Z');
    const client = { order: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } };

    await expect(markConfirmationEmailSent('o1', { client, claimedAt })).resolves.toBe(true);

    expect(client.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'o1', confirmationEmailSentAt: null, confirmationEmailClaimedAt: claimedAt },
      data: { confirmationEmailSentAt: expect.any(Date), confirmationEmailClaimedAt: null },
    });
  });

  it('selects only paid, old, unmarked orders with no fresh claim', async () => {
    const client = {
      order: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'o1', orderNumber: 'PS-1', paymentStatus: 'paid', confirmationEmailSentAt: null,
          updatedAt: new Date('2026-08-23T11:00:00Z'),
        }]),
      },
    };
    const cutoff = new Date('2026-08-23T11:50:00Z');
    const staleBefore = new Date('2026-08-23T11:45:00Z');

    const orders = await findPaidWithoutConfirmationEmail({ cutoff, staleBefore, take: 25, client });

    expect(client.order.findMany).toHaveBeenCalledWith({
      where: {
        paymentStatus: 'paid', confirmationEmailSentAt: null, updatedAt: { lt: cutoff },
        OR: [{ confirmationEmailClaimedAt: null }, { confirmationEmailClaimedAt: { lt: staleBefore } }],
      },
      orderBy: { updatedAt: 'asc' },
      take: 25,
      include: { items: true, passes: true, promoCode: { select: { code: true, discountType: true } } },
    });
    expect(orders[0]._id).toBe('o1');
  });
});
