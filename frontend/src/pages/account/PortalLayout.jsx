import { Navigate, NavLink, Outlet } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import SEO from '../../components/common/SEO';
import NotificationBell from '../../components/portal/NotificationBell';
import useAuthStore from '../../store/authStore';

// The four concepts from docs/MY_PUSO_MANIFESTO.md — nothing else earns a
// permanent nav slot. Settings is reached via the avatar, not listed here;
// notifications are the bell, an overlay, never a route in this bar.
const tabs = [
  { to: '/account', label: 'Home', end: true },
  { to: '/account/locker', label: 'Locker' },
  { to: '/account/fit-check', label: 'Fit Check' },
  { to: '/account/following', label: 'Following' },
];

const PortalLayout = () => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login?redirect=/account" replace />;
  }

  const initial = (user?.firstName?.[0] || user?.email?.[0] || '?').toUpperCase();

  return (
    <Layout>
      <SEO title="My PUSO" noIndex />
      <div className="container-custom py-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">My PUSO</h1>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <NavLink
              to="/account/settings/profile"
              className="w-9 h-9 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-semibold hover:bg-primary-700 transition-colors"
              aria-label="Settings"
              title="Settings"
            >
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
              ) : (
                initial
              )}
            </NavLink>
          </div>
        </div>

        <div className="flex gap-1 border-b border-gray-200 mb-8 overflow-x-auto">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
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
    </Layout>
  );
};

export default PortalLayout;
