import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AdminRoute from '../AdminRoute';

vi.mock('../../../store/authStore', () => ({
  default: vi.fn(),
}));

const useAuthStore = (await import('../../../store/authStore')).default;

// Renders whatever location.state Login.jsx would actually see, so this
// test proves the real payload shape (from.pathname + from.search),
// not just that *some* Navigate happened.
function LoginProbe() {
  const location = useLocation();
  return (
    <div>
      <p>Login page</p>
      <p data-testid="from-pathname">{location.state?.from?.pathname ?? ''}</p>
      <p data-testid="from-search">{location.state?.from?.search ?? ''}</p>
    </div>
  );
}

function renderAt(initialPath) {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<LoginProbe />} />
        <Route path="/" element={<p>Storefront home</p>} />
        <Route
          path="/admin/reports/exports/download"
          element={<AdminRoute><p>Protected report download page</p></AdminRoute>}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('AdminRoute — unauthenticated access to a report-download link', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirects to /login preserving the original path AND query string (runId/format), so a scheduled-report email link survives the round trip', () => {
    useAuthStore.mockReturnValue({ isAuthenticated: false, user: null });

    renderAt('/admin/reports/exports/download?runId=run-123&format=csv');

    expect(screen.getByText('Login page')).toBeTruthy();
    expect(screen.getByTestId('from-pathname').textContent).toBe('/admin/reports/exports/download');
    expect(screen.getByTestId('from-search').textContent).toBe('?runId=run-123&format=csv');
  });

  it('still redirects unauthenticated users away from the protected page (no bypass introduced)', () => {
    useAuthStore.mockReturnValue({ isAuthenticated: false, user: null });

    renderAt('/admin/reports/exports/download?runId=run-123&format=csv');

    expect(screen.queryByText('Protected report download page')).toBeNull();
  });

  it('renders the protected page for an authenticated admin, unchanged from prior behavior', () => {
    useAuthStore.mockReturnValue({ isAuthenticated: true, user: { role: 'admin' } });

    renderAt('/admin/reports/exports/download?runId=run-123&format=csv');

    expect(screen.getByText('Protected report download page')).toBeTruthy();
  });

  it('still redirects a non-admin authenticated user to home, unchanged from prior behavior', () => {
    useAuthStore.mockReturnValue({ isAuthenticated: true, user: { role: 'customer' } });

    renderAt('/admin/reports/exports/download?runId=run-123&format=csv');

    expect(screen.getByText('Storefront home')).toBeTruthy();
  });
});
