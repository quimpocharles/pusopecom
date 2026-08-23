import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Login from '../Login';

vi.mock('../../components/layout/Layout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../../components/common/SEO', () => ({ default: () => null }));
vi.mock('../../components/auth/GoogleLoginButton', () => ({ default: () => <div>Google Login</div> }));
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

function renderLoginAt(entry) {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<p>Storefront home</p>} />
        <Route path="/admin/reports/exports/download" element={<p>Report download page reached</p>} />
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
