import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import OrderConfirmation from '../OrderConfirmation';

vi.mock('../../components/layout/Layout', () => ({ default: ({ children }) => <>{children}</> }));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => <div data-testid="loading-spinner" /> }));
vi.mock('../../components/locker/PassTicket', () => ({ default: () => <div data-testid="pass-ticket" /> }));
vi.mock('../../components/orders/OrderTimeline', () => ({ default: () => <div data-testid="order-timeline" /> }));
vi.mock('../../components/orders/CompletePaymentButton', () => ({ default: () => null }));
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

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/order/PS-20260823-PASS?payment=success']}>
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

    renderPage();

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

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Order Confirmed!' })).toBeTruthy();
  });
});
