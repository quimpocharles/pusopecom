import { describe, it, expect, vi, beforeEach } from 'vitest';

const staleRefund = { _id: 'refund-1', amount: 1234.5, status: 'pending', createdAt: new Date() };
const financeStaff = [{ user: { id: 'staff-1' } }, { user: { id: 'staff-2' } }];

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

describe('sendRefundReminders — dedupes per refund per staffer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refundRepository.find.mockResolvedValue([staleRefund]);
    staffProfileRepository.find.mockResolvedValue(financeStaff);
    notificationRepository.create.mockResolvedValue({ id: 'n1' });
  });

  it('notifies each finance staffer once for a pending refund past the threshold', async () => {
    // No prior notification — dedup check returns null for both staffers.
    mockFindFirst.mockResolvedValue(null);

    const result = await sendRefundReminders();

    expect(result.remindersSent).toBe(1);
    expect(notificationRepository.create).toHaveBeenCalledTimes(2); // two staffers
    const bodies = notificationRepository.create.mock.calls.map((c) => c[0].body);
    expect(bodies[0]).toContain('refund-1');
    expect(bodies[1]).toContain('refund-1');
  });

  it('does not re-notify a refund whose reminder already exists (idempotent across sweeps)', async () => {
    // Simulate a prior sweep having already notified: the dedup check finds a
    // match for BOTH staffers, so no new notification should be created.
    mockFindFirst.mockResolvedValue({ id: 'existing-n1' });

    const result = await sendRefundReminders();

    expect(result.remindersSent).toBe(1);
    expect(notificationRepository.create).not.toHaveBeenCalled();
  });

  it('does not suppress a refund because a different refund was already notified', async () => {
    // The dedup query is exact-body matched (body embeds the refund id), so a
    // prior notification for refund A must not silence refund B. Mock the
    // dedup query to only match the OTHER refund's body (i.e. it returns null
    // for this refund), proving the idempotency key is refund-scoped.
    refundRepository.find.mockResolvedValue([
      { _id: 'refund-A', amount: 100, status: 'pending', createdAt: new Date() },
      { _id: 'refund-B', amount: 100, status: 'pending', createdAt: new Date() },
    ]);
    mockFindFirst.mockImplementation(({ where }) => where.body.includes('refund-A') ? { id: 'existing' } : null);

    const result = await sendRefundReminders();

    // refund-A is suppressed (already notified); refund-B is not (different id).
    const bodies = notificationRepository.create.mock.calls.map((c) => c[0].body);
    expect(bodies.some((b) => b.includes('refund-B'))).toBe(true);
    expect(bodies.some((b) => b.includes('refund-A'))).toBe(false);
  });
});
