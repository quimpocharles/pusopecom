import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboard from '../AdminDashboard';

vi.mock('../../../services/reportService', () => ({
  default: { getExecutiveReport: vi.fn() },
}));
vi.mock('../../../services/orderService', () => ({
  default: { getOrderStats: vi.fn(), getAllOrders: vi.fn() },
}));
vi.mock('../../../services/authService', () => ({
  default: { getAdminUsers: vi.fn() },
}));
// PinnedWidgets makes its own independent calls (getDashboardWidgetConfig/
// Data) and is unit-tested separately (PinnedWidgets.test.jsx) — stubbed
// here so these tests aren't coupled to its internals, matching how other
// pages in this suite stub unrelated child components (e.g. Layout, SEO).
vi.mock('../../../components/admin/dashboard/PinnedWidgets', () => ({
  default: () => <div data-testid="pinned-widgets-stub">Pinned widgets</div>,
}));

const reportService = (await import('../../../services/reportService')).default;
const orderService = (await import('../../../services/orderService')).default;
const authService = (await import('../../../services/authService')).default;

const FORBIDDEN_ERROR = { response: { status: 403, data: { message: 'Forbidden' } } };
const SERVER_ERROR = { response: { status: 500, data: { message: 'Boom' } } };

function makeExecutiveData(overrides = {}) {
  return {
    kpis: { totalRevenue: 125000, totalOrders: 42, averageOrderValue: 2976, delta: { revenue: 5, orders: 2, averageOrderValue: 1 } },
    operationsHealth: { fulfillmentRate: 92, pendingShipments: 3, failedPayments: 0, refundQueue: 0, exceptions: 0 },
    whatsSelling: { bestSellers: [], salesByCategory: [] },
    revenueOverTime: [],
    alerts: [],
    executiveSummary: ['Revenue was fine.'],
    ...overrides,
  };
}

function setupServices({
  executive = { data: makeExecutiveData() },
  executiveError,
  users = { pagination: { total: 7 } },
  usersError,
  orderStats = { data: { topSellingProducts: [{ _id: 'p1', name: 'Gilas Jersey', image: 'x.jpg', totalQuantity: 10 }] } },
  orderStatsError,
  allOrders = { data: [] },
  allOrdersError,
} = {}) {
  if (executiveError) reportService.getExecutiveReport.mockRejectedValue(executiveError);
  else reportService.getExecutiveReport.mockResolvedValue(executive);

  if (usersError) authService.getAdminUsers.mockRejectedValue(usersError);
  else authService.getAdminUsers.mockResolvedValue(users);

  if (orderStatsError) orderService.getOrderStats.mockRejectedValue(orderStatsError);
  else orderService.getOrderStats.mockResolvedValue(orderStats);

  if (allOrdersError) orderService.getAllOrders.mockRejectedValue(allOrdersError);
  else orderService.getAllOrders.mockResolvedValue(allOrders);
}

function renderDashboard() {
  render(<MemoryRouter><AdminDashboard /></MemoryRouter>);
}

describe('AdminDashboard — Phase 2A permission-aware loading + Phase 2B hierarchy', () => {
  beforeEach(() => vi.clearAllMocks());

  it('1. fully privileged admin sees real data everywhere', async () => {
    setupServices();
    renderDashboard();

    expect(await screen.findByText('₱125,000')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('92%')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('Gilas Jersey')).toBeTruthy();
    expect(screen.queryByText('Not available for your role')).toBeNull();
  });

  it('2. admin missing orders.view: Top Selling and Recent Orders are unavailable, everything else still renders', async () => {
    setupServices({ orderStatsError: FORBIDDEN_ERROR, allOrdersError: FORBIDDEN_ERROR });
    renderDashboard();

    // STATUS (sourced from the ungated executive endpoint) is unaffected.
    expect(await screen.findByText('₱125,000')).toBeTruthy();
    expect(screen.getByText('92%')).toBeTruthy();
    // Users (independent permission) is unaffected.
    expect(screen.getByText('7')).toBeTruthy();

    const unavailable = await screen.findAllByText('Not available for your role');
    expect(unavailable.length).toBe(2); // Top Selling Products + Recent Orders
  });

  it('3. admin missing users.view: only the Users status card is unavailable', async () => {
    setupServices({ usersError: FORBIDDEN_ERROR });
    renderDashboard();

    expect(await screen.findByText('₱125,000')).toBeTruthy();
    expect(screen.getByText('Gilas Jersey')).toBeTruthy();

    const unavailable = await screen.findAllByText('Not available for your role');
    expect(unavailable).toHaveLength(1);
  });

  it('4. partial data failure across two unrelated sources does not block the sections that succeeded', async () => {
    setupServices({ usersError: FORBIDDEN_ERROR, orderStatsError: FORBIDDEN_ERROR });
    renderDashboard();

    // Executive-backed STATUS + Needs Attention still render.
    expect(await screen.findByText('₱125,000')).toBeTruthy();
    expect(screen.getByText('Nothing flagged — operations look healthy.')).toBeTruthy();
    // The two independently-failed sources both show the neutral state.
    const unavailable = await screen.findAllByText('Not available for your role');
    expect(unavailable).toHaveLength(2); // Users + Top Selling Products
  });

  it('5. genuine zero values render as zero, not as an unavailable state', async () => {
    setupServices({
      executive: { data: makeExecutiveData({ kpis: { totalRevenue: 0, totalOrders: 0, averageOrderValue: 0, delta: { revenue: 0, orders: 0, averageOrderValue: 0 } } }) },
      users: { pagination: { total: 0 } },
    });
    renderDashboard();

    expect(await screen.findByText('₱0')).toBeTruthy();
    // Total Orders and Users are both legitimately "0" — assert at least
    // one such zero renders (multiple identical "0" texts can appear).
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    expect(screen.queryByText('Not available for your role')).toBeNull();
    expect(screen.queryByText("Couldn't load")).toBeNull();
  });

  it('6. a 403 never renders as a false "healthy"/empty state', async () => {
    setupServices({ orderStatsError: FORBIDDEN_ERROR });
    renderDashboard();

    await screen.findAllByText('Not available for your role');
    // The old, misleading empty-state copy must never appear as a stand-in
    // for a permission failure.
    expect(screen.queryByText('No sales data yet')).toBeNull();
    expect(screen.queryByText('All products well stocked')).toBeNull();
  });

  it('7. renders the alert feed exactly as returned (severity, message, link), and its own empty state', async () => {
    setupServices({
      executive: {
        data: makeExecutiveData({
          alerts: [
            { severity: 'critical', message: '2 products out of stock', link: '/admin/reports/products' },
            { severity: 'warning', message: '1 refund pending', link: '/admin/reports/finance' },
          ],
        }),
      },
    });
    renderDashboard();

    const outOfStock = await screen.findByRole('link', { name: /2 products out of stock/ });
    expect(outOfStock.getAttribute('href')).toBe('/admin/reports/products');
    const refund = screen.getByRole('link', { name: /1 refund pending/ });
    expect(refund.getAttribute('href')).toBe('/admin/reports/finance');
  });

  it('7b. shows the empty-alerts state when nothing is flagged', async () => {
    setupServices({ executive: { data: makeExecutiveData({ alerts: [] }) } });
    renderDashboard();

    expect(await screen.findByText('Nothing flagged — operations look healthy.')).toBeTruthy();
  });

  it('8. surfaces a "returns awaiting approval" alert linking to Returns & Refunds', async () => {
    setupServices({
      executive: {
        data: makeExecutiveData({
          alerts: [{ severity: 'warning', message: '3 returns awaiting approval', link: '/admin/returns' }],
        }),
      },
    });
    renderDashboard();

    const alert = await screen.findByRole('link', { name: /3 returns awaiting approval/ });
    expect(alert.getAttribute('href')).toBe('/admin/returns');
  });

  it('9. every Recent Order row is a real link to its order detail page', async () => {
    setupServices({
      allOrders: {
        data: [
          { _id: 'o1', orderNumber: 'PS-20260901-AAAA', email: 'a@test.local', total: 500, paymentStatus: 'paid', orderStatus: 'paid', createdAt: '2026-09-01T00:00:00Z' },
          { _id: 'o2', orderNumber: 'PS-20260901-BBBB', email: 'b@test.local', total: 800, paymentStatus: 'pending', orderStatus: 'awaiting_payment', createdAt: '2026-09-01T00:00:00Z' },
        ],
      },
    });
    renderDashboard();

    const row1 = await screen.findByRole('link', { name: 'PS-20260901-AAAA' });
    expect(row1.getAttribute('href')).toBe('/admin/orders/PS-20260901-AAAA');
    const row2 = screen.getByRole('link', { name: 'PS-20260901-BBBB' });
    expect(row2.getAttribute('href')).toBe('/admin/orders/PS-20260901-BBBB');
  });

  it('10. customization (Customize / pin toggles) only appears inside Performance, never Status or Needs Attention', async () => {
    setupServices();
    renderDashboard();

    await screen.findByText('₱125,000');

    const performanceHeading = screen.getByRole('heading', { name: 'Performance', level: 2 });
    const performanceSection = performanceHeading.closest('div');
    expect(within(performanceSection).getByTestId('pinned-widgets-stub')).toBeTruthy();

    // Nothing outside the Performance block offers any pin/customize UI —
    // the stub renders no "Customize" text at all, so any occurrence found
    // outside Performance would indicate STATUS/Needs Attention gained one.
    expect(screen.queryByText('Customize')).toBeNull();
  });

  it('does not let a rejected data source prevent other sections from finishing their own load (no stuck spinners)', async () => {
    setupServices({ allOrdersError: SERVER_ERROR });
    renderDashboard();

    await waitFor(() => expect(screen.getByText('₱125,000')).toBeTruthy());
    expect(await screen.findByText("Couldn't load")).toBeTruthy();
  });
});
