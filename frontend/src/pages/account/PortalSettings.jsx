import { Link, NavLink, Outlet } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

// docs/MY_PUSO_MANIFESTO.md: Settings is a secondary utility, reached only
// via the avatar in PortalLayout, never competing with Home/Locker/Fit
// Check/Following for attention — deliberately plainer styling than the
// primary portal (no "welcome back" framing, just a quiet back link).
const tabs = [
  { to: '/account/settings/profile', label: 'Profile' },
  { to: '/account/settings/addresses', label: 'Addresses' },
  { to: '/account/settings/password', label: 'Password' },
  { to: '/account/settings/security', label: 'Security' },
];

const PortalSettings = () => {
  return (
    <div>
      <Link to="/account" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeftIcon className="w-4 h-4" />
        Back to My PUSO
      </Link>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Settings</h2>

      <div className="flex gap-1 border-b border-gray-200 mb-8 overflow-x-auto">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                isActive
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
};

export default PortalSettings;
