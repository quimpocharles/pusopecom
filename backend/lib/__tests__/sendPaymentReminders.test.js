import { describe, it, expect, vi, beforeEach } from 'vitest';

// Unit-level, same pattern as sendRefundReminders.test.js — mocked
// repositories/email service, no real DB. Deterministic control over
// "now" is via each order's createdAt relative to Date.now(), not a fake
// clock, since sendPaymentReminders.js reads Date.now() directly.

vi.mock('../../repositories/orderRepository.js', () => ({
  find: vi.fn(),
  updateById: vi.fn(),
  default: { find: vi.fn(), updateById: vi.fn() },
}));
vi.mock('../../repositories/siteSettingsRepository.js', () => ({
  get: vi.fn(),
  default: { get: vi.fn() },
}));
vi.mock('../../repositories/notificationRepository.js', () => ({
  create: vi.fn(),
  default: { create: vi.fn() },
}));
vi.mock('../../services/emailService.js', () => ({
  sendPaymentPendingEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentReminderEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../logger.js', () => ({ default: { error: vi.fn(), info: vi.fn() } }));
vi.mock('../sentry.js', () => ({ default: { captureException: vi.fn() } }));

const { sendPaymentReminders } = await import('../sendPaymentReminders.js');
const orderRepository = await import('../../repositories/orderRepository.js');
const siteSettingsRepository = await import('../../repositories/siteSettingsRepository.js');
const notificationRepository = await import('../../repositories/notificationRepository.js');
const emailService = await import('../../services/emailService.js');

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

function makeOrder(overrides = {}) {
  return {
    _id: 'order-1',
    orderNumber: 'PUSO-TEST-1',
    email: 'fan@example.com',
    total: 999,
    user: null,
    createdAt: new Date(),
    paymentReminderTiers: [],
    ...overrides,
  };
}

describe('sendPaymentReminders — initial 30-minute pending reminder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    siteSettingsRepository.get.mockResolvedValue({
      payment: { orderExpirationEnabled: true, orderRetentionHours: 48 },
    });
    orderRepository.updateById.mockResolvedValue({});
    notificationRepository.create.mockResolvedValue({ id: 'n1' });
  });

  it('B. sends the pending email to an order older than the 30-minute grace period', async () => {
    const order = makeOrder({ createdAt: new Date(Date.now() - 31 * MINUTE) });
    orderRepository.find.mockResolvedValue([order]);

    const result = await sendPaymentReminders();

    expect(emailService.sendPaymentPendingEmail).toHaveBeenCalledWith(order.email, order);
    expect(orderRepository.updateById).toHaveBeenCalledWith(order._id, {
      paymentReminderTiers: ['initial_30m'],
    });
    expect(result.remindersSent).toBe(1);
  });

  it('C. does not send the pending email to an order younger than 30 minutes', async () => {
    const order = makeOrder({ createdAt: new Date(Date.now() - 10 * MINUTE) });
    orderRepository.find.mockResolvedValue([order]);

    const result = await sendPaymentReminders();

    expect(emailService.sendPaymentPendingEmail).not.toHaveBeenCalled();
    expect(orderRepository.updateById).not.toHaveBeenCalled();
    expect(result.remindersSent).toBe(0);
  });

  it('D/E. an order that has already resolved (paid/failed/expired) is never a candidate — the query only ever fetches awaiting_payment orders', async () => {
    // orderRepository.find is called with where: { orderStatus: 'awaiting_payment' }
    // — a paid/failed/expired order simply never appears in what it resolves
    // to, regardless of its age. Simulate the real query returning nothing.
    orderRepository.find.mockResolvedValue([]);

    const result = await sendPaymentReminders();

    expect(orderRepository.find).toHaveBeenCalledWith({ where: { orderStatus: 'awaiting_payment' } });
    expect(emailService.sendPaymentPendingEmail).not.toHaveBeenCalled();
    expect(result.remindersSent).toBe(0);
    expect(result.candidateCount).toBe(0);
  });

  it('F. running the sweep twice does not send the initial reminder twice', async () => {
    const order = makeOrder({ createdAt: new Date(Date.now() - 45 * MINUTE) });
    orderRepository.find.mockResolvedValue([order]);

    await sendPaymentReminders();
    expect(emailService.sendPaymentPendingEmail).toHaveBeenCalledTimes(1);

    // Second sweep: simulate the tier having been persisted from the first run.
    const orderAfterFirstRun = { ...order, paymentReminderTiers: ['initial_30m'] };
    orderRepository.find.mockResolvedValue([orderAfterFirstRun]);
    emailService.sendPaymentPendingEmail.mockClear();
    orderRepository.updateById.mockClear();

    const result = await sendPaymentReminders();

    expect(emailService.sendPaymentPendingEmail).not.toHaveBeenCalled();
    expect(orderRepository.updateById).not.toHaveBeenCalled();
    expect(result.remindersSent).toBe(0);
  });

  it('G. a disabled expiration toggle suppresses the initial reminder the same as every other tier', async () => {
    siteSettingsRepository.get.mockResolvedValue({
      payment: { orderExpirationEnabled: false, orderRetentionHours: 48 },
    });
    const order = makeOrder({ createdAt: new Date(Date.now() - 2 * HOUR) });
    orderRepository.find.mockResolvedValue([order]);

    const result = await sendPaymentReminders();

    expect(result.skipped).toBe(true);
    expect(emailService.sendPaymentPendingEmail).not.toHaveBeenCalled();
    expect(orderRepository.find).not.toHaveBeenCalled();
  });

  it('H. existing 24h/6h/2h deadline tiers still fire independently of the new initial tier', async () => {
    // retention = 48h; an order 25h old has 23h remaining — under the 24h
    // threshold, so the 24h tier is due. The initial tier already fired
    // long before this (well past 30 minutes), so only the deadline tier
    // should fire on this sweep.
    const order = makeOrder({
      createdAt: new Date(Date.now() - 25 * HOUR),
      paymentReminderTiers: ['initial_30m'],
    });
    orderRepository.find.mockResolvedValue([order]);

    const result = await sendPaymentReminders();

    expect(emailService.sendPaymentPendingEmail).not.toHaveBeenCalled();
    expect(emailService.sendPaymentReminderEmail).toHaveBeenCalledWith(order.email, order, '24 hours');
    expect(orderRepository.updateById).toHaveBeenCalledWith(order._id, {
      paymentReminderTiers: ['initial_30m', '24h'],
    });
    expect(result.remindersSent).toBe(1);
  });

  it('H. the 6h and 2h tiers still fire on schedule, independent of the initial tier', async () => {
    // 44h old, 48h retention -> 4h remaining -> only the 6h threshold is
    // crossed (not yet 2h).
    const order = makeOrder({
      createdAt: new Date(Date.now() - 44 * HOUR),
      paymentReminderTiers: ['initial_30m', '24h'],
    });
    orderRepository.find.mockResolvedValue([order]);

    await sendPaymentReminders();

    expect(emailService.sendPaymentReminderEmail).toHaveBeenCalledWith(order.email, order, '6 hours');
  });

  it('both the initial tier and a deadline tier can fire in the same sweep for a very short retention window', async () => {
    // A degenerate but valid admin config: 1-hour retention. An order 40
    // minutes old is past the 30-minute grace period AND already inside
    // the 24h/6h/2h-remaining thresholds (20 minutes remaining < 2 hours).
    siteSettingsRepository.get.mockResolvedValue({
      payment: { orderExpirationEnabled: true, orderRetentionHours: 1 },
    });
    const order = makeOrder({ createdAt: new Date(Date.now() - 40 * MINUTE) });
    orderRepository.find.mockResolvedValue([order]);

    await sendPaymentReminders();

    expect(emailService.sendPaymentPendingEmail).toHaveBeenCalledWith(order.email, order);
    // hoursRemaining (~0.33h) crosses all three deadline thresholds at
    // once; only the most urgent (2h) is actually emailed — same
    // "don't send a stale catch-up reminder" rule the deadline tiers
    // already applied before this change.
    expect(emailService.sendPaymentReminderEmail).toHaveBeenCalledWith(order.email, order, '2 hours');
    expect(orderRepository.updateById).toHaveBeenNthCalledWith(1, order._id, {
      paymentReminderTiers: ['initial_30m'],
    });
    expect(orderRepository.updateById).toHaveBeenNthCalledWith(2, order._id, {
      paymentReminderTiers: ['initial_30m', '24h', '6h', '2h'],
    });
  });

  it('J. abandoned-checkout scenario: no payment ever arrives, sweep runs 30+ minutes later — exactly one pending email', async () => {
    const order = makeOrder({ createdAt: new Date(Date.now() - 31 * MINUTE) });
    orderRepository.find.mockResolvedValue([order]);

    const result = await sendPaymentReminders();

    expect(emailService.sendPaymentPendingEmail).toHaveBeenCalledTimes(1);
    expect(result.remindersSent).toBe(1);
  });

  it('a delivery failure is swallowed (best-effort) and still marks the tier as processed', async () => {
    const order = makeOrder({ createdAt: new Date(Date.now() - 40 * MINUTE) });
    orderRepository.find.mockResolvedValue([order]);
    emailService.sendPaymentPendingEmail.mockRejectedValueOnce(new Error('SMTP down'));

    const result = await sendPaymentReminders();

    expect(orderRepository.updateById).toHaveBeenCalledWith(order._id, {
      paymentReminderTiers: ['initial_30m'],
    });
    expect(result.remindersSent).toBe(1);
    expect(result.errors).toEqual([]);
  });
});
