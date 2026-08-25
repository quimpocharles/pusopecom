import { useState, useMemo } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import {
  HomeIcon,
  CubeIcon,
  ShoppingCartIcon,
  UsersIcon,
  TrophyIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowLeftIcon,
  Bars3Icon,
  XMarkIcon,
  SparklesIcon,
  RectangleGroupIcon,
  MegaphoneIcon,
  ClipboardDocumentListIcon,
  ArrowUturnLeftIcon,
  EnvelopeIcon,
  TicketIcon,
  MapIcon,
  CalendarDaysIcon,
  QrCodeIcon
} from '@heroicons/react/24/outline';
import useAuthStore from '../../store/authStore';
import { PERMISSIONS, hasPermission, hasAnyPermission } from '../../utils/permissions';

const REPORTS_ANY = Object.values(PERMISSIONS).filter((p) => p.startsWith('reports.') && p.endsWith('.view'));
const SETTINGS_ANY = Object.values(PERMISSIONS).filter((p) => p.startsWith('settings.') && p.endsWith('.manage'));

// `permission`/`anyOf` decide visibility — no field at all means always
// visible (Dashboard, and "Back to Shop" below). This only hides links a
// backend requirePermission() call would 403 anyway; it's not itself the
// enforcement.
//
// Admin IA audit, Phase 1 — items are grouped into domain sections purely
// for sidebar presentation. `to`, `permission`/`anyOf`, and every route
// this points at are unchanged from the prior flat list; only the grouping
// and two labels ("Events", "Check-In" — see their own comments) are new.
// A section's own heading is never itself permission-gated — it's derived
// from whether any of its items survive the same per-item filter the flat
// list always used, so a section with nothing visible in it just doesn't
// render (see visibleSections below), the same way an individual item
// always has.
const navSections = [
  {
    heading: 'Core',
    items: [
      { label: 'Dashboard', to: '/admin', icon: HomeIcon, end: true },
    ],
  },
  {
    heading: 'Merchandise',
    items: [
      { label: 'Products', to: '/admin/products', icon: CubeIcon, permission: PERMISSIONS.PRODUCTS_VIEW },
      { label: 'Orders', to: '/admin/orders', icon: ShoppingCartIcon, permission: PERMISSIONS.ORDERS_VIEW },
      { label: 'Fulfillment', to: '/admin/shipments', icon: ClipboardDocumentListIcon, permission: PERMISSIONS.FULFILLMENT_MANAGE },
      { label: 'Returns & Refunds', to: '/admin/returns', icon: ArrowUturnLeftIcon, permission: PERMISSIONS.RETURNS_VIEW },
      { label: 'Promo Codes', to: '/admin/promo-codes', icon: TicketIcon, permission: PERMISSIONS.PROMOTIONS_MANAGE },
    ],
  },
  {
    heading: 'Events & Passes',
    items: [
      // Label-only rename (IA audit, Deliverable D) — route stays
      // /admin/pass-events, component stays AdminPassEvents, permission
      // stays passes.manage. "Events" is what this already is once it's
      // under an "Events & Passes" heading; nothing else about it changed.
      { label: 'Events', to: '/admin/pass-events', icon: CalendarDaysIcon, permission: PERMISSIONS.PASSES_MANAGE },
      // Same: route stays /admin/pass-checkin, component stays
      // AdminPassCheckin, permission stays passes.checkin.
      { label: 'Check-In', to: '/admin/pass-checkin', icon: QrCodeIcon, permission: PERMISSIONS.PASSES_CHECKIN },
      { label: 'Venues', to: '/admin/venues', icon: MapIcon, permission: PERMISSIONS.PASSES_MANAGE },
      { label: 'Leagues', to: '/admin/leagues', icon: TrophyIcon, permission: PERMISSIONS.LEAGUES_MANAGE },
    ],
  },
  {
    heading: 'Content',
    items: [
      { label: 'Homepage', to: '/admin/homepage', icon: RectangleGroupIcon, permission: PERMISSIONS.HOMEPAGE_MANAGE },
      { label: 'Campaigns', to: '/admin/campaigns', icon: SparklesIcon, permission: PERMISSIONS.CAMPAIGNS_MANAGE },
      { label: 'Fit Check Campaigns', to: '/admin/fit-check-campaigns', icon: MegaphoneIcon, permission: PERMISSIONS.FITCHECK_CAMPAIGNS_MANAGE },
    ],
  },
  {
    heading: 'Customers',
    items: [
      { label: 'Users', to: '/admin/users', icon: UsersIcon, permission: PERMISSIONS.USERS_VIEW },
    ],
  },
  {
    heading: 'Reporting',
    items: [
      // Single entry for the whole Reports module — 9 workspaces (Executive
      // Dashboard, Sales, Products, Customers, Operations, Fit Check
      // Analytics, Organizations, Finance, Exports) live inside
      // ReportsLayout's own sub-nav, unchanged by this reorg. Visible if
      // any single workspace is reachable — ReportsLayout's own sub-nav
      // hides the rest.
      { label: 'Reports', to: '/admin/reports', icon: ChartBarIcon, anyOf: REPORTS_ANY },
    ],
  },
  {
    heading: 'System',
    items: [
      { label: 'Settings', to: '/admin/settings', icon: Cog6ToothIcon, anyOf: SETTINGS_ANY },
    ],
  },
];

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = useAuthStore((state) => state.user);

  const isItemVisible = (item) => {
    if (item.permission) return hasPermission(user, item.permission);
    if (item.anyOf) return hasAnyPermission(user, item.anyOf);
    return true;
  };

  // Filtering is still per-item, exactly as before — a section is just
  // whatever's left of it once its items go through that same check, and
  // drops out entirely when nothing survives (requirement: no empty
  // section headings).
  const visibleSections = useMemo(
    () => navSections
      .map((section) => ({ ...section, items: section.items.filter(isItemVisible) }))
      .filter((section) => section.items.length > 0),
    [user]
  );

  // Sidebar scrolling fix (Admin Dashboard Phase 2) — a flex column child
  // sized with `flex-1` alone won't shrink below its own content height
  // (flex items default to `min-height: auto`), so on a short viewport the
  // nav's real content height silently overflowed the fixed-position
  // sidebar container with no scrollbar anywhere to reach it. `min-h-0` on
  // every flex-1 link in the chain lets `nav` actually be clamped to the
  // remaining space, and `overflow-y-auto` on `nav` itself is what makes
  // that remaining space scrollable — while header/footer, having no
  // flex-1 of their own, keep their natural size and stay put.
  const SidebarContent = () => (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-6 border-b border-gray-200 flex-shrink-0">
        <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-xs text-gray-500 mt-1">Puso Pilipinas</p>
      </div>

      <nav aria-label="Admin" className="flex-1 min-h-0 overflow-y-auto p-4 space-y-5">
        {visibleSections.map((section) => (
          <div key={section.heading}>
            <h2 className="px-4 mb-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider">
              {section.heading}
            </h2>
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200 space-y-1 flex-shrink-0">
        <a
          href="https://mail.pusostore.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <EnvelopeIcon className="w-4 h-4" />
          Employee Mail
        </a>
        <NavLink
          to="/"
          className="flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Shop
        </NavLink>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64 bg-white z-50 lg:hidden shadow-xl">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
            <SidebarContent />
          </div>
        </>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex-1 min-h-0 bg-white border-r border-gray-200">
          <SidebarContent />
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Mobile header */}
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200 lg:hidden">
          <div className="flex items-center gap-4 px-4 h-14">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 hover:bg-gray-100 rounded-lg"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
            <span className="font-semibold text-gray-900">Admin</span>
          </div>
        </div>

        <main className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
