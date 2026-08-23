import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import OrderConfirmation from '../OrderConfirmation';

vi.mock('../../components/layout/Layout', () => ({ default: ({ children }) => <>{children}</> }));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => <div data-testid="loading-spinner" /> }));
vi.mock('../../components/locker/PassTicket', () => ({ default: () => <div data-testid="pass-ticket" /> }));
vi.mock('../../components/orders/OrderTimeline', () => ({ default: () => <div data-testid="order-timeline" /> }));
vi.mock('../../components/orders/CompletePaymentButton', () => ({ default: () => <div data-testid="complete-payment-button" /> }));
vi.mock('../../utils/orderPdf', () => ({ downloadOrderSummaryPdf: vi.fn() }));
vi.mock('../../hooks/usePaymentCountdown', () => ({ default: () => ({ formatted: null, isExpired: false }) }));
vi.mock('../../store/cartStore', () => ({ default: { getState: () => ({ clearCart: vi.fn() }) } }));
vi.mock('../../store/passCartStore', () => ({ default: { getState: () => ({ clear: vi.fn() }) } }));
vi.mock('../../services/orderService', () => ({
  default: { getOrderByNumber: vi.fn(), verifyPayment: vi.fn() },
}));

const orderService = (await import('../../services/orderService')).default;

const paidPassOrder = {
  orderNumber: 'PS-20260823-PASS',
  createdAt: '2026-08-23T01:00:00.000Z',
  paymentMethod: 'xendit',
  paymentStatus: 'paid',
  orderStatus: 'paid',
  total: 500,
  items: [],
  passes: [{ _id: 'pass-1', status: 'issued', qrToken: 'qr-token', qrCodeUrl: 'data:image/png;base64,qr' }],
};

// A full Merchandise order fixture — the page renders Order Details
// (items/shippingAddress/subtotal/shippingFee) unconditionally once
// `order` is set, regardless of which hero/status card is showing, so
// every fixture needs these fields populated to avoid a render crash.
function makeOrder(overrides = {}) {
  return {
    orderNumber: 'PS-20260823-MERCH',
    createdAt: '2026-08-23T01:00:00.000Z',
    paymentMethod: 'xendit',
    paymentStatus: 'pending',
    orderStatus: 'awaiting_payment',
    total: 500,
    subtotal: 500,
    shippingFee: 0,
    items: [{ name: 'Jersey', size: 'M', quantity: 1, price: 500, image: 'https://example.com/jersey.png' }],
    passes: [],
    shippingAddress: { fullName: 'Maria Santos', phone: '0917', address: '1 Rizal', city: 'QC', province: 'NCR', zipCode: '1000' },
    payment: null,
    ...overrides,
  };
}

function renderPage(orderNumber, query = '?payment=success') {
  render(
    <MemoryRouter initialEntries={[`/order/${orderNumber}${query}`]}>
      <Routes>
        <Route path="/order/:orderNumber" element={<OrderConfirmation />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('OrderConfirmation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the paid pass before a slow payment verification response completes', async () => {
    let resolveVerification;
    orderService.getOrderByNumber.mockResolvedValue({ data: paidPassOrder });
    orderService.verifyPayment.mockReturnValue(new Promise((resolve) => {
      resolveVerification = resolve;
    }));

    renderPage('PS-20260823-PASS');

    expect(await screen.findByRole('heading', { name: 'Order Confirmed!' })).toBeTruthy();
    expect(screen.queryByTestId('loading-spinner')).toBeNull();

    resolveVerification({ data: { paymentStatus: 'paid' } });
  });

  it('renders a paid Merchandise confirmation without a runtime render error', async () => {
    orderService.getOrderByNumber.mockResolvedValue({
      data: {
        ...paidPassOrder,
        items: [{ name: 'Jersey', size: 'M', quantity: 1, price: 500, image: 'https://example.com/jersey.png' }],
        passes: [],
        subtotal: 500,
        shippingFee: 0,
        shippingAddress: { fullName: 'Maria Santos', phone: '0917', address: '1 Rizal', city: 'QC', province: 'NCR', zipCode: '1000' },
      },
    });

    renderPage('PS-20260823-PASS');

    expect(await screen.findByRole('heading', { name: 'Order Confirmed!' })).toBeTruthy();
  });

  describe('Post-Payment Processing UX', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('1. ?payment=success with an initially-awaiting_payment order shows "Processing Your Payment", never "Complete Your Payment"', async () => {
      orderService.getOrderByNumber.mockResolvedValue({ data: makeOrder() });
      orderService.verifyPayment.mockReturnValue(new Promise(() => {})); // never resolves in this test

      renderPage('PS-20260823-MERCH');

      expect(await screen.findByRole('heading', { name: 'Processing Your Payment' })).toBeTruthy();
      expect(screen.queryByRole('heading', { name: 'Complete Your Payment' })).toBeNull();
      expect(screen.queryByText(/complete your payment/i)).toBeNull();

      // Meaningful status text for assistive tech, not just a spinner.
      const region = screen.getByRole('status', { name: 'Payment processing status' });
      expect(region.getAttribute('aria-busy')).toBe('true');
      expect(screen.getByText(/verifying payment/i)).toBeTruthy();
    });

    it('2. ?payment=success with paymentStatus already paid shows the existing successful confirmation state directly', async () => {
      orderService.getOrderByNumber.mockResolvedValue({ data: makeOrder({ paymentStatus: 'paid', orderStatus: 'paid' }) });

      renderPage('PS-20260823-MERCH');

      expect(await screen.findByRole('heading', { name: 'Order Confirmed!' })).toBeTruthy();
      expect(screen.queryByRole('heading', { name: 'Processing Your Payment' })).toBeNull();
      // No unnecessary verification call for an order already resolved.
      expect(orderService.verifyPayment).not.toHaveBeenCalled();
    });

    it('3. ?payment=success with paymentStatus already failed shows the existing failure/recovery state directly', async () => {
      orderService.getOrderByNumber.mockResolvedValue({
        data: makeOrder({ paymentStatus: 'failed', orderStatus: 'failed_payment' }),
      });

      renderPage('PS-20260823-MERCH');

      expect(await screen.findByRole('heading', { name: "Payment Didn't Go Through" })).toBeTruthy();
      expect(screen.queryByRole('heading', { name: 'Processing Your Payment' })).toBeNull();
      expect(screen.getByTestId('complete-payment-button')).toBeTruthy(); // "Try Again" recovery action
    });

    it('4. a normal awaiting_payment order WITHOUT ?payment=success keeps the existing "Complete Your Payment" behavior', async () => {
      orderService.getOrderByNumber.mockResolvedValue({ data: makeOrder() });

      renderPage('PS-20260823-MERCH', '');

      expect(await screen.findByRole('heading', { name: 'Complete Your Payment' })).toBeTruthy();
      expect(screen.queryByRole('heading', { name: 'Processing Your Payment' })).toBeNull();
      expect(orderService.verifyPayment).not.toHaveBeenCalled();
    });

    it('5. transitions from "Processing" to the paid confirmation once verification resolves paid', async () => {
      // Deliberately controlled (not instantly-resolved) so the
      // intermediate "Processing" render is actually observable before
      // moving on — an instantly-resolving mock can race past it entirely.
      let resolveVerify;
      orderService.getOrderByNumber
        .mockResolvedValueOnce({ data: makeOrder() }) // initial read
        .mockResolvedValueOnce({ data: makeOrder({ paymentStatus: 'paid', orderStatus: 'paid' }) }); // post-verification refresh
      orderService.verifyPayment.mockReturnValue(new Promise((resolve) => {
        resolveVerify = resolve;
      }));

      renderPage('PS-20260823-MERCH');

      expect(await screen.findByRole('heading', { name: 'Processing Your Payment' })).toBeTruthy();

      await act(async () => {
        resolveVerify({ data: { paymentStatus: 'paid' } });
        await Promise.resolve();
      });

      expect(await screen.findByRole('heading', { name: 'Order Confirmed!' })).toBeTruthy();
      expect(screen.queryByRole('heading', { name: 'Processing Your Payment' })).toBeNull();
    });

    it('6. shows a neutral "taking longer" state after the poll budget is exhausted — never a failure state', async () => {
      vi.useFakeTimers();
      orderService.getOrderByNumber.mockResolvedValue({ data: makeOrder() });
      orderService.verifyPayment.mockResolvedValue({ data: { paymentStatus: 'pending' } });

      renderPage('PS-20260823-MERCH');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByRole('heading', { name: 'Processing Your Payment' })).toBeTruthy();

      // 8 attempts total, 2.5s apart — advance well past the full budget.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500 * 9);
      });

      expect(screen.getByRole('heading', { name: 'Payment Confirmation Is Taking Longer' })).toBeTruthy();
      expect(screen.queryByRole('heading', { name: "Payment Didn't Go Through" })).toBeNull();
      expect(screen.queryByText(/payment failed/i)).toBeNull();
      expect(screen.getByRole('button', { name: 'Check Order Status' })).toBeTruthy();
    });

    it('7. refreshing (a fresh mount) after a payment already succeeded never shows "Complete Your Payment"', async () => {
      // A "refresh" is a fresh mount of the same URL — ?payment=success is
      // still present (it's part of the URL, not component state), and the
      // order now reads paid on the very first fetch.
      orderService.getOrderByNumber.mockResolvedValue({ data: makeOrder({ paymentStatus: 'paid', orderStatus: 'paid' }) });

      renderPage('PS-20260823-MERCH');

      expect(await screen.findByRole('heading', { name: 'Order Confirmed!' })).toBeTruthy();
      expect(screen.queryByRole('heading', { name: 'Complete Your Payment' })).toBeNull();
      expect(screen.queryByRole('heading', { name: 'Processing Your Payment' })).toBeNull();
    });

    it('8. no fake progress percentage is ever rendered during processing', async () => {
      orderService.getOrderByNumber.mockResolvedValue({ data: makeOrder() });
      orderService.verifyPayment.mockReturnValue(new Promise(() => {}));

      renderPage('PS-20260823-MERCH');

      await screen.findByRole('heading', { name: 'Processing Your Payment' });
      expect(screen.queryByText(/%/)).toBeNull();
    });
  });
});
