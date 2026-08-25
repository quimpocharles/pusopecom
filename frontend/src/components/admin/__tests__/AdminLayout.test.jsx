import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminLayout from '../AdminLayout';

vi.mock('../../../store/authStore', () => ({
  default: vi.fn(),
}));

const useAuthStore = (await import('../../../store/authStore')).default;

// Bootstrap rule (utils/permissions.js): an admin with no staffProfile at
// all sees every permissioned item — the simplest way to exercise "every
// section renders" without hand-listing every permission.
const FULL_ACCESS_ADMIN = { role: 'admin' };

// A real department bundle (utils/permissions.js DEPARTMENT_DEFAULTS.warehouse)
// with permissions in only some sections, and none at all in others —
// exercises both partial-section filtering and whole-section hiding.
const WAREHOUSE_ADMIN = { role: 'admin', staffProfile: { department: 'warehouse', permissions: [] } };

function renderAt(path, user = FULL_ACCESS_ADMIN) {
  useAuthStore.mockReturnValue(user);
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<p>Dashboard page</p>} />
          <Route path="pass-events" element={<p>Events page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

// The sidebar renders twice (mobile drawer + desktop) — scope to the
// always-present desktop <nav aria-label="Admin"> so queries don't collide
// with duplicate text in the closed mobile drawer.
function getNav() {
  const navs = screen.getAllByRole('navigation', { name: 'Admin' });
  return navs[navs.length - 1];
}

describe('AdminLayout — Phase 1 sidebar IA (sections, no route/permission changes)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('a. renders every section heading with its correct items, for a full-access admin', () => {
    renderAt('/admin');
    const nav = getNav();

    const expected = {
      Core: ['Dashboard'],
      Merchandise: ['Products', 'Orders', 'Fulfillment', 'Returns & Refunds', 'Promo Codes'],
      'Events & Passes': ['Events', 'Check-In', 'Venues', 'Leagues'],
      Content: ['Homepage', 'Campaigns', 'Fit Check Campaigns'],
      Customers: ['Users'],
      Reporting: ['Reports'],
      System: ['Settings'],
    };

    for (const [heading, items] of Object.entries(expected)) {
      const headingEl = within(nav).getByRole('heading', { name: heading, level: 2 });
      // Items belonging to a section render immediately after that
      // section's own heading, before the next one — walk forward through
      // nav's link list to the items owned by this heading's sibling block.
      const sectionBlock = headingEl.closest('div');
      for (const label of items) {
        expect(within(sectionBlock).getByRole('link', { name: label })).toBeTruthy();
      }
    }
  });

  it('b. hides items a department lacks permission for, and c. hides a section entirely when nothing in it is visible', () => {
    renderAt('/admin', WAREHOUSE_ADMIN);
    const nav = getNav();

    // warehouse has: orders.view, fulfillment.manage, products.view, passes.checkin
    expect(within(nav).getByRole('link', { name: /Products/ })).toBeTruthy();
    expect(within(nav).getByRole('link', { name: /Orders/ })).toBeTruthy();
    expect(within(nav).getByRole('link', { name: /Fulfillment/ })).toBeTruthy();
    expect(within(nav).getByRole('link', { name: /Check-In/ })).toBeTruthy();

    // Not granted to warehouse — must not render.
    expect(within(nav).queryByRole('link', { name: /Returns & Refunds/ })).toBeNull();
    expect(within(nav).queryByRole('link', { name: /Promo Codes/ })).toBeNull();
    expect(within(nav).queryByRole('link', { name: /^Events$/ })).toBeNull();
    expect(within(nav).queryByRole('link', { name: /Venues/ })).toBeNull();
    expect(within(nav).queryByRole('link', { name: /Leagues/ })).toBeNull();

    // warehouse has nothing in Content, Customers, Reporting, or System —
    // those headings must not render at all (not even empty).
    expect(within(nav).queryByRole('heading', { name: 'Content' })).toBeNull();
    expect(within(nav).queryByRole('heading', { name: 'Customers' })).toBeNull();
    expect(within(nav).queryByRole('heading', { name: 'Reporting' })).toBeNull();
    expect(within(nav).queryByRole('heading', { name: 'System' })).toBeNull();

    // Merchandise and Events & Passes DO still have visible items, so those
    // headings must still render (partial section, not hidden).
    expect(within(nav).getByRole('heading', { name: 'Merchandise' })).toBeTruthy();
    expect(within(nav).getByRole('heading', { name: 'Events & Passes' })).toBeTruthy();
  });

  it('d. active-route highlighting still works on a renamed item', () => {
    renderAt('/admin/pass-events');
    const nav = getNav();

    const eventsLink = within(nav).getByRole('link', { name: /^Events$/ });
    expect(eventsLink.className).toContain('bg-primary-50');

    const dashboardLink = within(nav).getByRole('link', { name: /Dashboard/ });
    expect(dashboardLink.className).not.toContain('bg-primary-50');
  });

  it('e. Employee Mail and Back to Shop render outside the sectioned admin navigation', () => {
    renderAt('/admin');
    const nav = getNav();

    // Neither appears inside the permission-gated, sectioned <nav>...
    expect(within(nav).queryByText('Employee Mail')).toBeNull();
    expect(within(nav).queryByText('Back to Shop')).toBeNull();
    // ...but both are still present on the page, unconditionally.
    expect(screen.getAllByText('Employee Mail').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Back to Shop').length).toBeGreaterThan(0);
  });

  it('f. renamed labels point at their original, unchanged routes', () => {
    renderAt('/admin');
    const nav = getNav();

    expect(within(nav).getByRole('link', { name: /^Events$/ }).getAttribute('href')).toBe('/admin/pass-events');
    expect(within(nav).getByRole('link', { name: /^Check-In$/ }).getAttribute('href')).toBe('/admin/pass-checkin');
  });

  // Sidebar scrolling fix — jsdom doesn't lay elements out, so an actual
  // "does it scroll at 720px tall" check isn't something a unit test can
  // observe. What IS verifiable here: the specific classes that make the
  // fix work are present on the right elements, so a future edit can't
  // silently drop them without a test failing. Real short-viewport
  // behavior still needs the visual check called out in the final report.
  it('g. the nav is independently scrollable and clamped, while the header/footer stay fixed-size', () => {
    renderAt('/admin');
    const nav = getNav();

    // `min-h-0` is what lets a flex-1 child actually shrink below its
    // content height instead of pushing the sidebar past the viewport;
    // `overflow-y-auto` is what makes the now-clamped remainder scrollable.
    expect(nav.className).toContain('flex-1');
    expect(nav.className).toContain('min-h-0');
    expect(nav.className).toContain('overflow-y-auto');

    // Header ("Admin Panel") and footer (Employee Mail / Back to Shop)
    // must not be part of that scrolling region, and must not shrink to
    // make room for it. Mobile drawer is closed by default, so there's
    // exactly one instance of each on the page here.
    const header = screen.getByText('Admin Panel').closest('div');
    expect(header.className).toContain('flex-shrink-0');
    expect(within(header).queryByRole('navigation')).toBeNull();

    const footerLink = screen.getByText('Employee Mail').closest('div');
    expect(footerLink.className).toContain('flex-shrink-0');
  });

  it('h. every sidebar item remains present (reachable) regardless of the scroll-fix classes, for a full-access admin', () => {
    renderAt('/admin');
    const nav = getNav();
    // 1 (Dashboard) + 5 (Merchandise) + 4 (Events & Passes) + 3 (Content) + 1 (Customers) + 1 (Reporting) + 1 (System)
    expect(within(nav).getAllByRole('link')).toHaveLength(16);
  });

  it('h2. and remains present for a limited-department admin too, just fewer of them', () => {
    renderAt('/admin', WAREHOUSE_ADMIN);
    const nav = getNav();
    expect(within(nav).getAllByRole('link').length).toBeGreaterThan(0);
    expect(within(nav).getAllByRole('link').length).toBeLessThan(16);
  });
});
