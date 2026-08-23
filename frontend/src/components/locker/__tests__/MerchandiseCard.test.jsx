import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MerchandiseCard from '../../locker/MerchandiseCard';
import DeliveryProgress from '../../locker/DeliveryProgress';

vi.mock('../../../services/orderService', () => ({
  default: { payOrder: vi.fn() },
}));
vi.mock('../../orders/CompletePaymentButton', () => ({
  default: ({ orderNumber }) => <button>{orderNumber}</button>,
}));

function merchantOrder(overrides = {}) {
  return {
    _id: 'o1', orderNumber: 'PS-20260822-ABC123', createdAt: '2026-08-20T10:00:00Z',
    paymentStatus: 'paid', orderStatus: 'shipped', total: 1500,
    courier: 'J&T', trackingNumber: 'JT12345',
    items: [{ _id: 'i1', name: 'Gilas Jersey', size: 'M', color: 'Blue', quantity: 2, price: 1500, image: 'https://img.test/jersey.jpg' }],
    ...overrides,
  };
}

describe('MerchandiseCard — real delivery/tracking rendering', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders product image, name, variant and quantity', () => {
    render(<MemoryRouter><MerchandiseCard order={merchantOrder()} /></MemoryRouter>);
    expect(screen.getByAltText('Gilas Jersey').getAttribute('src')).toBe('https://img.test/jersey.jpg');
    expect(screen.getByText('Gilas Jersey')).toBeTruthy();
    expect(screen.getByText(/Size M/)).toBeTruthy();
    expect(screen.getByAltText('Gilas Jersey')).toBeTruthy();
    expect(screen.getByText(/Blue/)).toBeTruthy();
    expect(screen.getByText('×2')).toBeTruthy();
  });

  it('shows the delivered progression label and state (orderStatus=delivered)', () => {
    render(<MemoryRouter><MerchandiseCard order={merchantOrder({ orderStatus: 'delivered' })} /></MemoryRouter>);
    expect(screen.getAllByText('Delivered').length).toBeGreaterThanOrEqual(1);
  });

  it('shows terminal state for failed payment instead of a fake progress', () => {
    render(<MemoryRouter><MerchandiseCard order={merchantOrder({ orderStatus: 'failed_payment', paymentStatus: 'failed' })} /></MemoryRouter>);
    expect(screen.getByText('Payment Failed')).toBeTruthy();
  });

  it('shows tracking only when both courier and tracking number exist', () => {
    const { rerender } = render(<MemoryRouter><MerchandiseCard order={merchantOrder()} /></MemoryRouter>);
    expect(screen.getByText('J&T')).toBeTruthy();
    expect(screen.getByText('JT12345')).toBeTruthy();
    expect(screen.getByText('Track Package')).toBeTruthy();

    rerender(<MemoryRouter><MerchandiseCard order={merchantOrder({ courier: null, trackingNumber: null })} /></MemoryRouter>);
    expect(screen.queryByText('Track Package')).toBeNull();
    expect(screen.queryByText('JT12345')).toBeNull();
  });

  it('shows a payment CTA when unpaid', () => {
    render(<MemoryRouter><MerchandiseCard order={merchantOrder({ paymentStatus: 'pending', orderStatus: 'awaiting_payment' })} /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'PS-20260822-ABC123' })).toBeTruthy();
  });

  it('hides the payment CTA for a paid order', () => {
    render(<MemoryRouter><MerchandiseCard order={merchantOrder()} /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: 'PS-20260822-ABC123' })).toBeNull();
  });
});

describe('DeliveryProgress — orderStatus to visible state', () => {
  it('marks Delivered complete for a delivered order', () => {
    render(<DeliveryProgress orderStatus="delivered" />);
    expect(screen.getByText('Delivered')).toBeTruthy();
  });

  it('renders Payment Failed instead of a partial progression', () => {
    render(<DeliveryProgress orderStatus="failed_payment" />);
    expect(screen.getByText('Payment Failed')).toBeTruthy();
  });

  it('does not invent an out-for-delivery step (shipped only reaches Shipped)', () => {
    render(<DeliveryProgress orderStatus="shipped" />);
    expect(screen.getByText('Shipped')).toBeTruthy();
    expect(screen.queryByText('Out for Delivery')).toBeNull();
  });
});
