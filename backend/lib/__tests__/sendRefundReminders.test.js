import { describe, it, expect, vi, beforeEach } from 'vitest';

const staleRefund = { _id: 'refund-1', amount: 1234.5, status: 'pending', createdAt: new Date() };
// staffProfileRepository.find serializes its rows, so the included user's id is
// `user._id` — NOT `user.id`. The fixtures below mirror that real shape.
const financeStaff = [{ user: { _id: 'staff-1' } }, { user: { _id: 'staff-2' } }];

// Deterministic mocks: the sweep reads refunds + staff, then per-refund-per-
// staffer checks for an existing notification (dedup) and creates one if none.
const mockFindFirst = vi.fn();
vi.mock('../../repositories/refundRepository.js', () => ({
  find: vi.fn(),
  default: { find: vi.fn() },
}));
vi.mock('../../repositories/staffProfileRepository.js', () => ({
  find: vi.fn(),
  default: { find: vi.fn() },
}));
vi.mock('../../repositories/notificationRepository.js', () => ({
  create: vi.fn(),
  default: { create: vi.fn() },
}));
vi.mock('../prisma.js', () => ({
  default: { notification: { findFirst: (...a) => mockFindFirst(...a) } },
}));
vi.mock('../logger.js', () => ({ default: { error: vi.fn() } }));
vi.mock('../sentry.js', () => ({ default: { captureException: vi.fn() } }));

const { sendRefundReminders } = await import('../sendRefundReminders.js');
const refundRepository = (await import('../../repositories/refundRepository.js'));
const staffProfileRepository = (await import('../../repositories/staffProfileRepository.js'));
const notificationRepository = (await import('../../repositories/notificationRepository.js'));

describe('sendRefundReminders — recipient resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refundRepository.find.mockResolvedValue([staleRefund]);
    staffProfileRepository.find.mockResolvedValue(financeStaff);
    notificationRepository.create.mockResolvedValue({ id: 'n1' });
  });

  it('notifies each finance staffer using their serialized user._id', async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await sendRefundReminders();

    expect(result.remindersSent).toBe(1);
    expect(notificationRepository.create).toHaveBeenCalledTimes(2);
    const recipients = notificationRepository.create.mock.calls.map((c) => c[0].userId);
    expect(recipients).toEqual(['staff-1', 'staff-2']);
    // The dedup query must be scoped to the recipient, not left undefined.
    expect(mockFindFirst.mock.calls[0][0].where.userId).toBe('staff-1');
  });

  it('still accepts a raw `user.id` shape without regressing', async () => {
    staffProfileRepository.find.mockResolvedValue([{ user: { id: 'raw-staff' } }]);
    mockFindFirst.mockResolvedValue(null);

    await sendRefundReminders();

    expect(notificationRepository.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'raw-staff' }));
  });

  it('skips a staff profile with no resolvable user id instead of creating a malformed notification', async () => {
    staffProfileRepository.find.mockResolvedValue([
      { _id: 'sp-1', user: { _id: 'staff-1' } },
      { _id: 'sp-2', user: null },
      { _id: 'sp-3' },
    ]);
    mockFindFirst.mockResolvedValue(null);

    const result = await sendRefundReminders();

    expect(result.errors).toEqual([]);
    expect(notificationRepository.create).toHaveBeenCalledTimes(1);
    expect(notificationRepository.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'staff-1' }));
    // Every recipient id actually passed to a create must be defined.
    for (const call of notificationRepository.create.mock.calls) {
      expect(call[0].userId).toBeTruthy();
    }
  });
});

describe('sendRefundReminders — dedupes per refund per staffer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refundRepository.find.mockResolvedValue([staleRefund]);
    staffProfileRepository.find.mockResolvedValue(financeStaff);
    notificationRepository.create.mockResolvedValue({ id: 'n1' });
  });

  it('notifies each finance staffer once for a pending refund past the threshold', async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await sendRefundReminders();

    expect(result.remindersSent).toBe(1);
    expect(notificationRepository.create).toHaveBeenCalledTimes(2);
    const bodies = notificationRepository.create.mock.calls.map((c) => c[0].body);
    expect(bodies[0]).toContain('refund-1');
    expect(bodies[1]).toContain('refund-1');
  });

  it('leaves reminder content and timing unchanged', async () => {
    mockFindFirst.mockResolvedValue(null);

    await sendRefundReminders();

    // Exact body locks both the content and the 24h threshold wording.
    expect(notificationRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'order',
      title: 'Refund awaiting processing',
      link: '/admin/returns',
      body: 'A refund of ₱1234.50 (refund refund-1) has been pending for over 24 hours.',
    }));
  });

  it('does not re-notify a refund whose reminder already exists (idempotent across sweeps)', async () => {
    mockFindFirst.mockResolvedValue({ id: 'existing-n1' });

    const result = await sendRefundReminders();

    expect(result.remindersSent).toBe(1);
    expect(notificationRepository.create).not.toHaveBeenCalled();
  });

  it('scopes dedup to the recipient — one staffer\'s existing reminder does not suppress another\'s', async () => {
    // Only staff-1 already has this refund's reminder.
    mockFindFirst.mockImplementation(({ where }) => (where.userId === 'staff-1' ? { id: 'existing' } : null));

    await sendRefundReminders();

    expect(notificationRepository.create).toHaveBeenCalledTimes(1);
    expect(notificationRepository.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'staff-2' }));
  });

  it('does not suppress a refund because a different refund was already notified', async () => {
    refundRepository.find.mockResolvedValue([
      { _id: 'refund-A', amount: 100, status: 'pending', createdAt: new Date() },
      { _id: 'refund-B', amount: 100, status: 'pending', createdAt: new Date() },
    ]);
    mockFindFirst.mockImplementation(({ where }) => (where.body.includes('refund-A') ? { id: 'existing' } : null));

    const result = await sendRefundReminders();

    const bodies = notificationRepository.create.mock.calls.map((c) => c[0].body);
    expect(bodies.some((b) => b.includes('refund-B'))).toBe(true);
    expect(bodies.some((b) => b.includes('refund-A'))).toBe(false);
  });
});
