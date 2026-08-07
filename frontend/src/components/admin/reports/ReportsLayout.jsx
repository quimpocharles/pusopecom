import { NavLink, Outlet } from 'react-router-dom';
import {
  HomeIcon,
  CurrencyDollarIcon,
  CubeIcon,
  UsersIcon,
  TruckIcon,
  SparklesIcon,
  TrophyIcon,
  BanknotesIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import useAuthStore from '../../../store/authStore';
import { PERMISSIONS, hasPermission, hasAnyPermission } from '../../../utils/permissions';

export const REPORTS_ANY_VIEW = Object.values(PERMISSIONS).filter((p) => p.startsWith('reports.') && p.endsWith('.view'));

// The Reports IA — one focused workspace per business question, replacing
// the old single flat AdminReports.jsx page (six report sections stacked
// on one infinite scroll) plus two more report types that lived as
// separate sibling pages (AdminShippingReports, AdminReportArchive).
// Modeled directly on components/admin/settings/SettingsLayout.jsx, which
// solved the identical "one area, many sub-pages" problem for Settings.
//
// Executive Dashboard is the literal index (not a separate "Overview"
// link-menu page the way Settings has one) — a BI platform opens straight
// into data, the same relationship Stripe's account Home or Shopify
// Analytics has to their own landing view.
export const REPORT_CATEGORIES = [
  { to: '/admin/reports', end: true, icon: HomeIcon, label: 'Executive Dashboard', description: 'Revenue, health, and what needs attention today', permission: PERMISSIONS.REPORTS_EXECUTIVE_VIEW },
  { to: '/admin/reports/sales', icon: CurrencyDollarIcon, label: 'Sales', description: 'Revenue, orders, by category & sport', permission: PERMISSIONS.REPORTS_SALES_VIEW },
  { to: '/admin/reports/products', icon: CubeIcon, label: 'Products', description: 'Best/worst sellers, stock levels', permission: PERMISSIONS.REPORTS_PRODUCTS_VIEW },
  { to: '/admin/reports/customers', icon: UsersIcon, label: 'Customers', description: 'Top spenders, geography, growth', permission: PERMISSIONS.REPORTS_CUSTOMERS_VIEW },
  { to: '/admin/reports/operations', icon: TruckIcon, label: 'Operations', description: 'Fulfillment, shipping, checkout recovery, webhook health', permission: PERMISSIONS.REPORTS_OPERATIONS_VIEW },
  { to: '/admin/reports/fit-check', icon: SparklesIcon, label: 'Fit Check Analytics', description: 'Usage, success, cost, conversion, campaigns', permission: PERMISSIONS.REPORTS_FITCHECK_VIEW },
  { to: '/admin/reports/organizations', icon: TrophyIcon, label: 'Organizations', description: 'Revenue by org, league, team; followers', permission: PERMISSIONS.REPORTS_ORGANIZATIONS_VIEW },
  { to: '/admin/reports/finance', icon: BanknotesIcon, label: 'Finance', description: 'Net revenue, refunds, payment reconciliation', permission: PERMISSIONS.REPORTS_FINANCE_VIEW },
  // Visible if any single workspace is reachable — matches the backend's
  // /reports/archive gate (requireAnyPermission across every reports.*.view).
  { to: '/admin/reports/exports', icon: ArrowDownTrayIcon, label: 'Exports', description: 'Every report — Excel, CSV, PDF', anyOf: REPORTS_ANY_VIEW },
];

function ReportNavLink({ category }) {
  const Icon = category.icon;
  return (
    <NavLink
      to={category.to}
      end={category.end}
      className={({ isActive }) =>
        `block px-4 py-3 rounded-lg transition-colors ${
          isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50'
        }`
      }
    >
      <span className="flex items-center gap-2.5 text-sm font-medium">
        <Icon className="w-5 h-5 flex-shrink-0" />
        {category.label}
      </span>
      <span className="block text-xs text-gray-400 mt-0.5 ml-[1.875rem]">{category.description}</span>
    </NavLink>
  );
}

const ReportsLayout = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Reports</h1>
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <nav className="w-full lg:w-72 flex-shrink-0 bg-white rounded-xl border border-gray-200 p-2">
          {REPORT_CATEGORIES.map((category) => (
            <ReportNavLink key={category.to} category={category} />
          ))}
        </nav>
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default ReportsLayout;
