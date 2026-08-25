import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PinnedWidgets from '../PinnedWidgets';

vi.mock('../../../../services/reportService', () => ({
  default: {
    getDashboardWidgetConfig: vi.fn(),
    getDashboardWidgetData: vi.fn(),
    setDashboardWidgetActive: vi.fn(),
  },
}));

const reportService = (await import('../../../../services/reportService')).default;

// The backend config can (and, pre-Phase-2, did) still contain the 5
// retired STATUS/NEEDS ATTENTION-style keys — this component must never
// offer them for customization again, regardless of what the API returns.
const CONFIG_WITH_RETIRED_KEYS = [
  { key: 'todaysRevenue', active: true, displayOrder: 0 },
  { key: 'todaysOrders', active: true, displayOrder: 1 },
  { key: 'lowStock', active: true, displayOrder: 2 },
  { key: 'pendingShipments', active: true, displayOrder: 3 },
  { key: 'failedPayments', active: true, displayOrder: 4 },
  { key: 'mostViewedProducts', active: true, displayOrder: 5 },
  { key: 'mostTriedOnProducts', active: false, displayOrder: 6 },
];

const WIDGET_DATA = {
  todaysRevenue: 500, todaysOrders: 2, lowStock: 3, pendingShipments: 1, failedPayments: 0,
  mostViewedProducts: [{ name: 'Gilas Jersey', totalViews: 40 }],
  mostTriedOnProducts: [],
};

describe('PinnedWidgets — Admin Dashboard Phase 2, scoped to PERFORMANCE-only widgets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reportService.getDashboardWidgetConfig.mockResolvedValue({ data: CONFIG_WITH_RETIRED_KEYS });
    reportService.getDashboardWidgetData.mockResolvedValue({ data: WIDGET_DATA });
    reportService.setDashboardWidgetActive.mockResolvedValue({});
  });

  it('never renders a retired STATUS/NEEDS ATTENTION-style widget, even though the backend still returns one as active', async () => {
    render(<PinnedWidgets />);

    expect(await screen.findByText('Most Viewed Products')).toBeTruthy();
    expect(screen.queryByText("Today's Revenue")).toBeNull();
    expect(screen.queryByText("Today's Orders")).toBeNull();
    expect(screen.queryByText('Low Stock')).toBeNull();
    expect(screen.queryByText('Pending Shipments')).toBeNull();
    expect(screen.queryByText('Failed Payments (Today)')).toBeNull();
  });

  it('the Customize checklist only ever lists the two Performance-tier widgets, not the retired ones', async () => {
    render(<PinnedWidgets />);
    await screen.findByText('Most Viewed Products');

    fireEvent.click(screen.getByRole('button', { name: /customize/i }));

    expect(screen.getByRole('checkbox', { name: 'Most Viewed Products' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Most Tried-On Products' })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: "Today's Revenue" })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Low Stock' })).toBeNull();
  });
});
