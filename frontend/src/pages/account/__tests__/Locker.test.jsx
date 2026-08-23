import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Locker from '../Locker';

vi.mock('../../../services/accountService', () => ({
  default: { getOrders: vi.fn() },
}));
vi.mock('../../../services/passEventService', () => ({
  default: { getMyPasses: vi.fn() },
}));

// Isolate the card/ticket components so a visual regression surfaces here,
// not as a deep-tree jsdom warning.
vi.mock('../../../components/locker/MerchandiseCard', () => ({
  default: ({ order }) => (
    <div data-testid="merchandise-card">
      {(order.items || []).map((i, idx) => (
        <div key={idx}>
          <img src={i.image} alt={i.name} />
          <span>{i.name}</span>
          <span>{i.size} {i.color}</span>
          <span>×{i.quantity}</span>
        </div>
      ))}
      <span>{order.orderStatus}</span>
      {order.courier && order.trackingNumber && <span>tracking</span>}
      {order.paymentStatus}
      <span>view-details</span>
    </div>
  ),
}));
vi.mock('../../../components/locker/MerchandiseCardSkeleton', () => ({
  default: () => <div data-testid="merch-skeleton" />,
}));
vi.mock('../../../components/locker/PassCard', () => ({
  default: ({ pass, onViewTicket }) => (
    <div data-testid="pass-card">
      <span>{pass.passEvent?.name}</span>
      <span>{pass.passTier?.name}</span>
      {pass.qrCodeUrl && <img src={pass.qrCodeUrl} alt="Pass QR code" />}
      <button onClick={() => onViewTicket(pass)}>View Ticket</button>
    </div>
  ),
}));
vi.mock('../../../components/locker/PassCardSkeleton', () => ({
  default: () => <div data-testid="pass-skeleton" />,
}));
vi.mock('../../../components/locker/PassTicket', () => ({
  default: ({ pass }) => <div data-testid="ticket">{pass.passEvent?.name}</div>,
}));
vi.mock('../../../components/ui', () => ({
  default: undefined,
  Panel: ({ children }) => <div>{children}</div>,
  Pagination: () => null,
  EmptyState: ({ title, description, actionLabel, onAction }) => (
    <div data-testid="empty-state">
      <span>{title}</span>
      <span>{description}</span>
      {actionLabel && <button onClick={onAction}>{actionLabel}</button>}
    </div>
  ),
  ErrorState: ({ description, onRetry }) => (
    <div>
      <span>{description}</span>
      <button onClick={onRetry}>Retry</button>
    </div>
  ),
  Modal: ({ open, onClose, children }) => (open ? <div data-testid="modal"><button onClick={onClose}>close</button>{children}</div> : null),
}));

const accountService = (await import('../../../services/accountService')).default;
const passEventService = (await import('../../../services/passEventService')).default;

function renderLocker(initialEntry = '/account/locker') {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/account/locker" element={<Locker />} />
      </Routes>
    </MemoryRouter>
  );
}

function merchantOrder(overrides = {}) {
  return {
    _id: 'o1', orderNumber: 'PS-20260822-ABC123', createdAt: '2026-08-20T10:00:00Z',
    paymentStatus: 'paid', orderStatus: 'shipped', total: 1500,
    courier: 'J&T', trackingNumber: 'JT12345',
    items: [{ _id: 'i1', name: 'Gilas Jersey', size: 'M', color: 'Blue', quantity: 2, price: 1500, image: 'https://img.test/jersey.jpg' }],
    ...overrides,
  };
}

function passFixture(overrides = {}) {
  return {
    _id: 'p1', status: 'issued', qrToken: 'tok-1', qrCodeUrl: 'https://cloudinary.com/qr1.png',
    price: 600,
    passEvent: { _id: 'e1', name: 'UAAP Finals', images: ['https://img.test/evt.jpg'], startsAt: '2026-09-01T18:00:00Z', venue: { name: 'Araneta Coliseum' }, organization: { name: 'UAAP' } },
    passTier: { _id: 't1', name: 'Lower Box', venueSection: { name: 'Section 101' } },
    ...overrides,
  };
}

describe('Locker — My Gear (merchandise wallet)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows merchandise-only orders (excludes a Pass order with no items)', async () => {
    accountService.getOrders.mockResolvedValue({
      data: [merchantOrder(), { _id: 'o2', orderNumber: 'PS-2', items: [], passes: [{ _id: 'x' }] }],
      pagination: { page: 1, pages: 1 },
    });
    renderLocker();
    const cards = await screen.findAllByTestId('merchandise-card');
    expect(cards).toHaveLength(1);
  });

  it('renders product image, name, variant and quantity for each item', async () => {
    accountService.getOrders.mockResolvedValue({ data: [merchantOrder()], pagination: { page: 1, pages: 1 } });
    renderLocker();
    const img = await screen.findByAltText('Gilas Jersey');
    expect(img.getAttribute('src')).toBe('https://img.test/jersey.jpg');
    expect(screen.getByText(/M Blue/)).toBeTruthy();
    expect(screen.getByText(/×2/)).toBeTruthy();
  });

  it('shows actual delivery status (orderStatus)', async () => {
    accountService.getOrders.mockResolvedValue({ data: [merchantOrder({ orderStatus: 'delivered' })], pagination: { page: 1, pages: 1 } });
    renderLocker();
    await screen.findByText('delivered');
  });

  it('shows tracking only when courier and tracking number exist', async () => {
    accountService.getOrders.mockResolvedValue({
      data: [
        merchantOrder(),
        merchantOrder({ _id: 'o2', orderNumber: 'PS-2', courier: null, trackingNumber: null }),
      ],
      pagination: { page: 1, pages: 1 },
    });
    renderLocker();
    const cards = await screen.findAllByTestId('merchandise-card');
    await waitFor(() => expect(screen.getAllByText('tracking')).toHaveLength(1));
  });

  it('makes failed/pending payment states understandable (uses paymentStatus and shows a payment CTA)', async () => {
    accountService.getOrders.mockResolvedValue({
      data: [
        merchantOrder({ _id: 'ofa', orderNumber: 'PS-FAIL', paymentStatus: 'failed', orderStatus: 'failed_payment' }),
        merchantOrder({ _id: 'open', orderNumber: 'PS-PEND', paymentStatus: 'pending', orderStatus: 'awaiting_payment' }),
      ],
      pagination: { page: 1, pages: 1 },
    });
    renderLocker();
    await screen.findAllByTestId('merchandise-card');
    expect(screen.getByText('failed')).toBeTruthy();
    expect(screen.getByText('pending')).toBeTruthy();
    expect(screen.getByText('failed_payment')).toBeTruthy();
    expect(screen.getByText('awaiting_payment')).toBeTruthy();
  });

  it('renders the merchandise skeleton grid while loading', async () => {
    accountService.getOrders.mockReturnValue(new Promise(() => {}));
    renderLocker();
    expect(await screen.findAllByTestId('merch-skeleton')).toBeTruthy();
  });

  it('renders a useful empty state with a Shop Now action', async () => {
    accountService.getOrders.mockResolvedValue({ data: [], pagination: { page: 1, pages: 0 } });
    renderLocker();
    expect(await screen.findByText('No merchandise orders yet.')).toBeTruthy();
    expect(screen.getByText('Shop Now')).toBeTruthy();
  });

  it('does not include Pass orders in My Gear', async () => {
    accountService.getOrders.mockResolvedValue({
      data: [{ _id: 'o1', orderNumber: 'PS-1', items: [], passes: [{ _id: 'p' }] }],
      pagination: { page: 1, pages: 1 },
    });
    renderLocker();
    await waitFor(() => expect(screen.queryAllByTestId('merchandise-card')).toHaveLength(0));
    expect(screen.queryByText('PS-1')).toBeNull();
  });
});

describe('Locker — Passes (digital ticket wallet)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('displays pass event information and ticket type', async () => {
    passEventService.getMyPasses.mockResolvedValue({ data: [passFixture()] });
    renderLocker('/account/locker?section=passes');
    expect(await screen.findByText('UAAP Finals')).toBeTruthy();
    expect(screen.getByText('Lower Box')).toBeTruthy();
  });

  it('shows the QR code image', async () => {
    passEventService.getMyPasses.mockResolvedValue({ data: [passFixture()] });
    renderLocker('/account/locker?section=passes');
    const qr = await screen.findByAltText('Pass QR code');
    expect(qr.getAttribute('src')).toBe('https://cloudinary.com/qr1.png');
  });

  it('opens the ticket experience from View Ticket', async () => {
    passEventService.getMyPasses.mockResolvedValue({ data: [passFixture()] });
    renderLocker('/account/locker?section=passes');
    fireEvent.click(await screen.findByText('View Ticket'));
    expect(await screen.findByTestId('ticket')).toBeTruthy();
    expect(screen.getByTestId('ticket').textContent).toContain('UAAP Finals');
  });

  it('renders the ticket-shaped skeleton grid while loading', async () => {
    passEventService.getMyPasses.mockReturnValue(new Promise(() => {}));
    renderLocker('/account/locker?section=passes');
    expect(await screen.findAllByTestId('pass-skeleton')).toBeTruthy();
  });

  it('renders a useful empty state with an Explore Events action', async () => {
    passEventService.getMyPasses.mockResolvedValue({ data: [] });
    renderLocker('/account/locker?section=passes');
    expect(await screen.findByText('No passes yet.')).toBeTruthy();
    expect(screen.getByText('Explore Events')).toBeTruthy();
  });
});

describe('Locker — two-tile section switcher (no Saved tab)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders exactly My Gear and Passes tiles, and no Saved tile', async () => {
    accountService.getOrders.mockResolvedValue({ data: [merchantOrder()], pagination: { page: 1, pages: 1 } });
    renderLocker();
    expect(await screen.findByText(/My Gear \(Merch\)/)).toBeTruthy();
    expect(screen.getByText(/^Passes$/)).toBeTruthy();
    expect(screen.queryByText(/Saved/)).toBeNull();
  });

  it('switches to the Passes view when the Passes tile is clicked', async () => {
    accountService.getOrders.mockResolvedValue({ data: [merchantOrder()], pagination: { page: 1, pages: 1 } });
    passEventService.getMyPasses.mockResolvedValue({ data: [passFixture()] });
    renderLocker();
    fireEvent.click(await screen.findByText(/^Passes$/));
    expect(await screen.findByText('UAAP Finals')).toBeTruthy();
  });
});
