import { Navigate, NavLink, Outlet } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import SEO from '../../components/common/SEO';
import useAuthStore from '../../store/authStore';

const tabs = [
  { to: '/account', label: 'Overview', end: true },
  { to: '/account/orders', label: 'Orders' },
  { to: '/account/wishlist', label: 'Wishlist' },
  { to: '/account/try-ons', label: 'Try-Ons' },
  { to: '/account/notifications', label: 'Notifications' },
  { to: '/account/profile', label: 'Profile' },
  { to: '/account/addresses', label: 'Addresses' },
  { to: '/account/password', label: 'Password' },
  { to: '/account/security', label: 'Security' },
];

// Nested routes (see App.jsx) so each tab — several of them paginated
// lists — is a real, bookmarkable, back-button-friendly URL instead of the
// old activeTab useState with zero URL reflection. Keeps the same
// horizontal tab-bar look the account page already had rather than
// adopting the admin section's left-sidebar treatment, which would be
// visually inconsistent with every other customer-facing page.
const AccountLayout = () => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login?redirect=/account" replace />;
  }

  return (
    <Layout>
      <SEO title="Account Settings" noIndex />
      <div className="container-custom py-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-6">Account Settings</h1>

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

export default AccountLayout;
