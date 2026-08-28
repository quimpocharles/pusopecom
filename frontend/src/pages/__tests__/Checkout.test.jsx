import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Checkout from '../Checkout';
import orderService from '../../services/orderService';
import authService from '../../services/authService';
import api from '../../services/api';

vi.mock('select-philippines-address', () => ({
  regions: vi.fn().mockResolvedValue([{ region_code: '13', region_name: 'NCR' }]),
  provinces: vi.fn().mockResolvedValue([{ province_code: 'MM', province_name: 'Metro Manila' }]),
  cities: vi.fn().mockResolvedValue([{ city_code: 'QC', city_name: 'Quezon City' }]),
  barangays: vi.fn().mockResolvedValue([{ brgy_code: 'B1', brgy_name: 'Barangay 1' }]),
}));

// Phase 4 (ePayGames evaluation) — Checkout now fetches its payment
// channels and per-channel fee from the backend (GET /payment-channels[/calculate])
// instead of a hardcoded frontend list, so `api.get` needs a default,
// route-aware mock alongside the existing `api.post` one (shipping
// options). Individual tests below override this default via
// mockResolvedValueOnce/mockImplementationOnce where the channel set
// itself is what's under test.
// vi.mock factories are hoisted above every import/const in this file —
// referencing an outer variable inside one only works if its name starts
// with "mock" (Vitest's own convention for exactly this), hence the prefix
// below rather than the more natural defaultXenditChannels/defaultFeeResponse.
const mockDefaultXenditChannels = {
  data: {
    success: true,
    data: {
      gateway: 'xendit',
      channels: [
        { code: 'GCASH', label: 'GCash' },
        { code: 'MAYA', label: 'Maya' },
        { code: 'CARD', label: 'Credit/Debit Card' },
        { code: 'APPLE_PAY', label: 'Apple Pay' },
        { code: 'QRPH', label: 'QR Ph' },
      ],
    },
  },
};
const mockDefaultFeeResponse = {
  data: { success: true, data: { gateway: 'xendit', channel: 'GCASH', amount: 899, fee: 17.98, total: 916.98 } },
};

vi.mock('../../services/api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn((url) => {
      if (url === '/payment-channels') return Promise.resolve(mockDefaultXenditChannels);
      if (url === '/payment-channels/calculate') return Promise.resolve(mockDefaultFeeResponse);
      return Promise.resolve({ data: { success: false } });
    }),
  },
}));

vi.mock('../../services/orderService', () => ({
  default: { createOrder: vi.fn() },
}));

vi.mock('../../services/authService', () => ({
  default: { addAddress: vi.fn() },
}));

// Layout pulls in Header/Footer/CartDrawer/QuickAddModal/AnnouncementBar,
// each with their own store dependencies unrelated to anything under test
// here — replaced with a passthrough so this file only has to mock what
// Checkout itself actually needs. SEO uses react-helmet-async, which
// requires a HelmetProvider this test doesn't otherwise set up.
vi.mock('../../components/layout/Layout', () => ({
  default: ({ children }) => <div>{children}</div>,
}));
vi.mock('../../components/common/SEO', () => ({
  default: () => null,
}));

let mockUser = null;
vi.mock('../../store/authStore', () => ({
  default: () => ({ user: mockUser }),
}));

const cartItem = {
  product: { _id: 'prod-1', name: 'Test Jersey', images: ['https://example.com/x.jpg'] },
  price: 800,
  quantity: 1,
  size: 'M',
};
vi.mock('../../store/cartStore', () => ({
  default: () => ({ items: [cartItem], getCartTotal: () => 800 }),
}));

const shippingOptionsResponse = {
  data: {
    success: true,
    data: {
      shippingOptions: [
        { method: 'standard', label: 'Standard Delivery', description: '3-5 days', isFree: false, fee: 99, region: '13' },
      ],
    },
  },
};

function renderCheckout() {
  return render(
    <MemoryRouter>
      <Checkout />
    </MemoryRouter>
  );
}

// AddressForm/Checkout.jsx's own inputs have no htmlFor/id label
// association (a pre-existing gap in that markup, not something this
// change touches) — react-hook-form's `name` attribute is the one
// reliable selector every field actually has.
function field(container, name) {
  return container.querySelector(`[name="${name}"]`);
}

async function fillRequiredFields(container) {
  fireEvent.change(field(container, 'email'), { target: { value: 'buyer@test.local' } });
  fireEvent.change(field(container, 'phone'), { target: { value: '09171234567' } });
  fireEvent.change(field(container, 'fullName'), { target: { value: 'Juan Dela Cruz' } });

  fireEvent.change(field(container, 'region'), { target: { value: '13' } });
  await waitFor(() => expect(field(container, 'province')).not.toBeDisabled());
  fireEvent.change(field(container, 'province'), { target: { value: 'MM' } });
  await waitFor(() => expect(field(container, 'city')).not.toBeDisabled());
  fireEvent.change(field(container, 'city'), { target: { value: 'QC' } });
  await waitFor(() => expect(field(container, 'barangay')).not.toBeDisabled());
  fireEvent.change(field(container, 'barangay'), { target: { value: 'Barangay 1' } });
  fireEvent.change(field(container, 'zipCode'), { target: { value: '1100' } });
  fireEvent.change(field(container, 'address'), { target: { value: '123 Rizal St' } });

  // The submit button stays disabled until a payment channel is picked
  // (ADR-010) — every caller of this helper needs one selected before
  // "Proceed to Payment" is clickable at all. The channel list itself now
  // comes from a separate backend fetch (Phase 4) that isn't guaranteed to
  // have resolved by the time the shipping-options fetch has — wait for it
  // explicitly rather than assuming render-cycle timing.
  await waitFor(() => expect(screen.getByRole('button', { name: /GCash/ })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /GCash/ }));
}

describe('Checkout — save address for next time', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.post.mockResolvedValue(shippingOptionsResponse);
    orderService.createOrder.mockResolvedValue({
      success: true,
      data: { orderNumber: 'PS-20260802-ABCDEF', checkoutUrl: 'https://pay.example/checkout' },
    });
    // jsdom doesn't implement real navigation — stub it so the redirect
    // this component performs on success doesn't throw.
    delete window.location;
    window.location = { href: '' };
  });

  it('hides the save-address checkbox for a guest', async () => {
    mockUser = null;
    renderCheckout();
    await waitFor(() => expect(screen.getByText('Standard Delivery')).toBeInTheDocument());
    expect(screen.queryByText(/Save this address for faster checkout/)).not.toBeInTheDocument();
  });

  it('shows the checkbox for a logged-in user, unchecked by default', async () => {
    mockUser = { _id: 'user-1', email: 'buyer@test.local', firstName: 'Juan', lastName: 'Dela Cruz', addresses: [] };
    renderCheckout();
    await waitFor(() => expect(screen.getByText('Standard Delivery')).toBeInTheDocument());
    const checkbox = screen.getByRole('checkbox', { name: /Save this address for faster checkout/ });
    expect(checkbox).not.toBeChecked();
  });

  it('does not save an address when the box is left unchecked', async () => {
    mockUser = { _id: 'user-1', email: 'buyer@test.local', firstName: 'Juan', lastName: 'Dela Cruz', addresses: [] };
    const { container } = renderCheckout();
    await waitFor(() => expect(screen.getByText('Standard Delivery')).toBeInTheDocument());

    await fillRequiredFields(container);
    fireEvent.click(screen.getByRole('button', { name: /Proceed to Payment/ }));

    await waitFor(() => expect(orderService.createOrder).toHaveBeenCalled());
    expect(authService.addAddress).not.toHaveBeenCalled();
  });

  it('saves the typed address when the box is checked and the order succeeds', async () => {
    mockUser = { _id: 'user-1', email: 'buyer@test.local', firstName: 'Juan', lastName: 'Dela Cruz', addresses: [] };
    const { container } = renderCheckout();
    await waitFor(() => expect(screen.getByText('Standard Delivery')).toBeInTheDocument());

    await fillRequiredFields(container);
    fireEvent.click(screen.getByRole('checkbox', { name: /Save this address for faster checkout/ }));
    fireEvent.click(screen.getByRole('button', { name: /Proceed to Payment/ }));

    await waitFor(() => expect(authService.addAddress).toHaveBeenCalledTimes(1));
    const saved = authService.addAddress.mock.calls[0][0];
    expect(saved).toMatchObject({
      fullName: 'Juan Dela Cruz',
      phone: '09171234567',
      city: 'Quezon City',
      province: 'Metro Manila',
      zipCode: '1100',
      address: '123 Rizal St',
    });
  });

  it('never saves an address for a venue-pickup order, even if somehow requested', async () => {
    mockUser = { _id: 'user-1', email: 'buyer@test.local', firstName: 'Juan', lastName: 'Dela Cruz', addresses: [] };
    api.post.mockResolvedValue({
      data: {
        success: true,
        data: {
          shippingOptions: [
            { method: 'standard', label: 'Standard Delivery', description: '3-5 days', isFree: false, fee: 99, region: '13' },
            { method: 'venue_pickup', slotId: 'slot-1', label: 'Pickup at HQ', description: 'Free', isFree: true, fee: 0 },
          ],
        },
      },
    });
    renderCheckout();
    await waitFor(() => expect(screen.getByText('Pickup at HQ')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Pickup at HQ'));

    // The whole Shipping Address card — and the checkbox inside it — is
    // unmounted for pickup orders, which is itself the guarantee: there's
    // no control left for a pickup order to check in the first place.
    expect(screen.queryByText(/Save this address for faster checkout/)).not.toBeInTheDocument();
  });
});

describe('Checkout — payment channels from the backend (Phase 4, ePayGames evaluation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.post.mockResolvedValue(shippingOptionsResponse);
    api.get.mockImplementation((url) => {
      if (url === '/payment-channels') return Promise.resolve(mockDefaultXenditChannels);
      if (url === '/payment-channels/calculate') return Promise.resolve(mockDefaultFeeResponse);
      return Promise.resolve({ data: { success: false } });
    });
    mockUser = null;
    delete window.location;
    window.location = { href: '' };
  });

  it('renders exactly the channels the backend returns — no leftover hardcoded frontend list', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/payment-channels') {
        return Promise.resolve({ data: { success: true, data: { gateway: 'xendit', channels: [{ code: 'ONLY_ONE', label: 'Only One Channel' }] } } });
      }
      return Promise.resolve({ data: { success: false } });
    });

    renderCheckout();
    await waitFor(() => expect(screen.getByRole('button', { name: /Only One Channel/ })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /GCash/ })).not.toBeInTheDocument();
  });

  it('shows an ePayGames channel when the backend reports epaygames as the currently active gateway', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/payment-channels') {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              gateway: 'epaygames',
              // The only two channel mappings actually confirmed for
              // ePayGames (Phase 2/4) — GCash and Maya QR, not the full
              // Xendit catalog.
              channels: [
                { code: 'GCASH_TRN', label: 'GCash' },
                { code: 'PAYMAYA_QR', label: 'Maya' },
              ],
            },
          },
        });
      }
      return Promise.resolve({ data: { success: false } });
    });

    renderCheckout();
    await waitFor(() => expect(screen.getByRole('button', { name: /GCash/ })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Maya/ })).toBeInTheDocument();
    // Reflects the actual active gateway rather than a hardcoded claim —
    // real ePayGames branding ("ePayGames"), not a generic title-case of
    // the raw identifier ("Epaygames").
    await waitFor(() => expect(screen.getByText(/powered by ePayGames/)).toBeInTheDocument());
  });

  it('shows the authoritative fee from the backend once a channel is selected', async () => {
    renderCheckout();
    await waitFor(() => expect(screen.getByText('Standard Delivery')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: /GCash/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /GCash/ }));

    await waitFor(() => expect(screen.getByText('₱17.98')).toBeInTheDocument());
  });

  it('shows a clear error state (not a broken/empty selector) if the channel fetch fails, and keeps submit disabled', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/payment-channels') return Promise.reject(new Error('network error'));
      return Promise.resolve({ data: { success: false } });
    });

    renderCheckout();
    await waitFor(() => expect(screen.getByText('Standard Delivery')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/couldn.t load payment methods/i)).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: /GCash/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Proceed to Payment/ })).toBeDisabled();
  });

  it('shows a clear "no payment methods available" state — distinct from the error state — when the backend returns an empty channel list', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/payment-channels') return Promise.resolve({ data: { success: true, data: { gateway: 'epaygames', channels: [] } } });
      return Promise.resolve({ data: { success: false } });
    });

    renderCheckout();
    await waitFor(() => expect(screen.getByText('Standard Delivery')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/no payment methods are currently available/i)).toBeInTheDocument());

    expect(screen.queryByText(/couldn.t load payment methods/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Proceed to Payment/ })).toBeDisabled();
  });

  it('shows a loading skeleton for payment methods before the channel fetch resolves', async () => {
    let resolveChannels;
    api.get.mockImplementation((url) => {
      if (url === '/payment-channels') {
        return new Promise((resolve) => { resolveChannels = resolve; });
      }
      return Promise.resolve({ data: { success: false } });
    });

    renderCheckout();
    await waitFor(() => expect(screen.getByText('Standard Delivery')).toBeInTheDocument());

    // Neither the real channels nor either "nothing available" message has
    // rendered yet — the fetch is still pending.
    expect(screen.queryByRole('button', { name: /GCash/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/no payment methods are currently available/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/couldn.t load payment methods/i)).not.toBeInTheDocument();

    resolveChannels(mockDefaultXenditChannels);
    await waitFor(() => expect(screen.getByRole('button', { name: /GCash/ })).toBeInTheDocument());
  });

  it('submits the ePayGames channel code as paymentChannel when ePayGames is the active gateway', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/payment-channels') {
        return Promise.resolve({
          data: { success: true, data: { gateway: 'epaygames', channels: [{ code: 'GCASH_TRN', label: 'GCash' }] } },
        });
      }
      if (url === '/payment-channels/calculate') {
        return Promise.resolve({ data: { success: true, data: { gateway: 'epaygames', channel: 'GCASH_TRN', amount: 899, fee: 0, total: 899 } } });
      }
      return Promise.resolve({ data: { success: false } });
    });
    orderService.createOrder.mockResolvedValue({
      success: true,
      data: { orderNumber: 'PS-20260827-EPAY01', checkoutUrl: 'https://l-stg.epayg.link/abc123' },
    });

    const { container } = renderCheckout();
    await waitFor(() => expect(screen.getByText('Standard Delivery')).toBeInTheDocument());

    // fillRequiredFields itself selects the one available payment method
    // (GCash) as part of filling out the form.
    await fillRequiredFields(container);
    fireEvent.click(screen.getByRole('button', { name: /Proceed to Payment/ }));

    await waitFor(() => expect(orderService.createOrder).toHaveBeenCalled());
    const submitted = orderService.createOrder.mock.calls[0][0];
    // Exactly the code the backend returned for ePayGames — GCASH_TRN, not
    // Xendit's own GCASH — the frontend never invents or normalizes a
    // channel code itself.
    expect(submitted.paymentChannel).toBe('GCASH_TRN');
  });

  it('never trusts an unknown/stale channel code — selecting one the backend didn\'t return is simply not possible from the rendered UI', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/payment-channels') {
        return Promise.resolve({ data: { success: true, data: { gateway: 'xendit', channels: [{ code: 'GCASH', label: 'GCash' }] } } });
      }
      return Promise.resolve({ data: { success: false } });
    });

    renderCheckout();
    await waitFor(() => expect(screen.getByRole('button', { name: /GCash/ })).toBeInTheDocument());
    // Nothing else was ever rendered for the user to click — CARD/APPLE_PAY/QRPH
    // from the old hardcoded list are simply absent, not just unselected.
    expect(screen.queryByRole('button', { name: /Credit\/Debit Card/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Apple Pay/ })).not.toBeInTheDocument();
  });
});
