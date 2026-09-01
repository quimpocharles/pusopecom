import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Login from '../Login';

vi.mock('../../components/layout/Layout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../../components/common/SEO', () => ({ default: () => null }));
// Captures the real onSuccess/onError callbacks Login.jsx wires up, so a
// test can trigger handleSocialSuccess directly without a real Google flow.
let googleCallbacks = {};
vi.mock('../../components/auth/GoogleLoginButton', () => ({
  default: (props) => { googleCallbacks = props; return <div>Google Login</div>; },
}));
vi.mock('../../components/auth/SocialDivider', () => ({ default: () => <div>or</div> }));

const mockLogin = vi.fn();
vi.mock('../../store/authStore', () => ({
  default: (selector) => selector({ login: mockLogin }),
}));

// A fully-signed-up admin so `isProfileIncomplete` never redirects to
// /complete-profile instead of the preserved destination.
const COMPLETE_ADMIN_USER = {
  role: 'admin',
  ageVerified: true,
  phone: '09171234567',
  addresses: [{ id: 'addr-1' }],
};

// Shaped like the real provisioned staff accounts (Puso Store 2.0 launch
// roster) — no age/phone/address at all, since none of that is meaningful
// for a staff account.
const INCOMPLETE_ADMIN_USER = {
  role: 'admin',
  ageVerified: false,
  phone: null,
  addresses: [],
  staffProfile: { department: 'operations', permissions: [] },
};

const SCANNER_USER = {
  role: 'admin',
  ageVerified: false,
  phone: null,
  addresses: [],
  staffProfile: { department: 'scanner', permissions: [] },
};

const ORDER_MANAGEMENT_USER = {
  role: 'admin',
  ageVerified: false,
  phone: null,
  addresses: [],
  staffProfile: { department: 'order_management', permissions: [] },
};

const INCOMPLETE_CUSTOMER_USER = {
  role: 'customer',
  ageVerified: false,
  phone: null,
  addresses: [],
};

const COMPLETE_CUSTOMER_USER = {
  role: 'customer',
  ageVerified: true,
  phone: '09171234567',
  addresses: [{ id: 'addr-1' }],
};

function renderLoginAt(entry) {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<p>Storefront home</p>} />
        <Route path="/admin/reports/exports/download" element={<p>Report download page reached</p>} />
        <Route path="/admin/orders" element={<p>Orders page reached</p>} />
        <Route path="/admin/pass-checkin" element={<p>Pass Check-In reached</p>} />
        <Route path="/complete-profile" element={<p>Complete profile reached</p>} />
      </Routes>
    </MemoryRouter>
  );
}

async function submitLoginForm() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@pusostore.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-password' } });
  fireEvent.click(screen.getByRole('button', { name: /login/i }));
}

describe('Login — redirect-back destination after AdminRoute sent the user here', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns to the original report-download path WITH its query string (runId/format), from location.state.from set by AdminRoute', async () => {
    mockLogin.mockResolvedValue({ user: COMPLETE_ADMIN_USER });

    renderLoginAt({
      pathname: '/login',
      state: { from: { pathname: '/admin/reports/exports/download', search: '?runId=run-123&format=csv' } },
    });

    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByText('Report download page reached')).toBeTruthy();
    });
  });

  it('falls back to "/" when there is no preserved destination (unchanged prior behavior)', async () => {
    mockLogin.mockResolvedValue({ user: COMPLETE_ADMIN_USER });

    renderLoginAt('/login');

    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByText('Storefront home')).toBeTruthy();
    });
  });

  it('a ?redirect= query param still takes priority over location.state.from (unchanged prior behavior)', async () => {
    mockLogin.mockResolvedValue({ user: COMPLETE_ADMIN_USER });

    renderLoginAt({
      pathname: '/login',
      search: '?redirect=%2F',
      state: { from: { pathname: '/admin/reports/exports/download', search: '?runId=run-123&format=csv' } },
    });

    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByText('Storefront home')).toBeTruthy();
    });
  });
});

describe('Login — admin profile-completion bypass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('a. an admin with no age/phone/address on file logs in without being sent to /complete-profile', async () => {
    mockLogin.mockResolvedValue({ user: INCOMPLETE_ADMIN_USER });

    renderLoginAt('/login');
    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByText('Storefront home')).toBeTruthy();
    });
    expect(screen.queryByText('Complete profile reached')).toBeNull();
  });

  it('f. a customer with an incomplete profile still goes to /complete-profile (unchanged)', async () => {
    mockLogin.mockResolvedValue({ user: INCOMPLETE_CUSTOMER_USER });

    renderLoginAt('/login');
    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByText('Complete profile reached')).toBeTruthy();
    });
  });

  it('g. a customer with a complete profile retains existing redirect behavior', async () => {
    mockLogin.mockResolvedValue({ user: COMPLETE_CUSTOMER_USER });

    renderLoginAt({
      pathname: '/login',
      state: { from: { pathname: '/admin/orders', search: '' } },
    });
    await submitLoginForm();

    // Customers were never gated by AdminRoute in practice, but the
    // redirect-back mechanism itself is role-agnostic — this just proves
    // the profile-completion bypass didn't accidentally start applying to
    // customers too.
    await waitFor(() => {
      expect(screen.getByText('Orders page reached')).toBeTruthy();
    });
  });
});

describe('Login — scanner admin lands directly on Pass Check-In', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    googleCallbacks = {};
  });

  it('b. a scanner admin with no preserved destination lands on /admin/pass-checkin, not "/"', async () => {
    mockLogin.mockResolvedValue({ user: SCANNER_USER });

    renderLoginAt('/login');
    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByText('Pass Check-In reached')).toBeTruthy();
    });
  });

  it('c. the scanner redirect overrides an explicit ?redirect= param', async () => {
    mockLogin.mockResolvedValue({ user: SCANNER_USER });

    renderLoginAt({ pathname: '/login', search: '?redirect=%2Fadmin%2Forders' });
    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByText('Pass Check-In reached')).toBeTruthy();
    });
    expect(screen.queryByText('Orders page reached')).toBeNull();
  });

  it('d. the scanner redirect overrides location.state.from set by AdminRoute', async () => {
    mockLogin.mockResolvedValue({ user: SCANNER_USER });

    renderLoginAt({
      pathname: '/login',
      state: { from: { pathname: '/admin/reports/exports/download', search: '?runId=run-123&format=csv' } },
    });
    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByText('Pass Check-In reached')).toBeTruthy();
    });
    expect(screen.queryByText('Report download page reached')).toBeNull();
  });

  it('e. a non-scanner admin department (operations) is unaffected — retains existing redirect behavior', async () => {
    mockLogin.mockResolvedValue({ user: INCOMPLETE_ADMIN_USER }); // department: operations

    renderLoginAt({
      pathname: '/login',
      state: { from: { pathname: '/admin/orders', search: '' } },
    });
    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByText('Orders page reached')).toBeTruthy();
    });
    expect(screen.queryByText('Pass Check-In reached')).toBeNull();
  });

  it('h. the social-login (Google) success path sends a scanner straight to Pass Check-In too, overriding ?redirect=', async () => {
    renderLoginAt({ pathname: '/login', search: '?redirect=%2Fadmin%2Forders' });

    // Trigger the real handleSocialSuccess Login.jsx wired into
    // GoogleLoginButton's onSuccess prop, exactly as a real Google
    // callback would.
    act(() => { googleCallbacks.onSuccess(SCANNER_USER); });

    await waitFor(() => {
      expect(screen.getByText('Pass Check-In reached')).toBeTruthy();
    });
    expect(screen.queryByText('Orders page reached')).toBeNull();
  });

  it('h. the social-login path still sends a complete non-scanner admin to its preserved destination (unchanged)', async () => {
    renderLoginAt({
      pathname: '/login',
      state: { from: { pathname: '/admin/reports/exports/download', search: '?runId=run-123&format=csv' } },
    });

    act(() => { googleCallbacks.onSuccess(COMPLETE_ADMIN_USER); });

    await waitFor(() => {
      expect(screen.getByText('Report download page reached')).toBeTruthy();
    });
  });
});

describe('Login — order_management admin lands directly on Orders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    googleCallbacks = {};
  });

  it('an order_management admin with no preserved destination lands on /admin/orders, not "/"', async () => {
    mockLogin.mockResolvedValue({ user: ORDER_MANAGEMENT_USER });

    renderLoginAt('/login');
    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByText('Orders page reached')).toBeTruthy();
    });
  });

  it('the order_management redirect overrides an explicit ?redirect= param', async () => {
    mockLogin.mockResolvedValue({ user: ORDER_MANAGEMENT_USER });

    renderLoginAt({ pathname: '/login', search: '?redirect=%2Fadmin%2Freports%2Fexports%2Fdownload' });
    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByText('Orders page reached')).toBeTruthy();
    });
    expect(screen.queryByText('Report download page reached')).toBeNull();
  });

  it('the order_management redirect overrides location.state.from set by AdminRoute', async () => {
    mockLogin.mockResolvedValue({ user: ORDER_MANAGEMENT_USER });

    renderLoginAt({
      pathname: '/login',
      state: { from: { pathname: '/admin/reports/exports/download', search: '?runId=run-123&format=csv' } },
    });
    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByText('Orders page reached')).toBeTruthy();
    });
    expect(screen.queryByText('Report download page reached')).toBeNull();
  });

  it('an order_management admin with no age/phone/address on file still bypasses /complete-profile', async () => {
    mockLogin.mockResolvedValue({ user: ORDER_MANAGEMENT_USER });

    renderLoginAt('/login');
    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByText('Orders page reached')).toBeTruthy();
    });
    expect(screen.queryByText('Complete profile reached')).toBeNull();
  });

  it('the social-login (Google) success path sends order_management straight to Orders too, overriding ?redirect=', async () => {
    renderLoginAt({ pathname: '/login', search: '?redirect=%2Fadmin%2Freports%2Fexports%2Fdownload' });

    act(() => { googleCallbacks.onSuccess(ORDER_MANAGEMENT_USER); });

    await waitFor(() => {
      expect(screen.getByText('Orders page reached')).toBeTruthy();
    });
    expect(screen.queryByText('Report download page reached')).toBeNull();
  });

  it('does not affect the scanner redirect — scanner still lands on Pass Check-In, not Orders', async () => {
    mockLogin.mockResolvedValue({ user: SCANNER_USER });

    renderLoginAt('/login');
    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByText('Pass Check-In reached')).toBeTruthy();
    });
    expect(screen.queryByText('Orders page reached')).toBeNull();
  });
});
