import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PermissionRoute from '../PermissionRoute';
import { PERMISSIONS } from '../../../utils/permissions';

let currentUser;

vi.mock('../../../store/authStore', () => ({
  default: (selector) => selector({ user: currentUser }),
}));

function renderReturnsRoute() {
  render(
    <MemoryRouter initialEntries={['/admin/returns']}>
      <Routes>
        <Route path="/admin" element={<p>Dashboard</p>} />
        <Route
          path="/admin/returns"
          element={
            <PermissionRoute anyOf={[PERMISSIONS.RETURNS_VIEW, PERMISSIONS.REFUNDS_MANAGE]}>
              <p>Returns &amp; Refunds page</p>
            </PermissionRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('PermissionRoute — /admin/returns, gated on anyOf(RETURNS_VIEW, REFUNDS_MANAGE)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('admits a Finance-only user who has refunds.manage but not returns.view', () => {
    // 'warehouse' is a real department bundle with neither RETURNS_VIEW nor
    // REFUNDS_MANAGE; the explicit override is additive-only, matching how a
    // real staff profile would actually grant refunds.manage without returns.view.
    currentUser = { role: 'admin', staffProfile: { department: 'warehouse', active: true, permissions: [PERMISSIONS.REFUNDS_MANAGE] } };

    renderReturnsRoute();

    expect(screen.getByText('Returns & Refunds page')).toBeTruthy();
  });

  it('admits a user who has returns.view but not refunds.manage (existing access unchanged)', () => {
    currentUser = { role: 'admin', staffProfile: { department: 'support', active: true, permissions: [] } };

    renderReturnsRoute();

    expect(screen.getByText('Returns & Refunds page')).toBeTruthy();
  });

  it('denies a user with neither permission, redirecting to /admin', () => {
    currentUser = { role: 'admin', staffProfile: { department: 'warehouse', active: true, permissions: [] } };

    renderReturnsRoute();

    expect(screen.queryByText('Returns & Refunds page')).toBeNull();
    expect(screen.getByText('Dashboard')).toBeTruthy();
  });
});
