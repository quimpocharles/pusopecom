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
const navItems = [
  { label: 'Dashboard', to: '/admin', icon: HomeIcon, end: true },
  { label: 'Products', to: '/admin/products', icon: CubeIcon, permission: PERMISSIONS.PRODUCTS_VIEW },
  { label: 'Leagues', to: '/admin/leagues', icon: TrophyIcon, permission: PERMISSIONS.LEAGUES_MANAGE },
  { label: 'Homepage', to: '/admin/homepage', icon: RectangleGroupIcon, permission: PERMISSIONS.HOMEPAGE_MANAGE },
  { label: 'Campaigns', to: '/admin/campaigns', icon: SparklesIcon, permission: PERMISSIONS.CAMPAIGNS_MANAGE },
  { label: 'Promo Codes', to: '/admin/promo-codes', icon: TicketIcon, permission: PERMISSIONS.PROMOTIONS_MANAGE },
  { label: 'Venues', to: '/admin/venues', icon: MapIcon, permission: PERMISSIONS.PASSES_MANAGE },
  { label: 'Pass Events', to: '/admin/pass-events', icon: CalendarDaysIcon, permission: PERMISSIONS.PASSES_MANAGE },
  { label: 'Pass Check-In', to: '/admin/pass-checkin', icon: QrCodeIcon, permission: PERMISSIONS.PASSES_CHECKIN },
  { label: 'Fit Check Campaigns', to: '/admin/fit-check-campaigns', icon: MegaphoneIcon, permission: PERMISSIONS.FITCHECK_CAMPAIGNS_MANAGE },
  { label: 'Orders', to: '/admin/orders', icon: ShoppingCartIcon, permission: PERMISSIONS.ORDERS_VIEW },
  { label: 'Fulfillment', to: '/admin/shipments', icon: ClipboardDocumentListIcon, permission: PERMISSIONS.FULFILLMENT_MANAGE },
  { label: 'Returns & Refunds', to: '/admin/returns', icon: ArrowUturnLeftIcon, permission: PERMISSIONS.RETURNS_VIEW },
  { label: 'Users', to: '/admin/users', icon: UsersIcon, permission: PERMISSIONS.USERS_VIEW },
  // Single entry for the whole Reports module — 9 workspaces (Executive
  // Dashboard, Sales, Products, Customers, Operations, Fit Check
  // Analytics, Organizations, Finance, Exports) live inside ReportsLayout's
  // own sub-nav, same pattern as Settings' single sidebar entry. Visible if
  // any single workspace is reachable — ReportsLayout's own sub-nav hides
  // the rest.
  { label: 'Reports', to: '/admin/reports', icon: ChartBarIcon, anyOf: REPORTS_ANY },
  { label: 'Settings', to: '/admin/settings', icon: Cog6ToothIcon, anyOf: SETTINGS_ANY },
];

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = useAuthStore((state) => state.user);

  const visibleNavItems = useMemo(
    () => navItems.filter((item) => {
      if (item.permission) return hasPermission(user, item.permission);
      if (item.anyOf) return hasAnyPermission(user, item.anyOf);
      return true;
    }),
    [user]
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-xs text-gray-500 mt-1">Puso Pilipinas</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200 space-y-1">
        <a
          href="https://mail.pusostore.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <EnvelopeIcon className="w-5 h-5" />
          Employee Mail
        </a>
        <NavLink
          to="/"
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
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
        <div className="flex-1 bg-white border-r border-gray-200">
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
