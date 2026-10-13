import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

let currentUser;

vi.mock('../../../store/authStore', () => ({
  default: (selector) => selector({ user: currentUser }),
}));

vi.mock('../../../services/returnService', () => ({
  default: { getReturns: vi.fn(), getReturn: vi.fn(), transitionStatus: vi.fn(), inspect: vi.fn() },
}));

vi.mock('../../../services/refundService', () => ({
  default: { record: vi.fn(), adjust: vi.fn(), getRefunds: vi.fn(), getRefund: vi.fn() },
}));

const returnService = (await import('../../../services/returnService')).default;
const refundService = (await import('../../../services/refundService')).default;
const AdminReturns = (await import('../AdminReturns')).default;

const FINANCE = { role: 'admin', staffProfile: { department: 'finance', active: true, permissions: [] } };
const SUPPORT = { role: 'admin', staffProfile: { department: 'support', active: true, permissions: [] } };

const RETURN_ROW = {
  _id: 'ret1',
  status: 'refund_pending',
  reason: 'Wrong size',
  requestedAt: new Date().toISOString(),
  order: { orderNumber: 'PS-1', total: 1500, email: 'buyer@test.local' },
};

function returnDetail({ refunds, orderTotal = 1500 }) {
  return { data: { _id: 'ret1', status: 'refund_pending', order: { orderNumber: 'PS-1', total: orderTotal }, items: [], refunds } };
}

function renderPage() {
  return render(<MemoryRouter><AdminReturns /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = FINANCE;
  returnService.getReturns.mockResolvedValue({ data: [RETURN_ROW], pagination: { page: 1, pages: 1, total: 1 } });
});

async function openRefundModal(detail) {
  returnService.getReturn.mockResolvedValue(detail);
  const user = userEvent.setup();
  renderPage();
  const button = await screen.findByRole('button', { name: 'Record Refund' });
  await user.click(button);
  await screen.findByRole('heading', { name: /Refund — Order #PS-1/ });
  return user;
}

describe('AdminReturns — refund permissions', () => {
  it('shows the Record Refund action to a refunds.manage (finance) user', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: 'Record Refund' })).toBeInTheDocument();
  });

  it('hides the recording action from a user without refunds.manage', async () => {
    currentUser = SUPPORT;
    renderPage();
    await screen.findByText('Refund pending');
    expect(screen.queryByRole('button', { name: 'Record Refund' })).not.toBeInTheDocument();
  });
});

describe('AdminReturns — refund resolution', () => {
  it('resolves the refund by returnRequestId, not refunds[0]', async () => {
    const user = await openRefundModal(returnDetail({
      refunds: [
        { _id: 'r-other', returnRequestId: 'other-return', amount: 500, status: 'succeeded' },
        { _id: 'r-right', returnRequestId: 'ret1', amount: 1200, status: 'pending' },
      ],
    }));

    expect(screen.getByText('₱1200.00')).toBeInTheDocument();

    await user.click(screen.getByLabelText(/I confirm this refund was already completed/i));
    await user.click(screen.getByRole('button', { name: 'Record refund' }));

    await waitFor(() => expect(refundService.record).toHaveBeenCalledWith('r-right', expect.objectContaining({ externalAmount: 1200 })));
  });
});

describe('AdminReturns — recording requirements', () => {
  it('requires explicit confirmation and the exact external amount', async () => {
    const user = await openRefundModal(returnDetail({ refunds: [{ _id: 'r1', returnRequestId: 'ret1', amount: 1200, status: 'pending' }] }));

    // No confirmation yet.
    await user.click(screen.getByRole('button', { name: 'Record refund' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/confirm this refund was already completed/i);
    expect(refundService.record).not.toHaveBeenCalled();

    // Confirm but with a mismatched amount.
    await user.click(screen.getByLabelText(/I confirm this refund was already completed/i));
    const amountInput = screen.getByLabelText('External amount');
    await user.clear(amountInput);
    await user.type(amountInput, '1100');
    await user.click(screen.getByRole('button', { name: 'Record refund' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/must exactly match/i);
    expect(refundService.record).not.toHaveBeenCalled();

    // Exact amount succeeds.
    refundService.record.mockResolvedValue({ data: { amount: 1200, status: 'succeeded', lifecycle: {} } });
    await user.clear(amountInput);
    await user.type(amountInput, '1200');
    await user.click(screen.getByRole('button', { name: 'Record refund' }));
    await waitFor(() => expect(refundService.record).toHaveBeenCalledWith('r1', expect.objectContaining({
      confirmCompleted: true, externalAmount: 1200,
    })));
  });

  it('requires a note when correcting a failed refund', async () => {
    const user = await openRefundModal(returnDetail({ refunds: [{ _id: 'r1', returnRequestId: 'ret1', amount: 1200, status: 'failed' }] }));

    await user.click(screen.getByLabelText(/I confirm this refund was already completed/i));
    await user.click(screen.getByRole('button', { name: 'Record refund' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/note explaining the correction/i);
    expect(refundService.record).not.toHaveBeenCalled();

    refundService.record.mockResolvedValue({ data: { amount: 1200, status: 'succeeded', lifecycle: {} } });
    await user.type(screen.getByLabelText('Note'), 'Provider dashboard confirms settlement');
    await user.click(screen.getByRole('button', { name: 'Record refund' }));
    await waitFor(() => expect(refundService.record).toHaveBeenCalledWith('r1', expect.objectContaining({
      note: 'Provider dashboard confirms settlement',
    })));
  });

  it('displays a backend ceiling error clearly', async () => {
    const user = await openRefundModal(returnDetail({ refunds: [{ _id: 'r1', returnRequestId: 'ret1', amount: 1200, status: 'pending' }] }));
    const message = 'Recording this refund would exceed the refundable value of the returned items.';
    refundService.record.mockRejectedValue({ response: { data: { message } } });

    await user.click(screen.getByLabelText(/I confirm this refund was already completed/i));
    await user.click(screen.getByRole('button', { name: 'Record refund' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(message));
  });

  it('shows success confirmation with lifecycle exceptions and refreshes the queue', async () => {
    const user = await openRefundModal(returnDetail({ refunds: [{ _id: 'r1', returnRequestId: 'ret1', amount: 1200, status: 'pending' }] }));
    refundService.record.mockResolvedValue({
      data: {
        amount: 1200,
        status: 'succeeded',
        lifecycle: {
          paymentStatusSetTo: 'refunded',
          returnRequest: 'refunded',
          shipment: 'skipped:returned',
          passesRefunded: 1,
          passExceptions: [{ passId: 'p1', status: 'checked_in' }],
        },
      },
    });
    const callsBefore = returnService.getReturns.mock.calls.length;

    await user.click(screen.getByLabelText(/I confirm this refund was already completed/i));
    await user.click(screen.getByRole('button', { name: 'Record refund' }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(/recorded as completed/i);
    expect(status).toHaveTextContent(/1 checked-in Pass\(es\)/i);
    expect(status).toHaveTextContent(/Shipment transition skipped/i);

    await waitFor(() => expect(returnService.getReturns.mock.calls.length).toBeGreaterThan(callsBefore));
  });
});

describe('AdminReturns — adjustment modes', () => {
  async function openAdjust(detail) {
    const user = await openRefundModal(detail);
    await user.click(screen.getByRole('button', { name: 'Adjust amount' }));
    return user;
  }

  it('submits a recompute adjustment with the mandatory reason', async () => {
    const user = await openAdjust(returnDetail({ refunds: [{ _id: 'r1', returnRequestId: 'ret1', amount: 1200, status: 'pending' }] }));
    refundService.adjust.mockResolvedValue({ data: { amount: 1000, status: 'pending' } });

    await user.type(screen.getByLabelText('Reason'), 'corrected to attributable value');
    await user.click(screen.getByRole('button', { name: 'Apply adjustment' }));

    await waitFor(() => expect(refundService.adjust).toHaveBeenCalledWith('r1', {
      externalPayment: 'none', recompute: true, reason: 'corrected to attributable value',
    }));
  });

  it('submits an explicit-amount adjustment', async () => {
    const user = await openAdjust(returnDetail({ refunds: [{ _id: 'r1', returnRequestId: 'ret1', amount: 1200, status: 'pending' }] }));
    refundService.adjust.mockResolvedValue({ data: { amount: 600, status: 'pending' } });

    await user.click(screen.getByLabelText(/Set an explicit amount/i));
    await user.type(screen.getByLabelText('New amount'), '600');
    await user.type(screen.getByLabelText('Reason'), 'goodwill partial');
    await user.click(screen.getByRole('button', { name: 'Apply adjustment' }));

    await waitFor(() => expect(refundService.adjust).toHaveBeenCalledWith('r1', {
      externalPayment: 'none', amount: 600, reason: 'goodwill partial',
    }));
  });

  it('submits an already-sent reconciliation adjustment', async () => {
    const user = await openAdjust(returnDetail({ refunds: [{ _id: 'r1', returnRequestId: 'ret1', amount: 1200, status: 'failed' }] }));
    refundService.adjust.mockResolvedValue({ data: { amount: 900, status: 'failed' } });

    await user.click(screen.getByLabelText(/Reconcile an amount already sent/i));
    await user.type(screen.getByLabelText('Already-sent amount'), '900');
    await user.type(screen.getByLabelText('Reason'), 'bank statement confirms 900');
    await user.click(screen.getByRole('button', { name: 'Apply adjustment' }));

    await waitFor(() => expect(refundService.adjust).toHaveBeenCalledWith('r1', {
      externalPayment: 'already_sent', externalAmount: 900, reason: 'bank statement confirms 900',
    }));
  });

  it('requires a reason before adjusting', async () => {
    const user = await openAdjust(returnDetail({ refunds: [{ _id: 'r1', returnRequestId: 'ret1', amount: 1200, status: 'pending' }] }));
    await user.click(screen.getByRole('button', { name: 'Apply adjustment' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/reason is required/i);
    expect(refundService.adjust).not.toHaveBeenCalled();
  });
});

describe('AdminReturns — refund scope banner', () => {
  it('shows only THIS return’s progress, never another return’s succeeded refund', async () => {
    // Two return requests on one order: a succeeded refund on the OTHER return
    // and a pending refund on THIS one. The banner must ignore the other return
    // (and the order-wide total) entirely.
    await openRefundModal(returnDetail({
      orderTotal: 1500,
      refunds: [
        { _id: 'r-other', returnRequestId: 'other-return', amount: 900, status: 'succeeded' },
        { _id: 'r-right', returnRequestId: 'ret1', amount: 1200, status: 'pending' },
      ],
    }));

    const banner = screen.getByTestId('refund-scope-banner');
    expect(banner).toHaveTextContent(/this return/i);
    // Zero succeeded refunds for THIS return must read as "not yet refunded",
    // never "partially refunded" — nothing has been paid out yet.
    expect(banner).toHaveTextContent(/not yet refunded/i);
    expect(banner).not.toHaveTextContent(/partially refunded/i);
    expect(banner).toHaveTextContent(/₱0\.00 of ₱1200\.00/);
    // Neither the other return's succeeded refund nor the order-wide total leaks in.
    expect(banner).not.toHaveTextContent(/900/);
    expect(banner).not.toHaveTextContent(/1500/);
  });

  it('reports a positive partial amount below the attributable total as partially refunded', async () => {
    // The pending refund (the one being recorded/adjusted) is 1200; a prior
    // succeeded refund on the SAME return already paid out 500 of it.
    await openRefundModal(returnDetail({
      orderTotal: 1500,
      refunds: [
        { _id: 'r-current', returnRequestId: 'ret1', amount: 1200, status: 'pending' },
        { _id: 'r-succeeded', returnRequestId: 'ret1', amount: 500, status: 'succeeded' },
      ],
    }));

    const banner = screen.getByTestId('refund-scope-banner');
    expect(banner).toHaveTextContent(/partially refunded/i);
    expect(banner).toHaveTextContent(/₱500\.00 of ₱1200\.00/);
    expect(banner).not.toHaveTextContent(/not yet refunded/i);
    expect(banner).not.toHaveTextContent(/fully refunded/i);
  });

  it('reports fully refunded when this return’s own refund succeeded', async () => {
    await openRefundModal(returnDetail({
      orderTotal: 1500,
      refunds: [{ _id: 'r1', returnRequestId: 'ret1', amount: 1200, status: 'succeeded' }],
    }));

    const banner = screen.getByTestId('refund-scope-banner');
    expect(banner).toHaveTextContent(/fully refunded/i);
    expect(banner).toHaveTextContent(/₱1200\.00 of ₱1200\.00/);
  });
});
