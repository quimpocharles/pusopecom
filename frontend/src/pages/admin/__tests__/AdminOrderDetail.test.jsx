import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminOrderDetail from '../AdminOrderDetail';

vi.mock('../../../services/orderService', () => ({
  default: { getOrderByNumber: vi.fn(), getOrderEvents: vi.fn() },
}));
vi.mock('../../../services/shipmentService', () => ({
  default: {
    getShipmentByOrder: vi.fn(),
    getShipmentEvents: vi.fn(),
    transitionStatus: vi.fn(),
    assign: vi.fn(),
    addNote: vi.fn(),
    cancel: vi.fn(),
  },
}));
vi.mock('../../../services/authService', () => ({
  default: { getAdminUsers: vi.fn().mockResolvedValue({ data: [] }) },
}));

let mockUser;
vi.mock('../../../store/authStore', () => ({
  default: (selector) => selector({ user: mockUser }),
}));

const orderService = (await import('../../../services/orderService')).default;
const shipmentService = (await import('../../../services/shipmentService')).default;

// Launch-readiness permission-model fix — order_management holds
// fulfillment.status_manage only (status read/advance), warehouse/operations
// hold the full fulfillment.manage bundle (everything), scanner holds
// neither. Mirrors backend/lib/permissions.js's DEPARTMENT_DEFAULTS exactly.
function asDepartment(department) {
  mockUser = { role: 'admin', staffProfile: { department, permissions: [] } };
}

const ORDER = {
  _id: 'order-1', orderNumber: 'PS-TEST-1', createdAt: '2026-08-28T01:00:00.000Z',
  paymentStatus: 'paid', orderStatus: 'paid', total: 350, subtotal: 150, shippingFee: 200,
  shippingMethod: 'courier', email: 'fan@example.com', courier: null, trackingNumber: null,
  items: [{ _id: 'item-1', name: 'Jersey', size: 'M', quantity: 1, price: 150, image: 'x.jpg' }],
  shippingAddress: { fullName: 'Test Buyer', phone: '0917', address: '1 St', city: 'QC', province: 'NCR', zipCode: '1000' },
};

const SHIPMENT = { _id: 'shipment-1', status: 'awaiting_picking', assignedToUserId: null, courier: null, trackingNumber: null };

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/admin/orders/PS-TEST-1']}>
      <Routes>
        <Route path="/admin/orders/:orderNumber" element={<AdminOrderDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  orderService.getOrderByNumber.mockResolvedValue({ data: ORDER });
  orderService.getOrderEvents.mockResolvedValue({ data: [] });
  shipmentService.getShipmentByOrder.mockResolvedValue({ data: SHIPMENT });
  shipmentService.getShipmentEvents.mockResolvedValue({ data: [] });
});

describe('AdminOrderDetail — fulfillment.status_manage (order_management)', () => {
  it('18. sees the status dropdown and Save button', async () => {
    asDepartment('order_management');
    renderPage();
    await waitFor(() => expect(screen.getByText('Save')).toBeTruthy());
    expect(screen.getByLabelText('Status')).toBeTruthy();
  });

  it('19. does not see courier/tracking fields', async () => {
    asDepartment('order_management');
    renderPage();
    await waitFor(() => expect(screen.getByText('Save')).toBeTruthy());
    expect(screen.queryByLabelText('Courier')).toBeNull();
    expect(screen.queryByLabelText('Tracking #')).toBeNull();
  });

  it('20. does not see the Assigned To control', async () => {
    asDepartment('order_management');
    renderPage();
    await waitFor(() => expect(screen.getByText('Save')).toBeTruthy());
    expect(screen.queryByLabelText('Assigned To')).toBeNull();
  });

  it('21. does not see the Cancel Order control', async () => {
    asDepartment('order_management');
    renderPage();
    await waitFor(() => expect(screen.getByText('Save')).toBeTruthy());
    expect(screen.queryByText('Cancel Order')).toBeNull();
  });

  it('22. does not see the Internal Notes section', async () => {
    asDepartment('order_management');
    renderPage();
    await waitFor(() => expect(screen.getByText('Save')).toBeTruthy());
    expect(screen.queryByText('Internal Notes')).toBeNull();
  });
});

describe('AdminOrderDetail — fulfillment.manage (warehouse/operations) retains full controls', () => {
  it.each(['warehouse', 'operations'])('23. %s still sees every existing Fulfillment control', async (department) => {
    asDepartment(department);
    renderPage();
    await waitFor(() => expect(screen.getByText('Save')).toBeTruthy());
    expect(screen.getByLabelText('Status')).toBeTruthy();
    expect(screen.getByLabelText('Courier')).toBeTruthy();
    expect(screen.getByLabelText('Tracking #')).toBeTruthy();
    expect(screen.getByLabelText('Assigned To')).toBeTruthy();
    expect(screen.getByText('Cancel Order')).toBeTruthy();
    expect(screen.getByText('Internal Notes')).toBeTruthy();
  });
});

describe('AdminOrderDetail — scanner sees no fulfillment controls', () => {
  it('24. scanner sees none of the status/fulfillment controls', async () => {
    asDepartment('scanner');
    renderPage();
    await waitFor(() => expect(screen.getByText(ORDER.orderNumber)).toBeTruthy());
    expect(screen.queryByLabelText('Status')).toBeNull();
    expect(screen.queryByText('Save')).toBeNull();
    expect(screen.queryByLabelText('Courier')).toBeNull();
    expect(screen.queryByLabelText('Assigned To')).toBeNull();
    expect(screen.queryByText('Cancel Order')).toBeNull();
    expect(screen.queryByText('Internal Notes')).toBeNull();
  });
});

describe('AdminOrderDetail — 403 vs. genuine no-shipment (bug fix)', () => {
  it('25a. a 403 from the shipment fetch renders an authorization/error state, not "hasn\'t been paid for"', async () => {
    asDepartment('order_management');
    shipmentService.getShipmentByOrder.mockRejectedValue({ response: { status: 403 } });
    renderPage();
    await waitFor(() => expect(screen.getByText(/don't have permission to view fulfillment/i)).toBeTruthy());
    expect(screen.queryByText(/hasn't been paid for/i)).toBeNull();
  });

  it('25b. a genuine 404 (no Shipment yet) still renders the original unpaid-order message', async () => {
    asDepartment('order_management');
    shipmentService.getShipmentByOrder.mockRejectedValue({ response: { status: 404 } });
    renderPage();
    await waitFor(() => expect(screen.getByText(/hasn't been paid for/i)).toBeTruthy());
  });

  it('25c. an unrelated failure (e.g. 500) renders a generic load-failure state, not "hasn\'t been paid for"', async () => {
    asDepartment('order_management');
    shipmentService.getShipmentByOrder.mockRejectedValue({ response: { status: 500 } });
    renderPage();
    await waitFor(() => expect(screen.getByText(/failed to load fulfillment details/i)).toBeTruthy());
    expect(screen.queryByText(/hasn't been paid for/i)).toBeNull();
  });
});
