import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Squares2X2Icon,
  SparklesIcon,
  ShoppingBagIcon,
  BellIcon,
  ShieldCheckIcon,
  BoltIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';
import SettingsDirtyContext, { useSettingsDirty } from './SettingsDirtyContext';
import useAuthStore from '../../../store/authStore';
import { PERMISSIONS, hasPermission } from '../../../utils/permissions';

// The full Settings IA — one entry per category, each fitting within its
// own focused page rather than one long scroll. Descriptions render
// beneath each label per the request. Overview has no `permission` — it's
// a pure link directory (SettingsOverview.jsx), not privileged content of
// its own, so it stays visible; it filters its own card list by the same
// permissions below.
export const SETTINGS_CATEGORIES = [
  { to: '/admin/settings', end: true, icon: Squares2X2Icon, label: 'Overview', description: 'A map of everything below' },
  { to: '/admin/settings/fit-check', icon: SparklesIcon, label: 'Fit Check', description: 'Daily limits, rewards, sponsored experience, AI', permission: PERMISSIONS.SETTINGS_FITCHECK_MANAGE },
  { to: '/admin/settings/commerce', icon: ShoppingBagIcon, label: 'Commerce', description: 'Order expiration, venue pickup, and what\'s next', permission: PERMISSIONS.SETTINGS_COMMERCE_MANAGE },
  { to: '/admin/settings/notifications', icon: BellIcon, label: 'Notifications', description: 'Scheduled reports, email templates', permission: PERMISSIONS.SETTINGS_NOTIFICATIONS_MANAGE },
  { to: '/admin/settings/security', icon: ShieldCheckIcon, label: 'Security', description: 'Roles & permissions, session, API keys', permission: PERMISSIONS.SETTINGS_SECURITY_MANAGE },
  { to: '/admin/settings/integrations', icon: BoltIcon, label: 'Integrations', description: 'Connection status for external services', permission: PERMISSIONS.SETTINGS_INTEGRATIONS_MANAGE },
  { to: '/admin/settings/advanced', icon: BeakerIcon, label: 'Advanced', description: 'Feature flags, maintenance, experiments', permission: PERMISSIONS.SETTINGS_ADVANCED_MANAGE },
];

function GuardedNavLink({ category }) {
  const { isDirty } = useSettingsDirty();
  const navigate = useNavigate();
  const Icon = category.icon;

  const handleClick = (e) => {
    if (isDirty) {
      e.preventDefault();
      const proceed = window.confirm('You have unsaved changes on this page. Leave without saving?');
      if (proceed) navigate(category.to);
    }
  };

  return (
    <NavLink
      to={category.to}
      end={category.end}
      onClick={handleClick}
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

function BeforeUnloadGuard() {
  const { isDirty } = useSettingsDirty();
  useEffect(() => {
    const handler = (e) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
  return null;
}

const SettingsLayout = () => {
  const [isDirty, setIsDirty] = useState(false);
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const visibleCategories = SETTINGS_CATEGORIES.filter((c) => !c.permission || hasPermission(user, c.permission));

  // A page navigated to programmatically (e.g. via the guard above, or a
  // fresh mount) starts clean — never carry a prior page's dirty flag
  // across a route change.
  useEffect(() => { setIsDirty(false); }, [location.pathname]);

  return (
    <SettingsDirtyContext.Provider value={{ isDirty, setIsDirty }}>
      <BeforeUnloadGuard />
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <nav className="w-full lg:w-72 flex-shrink-0 bg-white rounded-xl border border-gray-200 p-2">
            {visibleCategories.map((category) => (
              <GuardedNavLink key={category.to} category={category} />
            ))}
          </nav>
          <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200 p-6">
            <Outlet />
          </div>
        </div>
      </div>
    </SettingsDirtyContext.Provider>
  );
};

export default SettingsLayout;
