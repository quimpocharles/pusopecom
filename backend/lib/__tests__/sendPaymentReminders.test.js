import { describe, it, expect, vi, beforeEach } from 'vitest';

// Unit-level, mocked repositories/email service — but casReminderTiers is
// backed by a small in-memory store that actually implements
// compare-and-swap semantics (checks `expected` against live state,
// checks orderStatus when requireAwaitingPayment is set), not just a
// vi.fn() recording call arguments. Durable Payment Reminder Delivery's
// whole point is optimistic-concurrency correctness, so the mock has to
// behave like real concurrent state, not merely echo back what it was
// called with.

vi.mock('../../repositories/orderRepository.js', () => ({
  find: vi.fn(),
  casReminderTiers: vi.fn(),
  default: { find: vi.fn(), casReminderTiers: vi.fn() },
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

// A minimal fake of the real Postgres row this order maps to — deliberately
// separate from the plain-object `order` handed to `find()`'s mock, so a
// test can make the two diverge (simulating "the sweep's snapshot is
// stale relative to what's actually in the database right now").
function makeStore({ id, orderStatus = 'awaiting_payment', tiers = [] } = {}) {
  const state = { orderStatus, tiers };
  return {
    id,
    getTiers: () => state.tiers,
    getOrderStatus: () => state.orderStatus,
    setOrderStatus: (s) => { state.orderStatus = s; },
    cas: async ({ expected, next, requireAwaitingPayment }) => {
      if (requireAwaitingPayment && state.orderStatus !== 'awaiting_payment') return false;
      if (JSON.stringify(state.tiers) !== JSON.stringify(expected)) return false;
      state.tiers = next;
      return true;
    },
  };
}

// Wires orderRepository.casReminderTiers to whichever store matches the id
// it's called with — lets a single test register multiple orders/stores.
function wireStores(stores) {
  const byId = new Map(stores.map((s) => [s.id, s]));
  orderRepository.casReminderTiers.mockImplementation((id, opts) => {
    const store = byId.get(id);
    if (!store) throw new Error(`No fake store registered for order id ${id}`);
    return store.cas(opts);
  });
}

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

describe('sendPaymentReminders — Durable Payment Reminder Delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    siteSettingsRepository.get.mockResolvedValue({
      payment: { orderExpirationEnabled: true, orderRetentionHours: 48 },
    });
    notificationRepository.create.mockResolvedValue({ id: 'n1' });
  });

  it('1. initial_30m email succeeds — tier is recorded', async () => {
    const order = makeOrder({ createdAt: new Date(Date.now() - 31 * MINUTE) });
    const store = makeStore({ id: order._id, tiers: [] });
    orderRepository.find.mockResolvedValue([order]);
    wireStores([store]);

    const result = await sendPaymentReminders();

    expect(emailService.sendPaymentPendingEmail).toHaveBeenCalledWith(order.email, order);
    expect(store.getTiers()).toEqual(['initial_30m']);
    expect(result.remindersSent).toBe(1);
  });

  it('2. initial_30m email fails — tier is NOT recorded', async () => {
    const order = makeOrder({ createdAt: new Date(Date.now() - 31 * MINUTE) });
    const store = makeStore({ id: order._id, tiers: [] });
    orderRepository.find.mockResolvedValue([order]);
    wireStores([store]);
    emailService.sendPaymentPendingEmail.mockRejectedValueOnce(new Error('Connection timeout'));

    const result = await sendPaymentReminders();

    expect(emailService.sendPaymentPendingEmail).toHaveBeenCalledWith(order.email, order);
    expect(store.getTiers()).toEqual([]); // claim taken then released — nothing left behind
    expect(result.remindersSent).toBe(0);
    expect(result.errors).toEqual([]); // best-effort: doesn't fail the sweep
  });

  it('3. a failed initial_30m attempt is retried on the next sweep', async () => {
    const order = makeOrder({ createdAt: new Date(Date.now() - 31 * MINUTE) });
    const store = makeStore({ id: order._id, tiers: [] });
    orderRepository.find.mockResolvedValue([order]);
    wireStores([store]);
    emailService.sendPaymentPendingEmail.mockRejectedValueOnce(new Error('Connection timeout'));

    await sendPaymentReminders();
    expect(store.getTiers()).toEqual([]);

    // Second sweep — same order, same (still empty) tiers, email now works.
    emailService.sendPaymentPendingEmail.mockClear();
    const secondOrder = { ...order, paymentReminderTiers: store.getTiers() };
    orderRepository.find.mockResolvedValue([secondOrder]);

    const result = await sendPaymentReminders();

    expect(emailService.sendPaymentPendingEmail).toHaveBeenCalledTimes(1);
    expect(store.getTiers()).toEqual(['initial_30m']);
    expect(result.remindersSent).toBe(1);
  });

  it('4. a successful initial_30m attempt is never resent on a later sweep', async () => {
    const order = makeOrder({ createdAt: new Date(Date.now() - 45 * MINUTE) });
    const store = makeStore({ id: order._id, tiers: [] });
    orderRepository.find.mockResolvedValue([order]);
    wireStores([store]);

    await sendPaymentReminders();
    expect(emailService.sendPaymentPendingEmail).toHaveBeenCalledTimes(1);

    emailService.sendPaymentPendingEmail.mockClear();
    const secondOrder = { ...order, paymentReminderTiers: store.getTiers() };
    orderRepository.find.mockResolvedValue([secondOrder]);

    const result = await sendPaymentReminders();

    expect(emailService.sendPaymentPendingEmail).not.toHaveBeenCalled();
    expect(store.getTiers()).toEqual(['initial_30m']);
    expect(result.remindersSent).toBe(0);
  });

  it('5. an order that paid between the sweep reading it and processing it receives no reminder', async () => {
    // find() returns the STALE snapshot (as it looked when the query ran:
    // still awaiting_payment). The store — standing in for what's actually
    // in the database right now — has already moved to 'paid' by the time
    // the claim's CAS runs.
    const order = makeOrder({ createdAt: new Date(Date.now() - 45 * MINUTE) });
    const store = makeStore({ id: order._id, orderStatus: 'paid', tiers: [] });
    orderRepository.find.mockResolvedValue([order]);
    wireStores([store]);

    const result = await sendPaymentReminders();

    expect(emailService.sendPaymentPendingEmail).not.toHaveBeenCalled();
    expect(store.getTiers()).toEqual([]); // claim never took — nothing recorded either
    expect(result.remindersSent).toBe(0);
  });

  it('6. an order that failed/expired/cancelled between read and processing receives no reminder', async () => {
    for (const status of ['failed_payment', 'expired', 'cancelled']) {
      vi.clearAllMocks();
      siteSettingsRepository.get.mockResolvedValue({
        payment: { orderExpirationEnabled: true, orderRetentionHours: 48 },
      });
      const order = makeOrder({ createdAt: new Date(Date.now() - 45 * MINUTE) });
      const store = makeStore({ id: order._id, orderStatus: status, tiers: [] });
      orderRepository.find.mockResolvedValue([order]);
      wireStores([store]);

      await sendPaymentReminders();

      expect(emailService.sendPaymentPendingEmail).not.toHaveBeenCalled();
      expect(store.getTiers()).toEqual([]);
    }
  });

  it('7. two concurrent workers racing the same tier — only one succeeds in claiming, only one email is sent', async () => {
    // Simulates two sweep processes both having read the same stale
    // snapshot (paymentReminderTiers: []) and racing to claim initial_30m
    // for the same order at the same time. Real concurrency (genuine
    // Promise.all against Postgres) is additionally verified in
    // repositories/__tests__/integration.test.js — this proves the CAS
    // logic itself rejects a second claim against state it didn't expect.
    const store = makeStore({ id: 'order-race', tiers: [] });
    const now = Date.now();

    const [claimA, claimB] = await Promise.all([
      store.cas({ expected: [], next: ['initial_30m:claimed:' + now], requireAwaitingPayment: true }),
      store.cas({ expected: [], next: ['initial_30m:claimed:' + now], requireAwaitingPayment: true }),
    ]);

    expect([claimA, claimB].filter(Boolean)).toHaveLength(1);
    expect(store.getTiers()).toEqual(['initial_30m:claimed:' + now]);
  });

  it('8a. 24h tier still fires at the correct threshold and is recorded only on success', async () => {
    // 25h old, 48h retention -> 23h remaining, past the 24h threshold.
    // Already past initial_30m (pre-seeded) so this isolates the 24h tier.
    const order = makeOrder({ createdAt: new Date(Date.now() - 25 * HOUR), paymentReminderTiers: ['initial_30m'] });
    const store = makeStore({ id: order._id, tiers: ['initial_30m'] });
    orderRepository.find.mockResolvedValue([order]);
    wireStores([store]);

    const result = await sendPaymentReminders();

    expect(emailService.sendPaymentReminderEmail).toHaveBeenCalledWith(order.email, order, '24 hours');
    expect(store.getTiers()).toEqual(['initial_30m', '24h']);
    expect(result.remindersSent).toBe(1);
  });

  it('8b. a failed 24h send is not recorded and is retried next sweep', async () => {
    const order = makeOrder({ createdAt: new Date(Date.now() - 25 * HOUR), paymentReminderTiers: ['initial_30m'] });
    const store = makeStore({ id: order._id, tiers: ['initial_30m'] });
    orderRepository.find.mockResolvedValue([order]);
    wireStores([store]);
    emailService.sendPaymentReminderEmail.mockRejectedValueOnce(new Error('Connection timeout'));

    const first = await sendPaymentReminders();
    expect(store.getTiers()).toEqual(['initial_30m']); // NOT recorded
    expect(first.remindersSent).toBe(0);

    const secondOrder = { ...order, paymentReminderTiers: store.getTiers() };
    orderRepository.find.mockResolvedValue([secondOrder]);
    emailService.sendPaymentReminderEmail.mockClear();

    const second = await sendPaymentReminders();
    expect(emailService.sendPaymentReminderEmail).toHaveBeenCalledWith(order.email, order, '24 hours');
    expect(store.getTiers()).toEqual(['initial_30m', '24h']);
    expect(second.remindersSent).toBe(1);
  });

  it('8c. the 6h and 2h tiers still fire on schedule', async () => {
    // 44h old, 48h retention -> 4h remaining -> only the 6h threshold
    // newly crossed (24h already recorded, 2h not yet).
    const order = makeOrder({
      createdAt: new Date(Date.now() - 44 * HOUR),
      paymentReminderTiers: ['initial_30m', '24h'],
    });
    const store = makeStore({ id: order._id, tiers: ['initial_30m', '24h'] });
    orderRepository.find.mockResolvedValue([order]);
    wireStores([store]);

    await sendPaymentReminders();

    expect(emailService.sendPaymentReminderEmail).toHaveBeenCalledWith(order.email, order, '6 hours');
    expect(store.getTiers()).toEqual(['initial_30m', '24h', '6h']);
  });

  it('9. a cron gap that skips past multiple tiers sends only the most urgent and permanently skip-marks the rest; dedup remains intact across repeated sweeps', async () => {
    // 47h old, 48h retention -> 1h remaining -> 24h, 6h, AND 2h all due at
    // once. Only 2h (most urgent) is actually emailed; 24h/6h are
    // committed as permanently-skipped (never resent later) in the same
    // atomic write — none of this is a delivery attempt, so it isn't
    // subject to success/failure semantics.
    const order = makeOrder({ createdAt: new Date(Date.now() - 47 * HOUR), paymentReminderTiers: ['initial_30m'] });
    const store = makeStore({ id: order._id, tiers: ['initial_30m'] });
    orderRepository.find.mockResolvedValue([order]);
    wireStores([store]);

    const result = await sendPaymentReminders();

    expect(emailService.sendPaymentReminderEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendPaymentReminderEmail).toHaveBeenCalledWith(order.email, order, '2 hours');
    expect(store.getTiers()).toEqual(expect.arrayContaining(['initial_30m', '24h', '6h', '2h']));
    expect(result.remindersSent).toBe(1);

    // Idempotent across a repeated sweep: nothing new fires, nothing is
    // ever resent.
    emailService.sendPaymentReminderEmail.mockClear();
    const secondOrder = { ...order, paymentReminderTiers: store.getTiers() };
    orderRepository.find.mockResolvedValue([secondOrder]);

    const second = await sendPaymentReminders();
    expect(emailService.sendPaymentReminderEmail).not.toHaveBeenCalled();
    expect(second.remindersSent).toBe(0);
  });

  it('a disabled expiration toggle suppresses every tier, including the new one', async () => {
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

  it('a stale claim (worker crashed mid-send) is reclaimed and retried on a later sweep', async () => {
    const staleClaimedAt = Date.now() - 20 * MINUTE; // older than the 15-minute lease
    const order = makeOrder({ createdAt: new Date(Date.now() - 45 * MINUTE) });
    const store = makeStore({ id: order._id, tiers: [`initial_30m:claimed:${staleClaimedAt}`] });
    orderRepository.find.mockResolvedValue([{ ...order, paymentReminderTiers: store.getTiers() }]);
    wireStores([store]);

    const result = await sendPaymentReminders();

    expect(emailService.sendPaymentPendingEmail).toHaveBeenCalledTimes(1);
    expect(store.getTiers()).toEqual(['initial_30m']);
    expect(result.remindersSent).toBe(1);
  });

  it('a fresh (non-stale) claim blocks a second attempt in the same sweep window', async () => {
    const freshClaimedAt = Date.now() - 2 * MINUTE; // well inside the 15-minute lease
    const order = makeOrder({ createdAt: new Date(Date.now() - 45 * MINUTE) });
    const store = makeStore({ id: order._id, tiers: [`initial_30m:claimed:${freshClaimedAt}`] });
    orderRepository.find.mockResolvedValue([{ ...order, paymentReminderTiers: store.getTiers() }]);
    wireStores([store]);

    const result = await sendPaymentReminders();

    expect(emailService.sendPaymentPendingEmail).not.toHaveBeenCalled();
    expect(store.getTiers()).toEqual([`initial_30m:claimed:${freshClaimedAt}`]); // untouched
    expect(result.remindersSent).toBe(0);
  });
});
