import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import LoadingSpinner from './components/common/LoadingSpinner';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import NotFound from './pages/NotFound';
const Checkout = lazy(() => import('./pages/Checkout'));
const PassEvents = lazy(() => import('./pages/PassEvents'));
const PassEventDetail = lazy(() => import('./pages/PassEventDetail'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const CompleteProfile = lazy(() => import('./pages/CompleteProfile'));
const Orders = lazy(() => import('./pages/Orders'));
const OrderConfirmation = lazy(() => import('./pages/OrderConfirmation'));
const RequestReturn = lazy(() => import('./pages/RequestReturn'));
const PortalLayout = lazy(() => import('./pages/account/PortalLayout'));
const PortalHome = lazy(() => import('./pages/account/PortalHome'));
const Locker = lazy(() => import('./pages/account/Locker'));
const FitCheck = lazy(() => import('./pages/account/FitCheck'));
const Following = lazy(() => import('./pages/account/Following'));
const PortalSettings = lazy(() => import('./pages/account/PortalSettings'));
const AccountProfile = lazy(() => import('./pages/account/AccountProfile'));
const AccountAddresses = lazy(() => import('./pages/account/AccountAddresses'));
const AccountPassword = lazy(() => import('./pages/account/AccountPassword'));
const AccountSecurity = lazy(() => import('./pages/account/AccountSecurity'));
const DataPolicy = lazy(() => import('./pages/DataPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminProductForm = lazy(() => import('./pages/admin/AdminProductForm'));
const AdminLeagues = lazy(() => import('./pages/admin/AdminLeagues'));
const AdminCampaigns = lazy(() => import('./pages/admin/AdminCampaigns'));
const AdminPromoCodes = lazy(() => import('./pages/admin/AdminPromoCodes'));
const AdminVenues = lazy(() => import('./pages/admin/AdminVenues'));
const AdminVenueDetail = lazy(() => import('./pages/admin/AdminVenueDetail'));
const AdminPassEvents = lazy(() => import('./pages/admin/AdminPassEvents'));
const AdminPassEventDetail = lazy(() => import('./pages/admin/AdminPassEventDetail'));
const AdminFitCheckCampaigns = lazy(() => import('./pages/admin/AdminFitCheckCampaigns'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminOrderDetail = lazy(() => import('./pages/admin/AdminOrderDetail'));
const AdminShipments = lazy(() => import('./pages/admin/AdminShipments'));
const AdminReturns = lazy(() => import('./pages/admin/AdminReturns'));
const AdminFAQ = lazy(() => import('./pages/admin/AdminFAQ'));
const AdminPromoMessages = lazy(() => import('./pages/admin/AdminPromoMessages'));
const AdminHomepageSections = lazy(() => import('./pages/admin/AdminHomepageSections'));
const AdminFeaturedTeam = lazy(() => import('./pages/admin/AdminFeaturedTeam'));
const AdminPartnerLogos = lazy(() => import('./pages/admin/AdminPartnerLogos'));
const AdminNavigation = lazy(() => import('./pages/admin/AdminNavigation'));
const AdminFooter = lazy(() => import('./pages/admin/AdminFooter'));
const AdminHomepageBuilder = lazy(() => import('./pages/admin/AdminHomepageBuilder'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const ReportsLayout = lazy(() => import('./components/admin/reports/ReportsLayout'));
const ExecutiveDashboard = lazy(() => import('./pages/admin/reports/ExecutiveDashboard'));
const SalesReportPage = lazy(() => import('./pages/admin/reports/SalesReportPage'));
const ProductsReportPage = lazy(() => import('./pages/admin/reports/ProductsReportPage'));
const CustomersReportPage = lazy(() => import('./pages/admin/reports/CustomersReportPage'));
const OperationsReportPage = lazy(() => import('./pages/admin/reports/OperationsReportPage'));
const FitCheckAnalyticsPage = lazy(() => import('./pages/admin/reports/FitCheckAnalyticsPage'));
const OrganizationsReportPage = lazy(() => import('./pages/admin/reports/OrganizationsReportPage'));
const FinanceReportPage = lazy(() => import('./pages/admin/reports/FinanceReportPage'));
const ExportsWorkspace = lazy(() => import('./pages/admin/reports/ExportsWorkspace'));
const SettingsLayout = lazy(() => import('./components/admin/settings/SettingsLayout'));
const SettingsOverview = lazy(() => import('./pages/admin/settings/SettingsOverview'));
const FitCheckSettings = lazy(() => import('./pages/admin/settings/FitCheckSettings'));
const CommerceSettings = lazy(() => import('./pages/admin/settings/CommerceSettings'));
const NotificationSettings = lazy(() => import('./pages/admin/settings/NotificationSettings'));
const SecuritySettings = lazy(() => import('./pages/admin/settings/SecuritySettings'));
const IntegrationsSettings = lazy(() => import('./pages/admin/settings/IntegrationsSettings'));
const AdvancedSettings = lazy(() => import('./pages/admin/settings/AdvancedSettings'));
const DesignSystemDemo = lazy(() => import('./pages/_dev/DesignSystemDemo'));

import AdminRoute from './components/admin/AdminRoute';
import AdminLayout from './components/admin/AdminLayout';
import PermissionRoute from './components/admin/PermissionRoute';
import { PERMISSIONS } from './utils/permissions';

const REPORTS_ANY_VIEW = Object.values(PERMISSIONS).filter((p) => p.startsWith('reports.') && p.endsWith('.view'));
const SETTINGS_ANY_MANAGE = Object.values(PERMISSIONS).filter((p) => p.startsWith('settings.') && p.endsWith('.manage'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function App() {
  return (
    <Router>
      <ScrollToTop />
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:slug" element={<ProductDetail />} />
          <Route path="/events" element={<PassEvents />} />
          <Route path="/events/:slug" element={<PassEventDetail />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/complete-profile" element={<CompleteProfile />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/order/:orderNumber" element={<OrderConfirmation />} />
          <Route path="/order/:orderNumber/return" element={<RequestReturn />} />
          <Route path="/account" element={<PortalLayout />}>
            <Route index element={<PortalHome />} />
            <Route path="locker" element={<Locker />} />
            <Route path="fit-check" element={<FitCheck />} />
            <Route path="following" element={<Following />} />
            <Route path="settings" element={<PortalSettings />}>
              <Route index element={<Navigate to="profile" replace />} />
              <Route path="profile" element={<AccountProfile />} />
              <Route path="addresses" element={<AccountAddresses />} />
              <Route path="password" element={<AccountPassword />} />
              <Route path="security" element={<AccountSecurity />} />
            </Route>
          </Route>
          <Route path="/privacy" element={<DataPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          {/* Unlinked design-system primitive demo — Phase 1 of the design system migration plan, not part of any real user flow. */}
          <Route path="/_design-system" element={<DesignSystemDemo />} />

          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="products" element={<PermissionRoute permission={PERMISSIONS.PRODUCTS_VIEW}><AdminProducts /></PermissionRoute>} />
            <Route path="products/new" element={<PermissionRoute permission={PERMISSIONS.PRODUCTS_MANAGE}><AdminProductForm /></PermissionRoute>} />
            <Route path="products/:id/edit" element={<PermissionRoute permission={PERMISSIONS.PRODUCTS_MANAGE}><AdminProductForm /></PermissionRoute>} />
            <Route path="leagues" element={<PermissionRoute permission={PERMISSIONS.LEAGUES_MANAGE}><AdminLeagues /></PermissionRoute>} />
            <Route path="campaigns" element={<PermissionRoute permission={PERMISSIONS.CAMPAIGNS_MANAGE}><AdminCampaigns /></PermissionRoute>} />
            <Route path="promo-codes" element={<PermissionRoute permission={PERMISSIONS.PROMOTIONS_MANAGE}><AdminPromoCodes /></PermissionRoute>} />
            <Route path="venues" element={<PermissionRoute permission={PERMISSIONS.PASSES_MANAGE}><AdminVenues /></PermissionRoute>} />
            <Route path="venues/:id" element={<PermissionRoute permission={PERMISSIONS.PASSES_MANAGE}><AdminVenueDetail /></PermissionRoute>} />
            <Route path="pass-events" element={<PermissionRoute permission={PERMISSIONS.PASSES_MANAGE}><AdminPassEvents /></PermissionRoute>} />
            <Route path="pass-events/:id" element={<PermissionRoute permission={PERMISSIONS.PASSES_MANAGE}><AdminPassEventDetail /></PermissionRoute>} />
            <Route path="fit-check-campaigns" element={<PermissionRoute permission={PERMISSIONS.FITCHECK_CAMPAIGNS_MANAGE}><AdminFitCheckCampaigns /></PermissionRoute>} />
            <Route path="orders" element={<PermissionRoute permission={PERMISSIONS.ORDERS_VIEW}><AdminOrders /></PermissionRoute>} />
            <Route path="orders/:orderNumber" element={<PermissionRoute permission={PERMISSIONS.ORDERS_VIEW}><AdminOrderDetail /></PermissionRoute>} />
            <Route path="shipments" element={<PermissionRoute permission={PERMISSIONS.FULFILLMENT_MANAGE}><AdminShipments /></PermissionRoute>} />
            <Route path="returns" element={<PermissionRoute permission={PERMISSIONS.RETURNS_VIEW}><AdminReturns /></PermissionRoute>} />
            <Route path="users" element={<PermissionRoute permission={PERMISSIONS.USERS_VIEW}><AdminUsers /></PermissionRoute>} />
            <Route path="reports" element={<PermissionRoute anyOf={REPORTS_ANY_VIEW}><ReportsLayout /></PermissionRoute>}>
              <Route index element={<PermissionRoute permission={PERMISSIONS.REPORTS_EXECUTIVE_VIEW}><ExecutiveDashboard /></PermissionRoute>} />
              <Route path="sales" element={<PermissionRoute permission={PERMISSIONS.REPORTS_SALES_VIEW}><SalesReportPage /></PermissionRoute>} />
              <Route path="products" element={<PermissionRoute permission={PERMISSIONS.REPORTS_PRODUCTS_VIEW}><ProductsReportPage /></PermissionRoute>} />
              <Route path="customers" element={<PermissionRoute permission={PERMISSIONS.REPORTS_CUSTOMERS_VIEW}><CustomersReportPage /></PermissionRoute>} />
              <Route path="operations" element={<PermissionRoute permission={PERMISSIONS.REPORTS_OPERATIONS_VIEW}><OperationsReportPage /></PermissionRoute>} />
              <Route path="fit-check" element={<PermissionRoute permission={PERMISSIONS.REPORTS_FITCHECK_VIEW}><FitCheckAnalyticsPage /></PermissionRoute>} />
              <Route path="organizations" element={<PermissionRoute permission={PERMISSIONS.REPORTS_ORGANIZATIONS_VIEW}><OrganizationsReportPage /></PermissionRoute>} />
              <Route path="finance" element={<PermissionRoute permission={PERMISSIONS.REPORTS_FINANCE_VIEW}><FinanceReportPage /></PermissionRoute>} />
              <Route path="exports" element={<PermissionRoute anyOf={REPORTS_ANY_VIEW}><ExportsWorkspace /></PermissionRoute>} />
            </Route>
            <Route path="settings" element={<PermissionRoute anyOf={SETTINGS_ANY_MANAGE}><SettingsLayout /></PermissionRoute>}>
              <Route index element={<SettingsOverview />} />
              <Route path="fit-check" element={<PermissionRoute permission={PERMISSIONS.SETTINGS_FITCHECK_MANAGE}><FitCheckSettings /></PermissionRoute>} />
              <Route path="commerce" element={<PermissionRoute permission={PERMISSIONS.SETTINGS_COMMERCE_MANAGE}><CommerceSettings /></PermissionRoute>} />
              <Route path="notifications" element={<PermissionRoute permission={PERMISSIONS.SETTINGS_NOTIFICATIONS_MANAGE}><NotificationSettings /></PermissionRoute>} />
              <Route path="security" element={<PermissionRoute permission={PERMISSIONS.SETTINGS_SECURITY_MANAGE}><SecuritySettings /></PermissionRoute>} />
              <Route path="integrations" element={<PermissionRoute permission={PERMISSIONS.SETTINGS_INTEGRATIONS_MANAGE}><IntegrationsSettings /></PermissionRoute>} />
              <Route path="advanced" element={<PermissionRoute permission={PERMISSIONS.SETTINGS_ADVANCED_MANAGE}><AdvancedSettings /></PermissionRoute>} />
            </Route>
            <Route path="homepage/faq" element={<PermissionRoute permission={PERMISSIONS.HOMEPAGE_MANAGE}><AdminFAQ /></PermissionRoute>} />
            <Route path="homepage/announcements" element={<PermissionRoute permission={PERMISSIONS.HOMEPAGE_MANAGE}><AdminPromoMessages /></PermissionRoute>} />
            <Route path="homepage/sections" element={<PermissionRoute permission={PERMISSIONS.HOMEPAGE_MANAGE}><AdminHomepageSections /></PermissionRoute>} />
            <Route path="homepage/featured-team" element={<PermissionRoute permission={PERMISSIONS.HOMEPAGE_MANAGE}><AdminFeaturedTeam /></PermissionRoute>} />
            <Route path="homepage/partners" element={<PermissionRoute permission={PERMISSIONS.HOMEPAGE_MANAGE}><AdminPartnerLogos /></PermissionRoute>} />
            <Route path="homepage/navigation" element={<PermissionRoute permission={PERMISSIONS.HOMEPAGE_MANAGE}><AdminNavigation /></PermissionRoute>} />
            <Route path="homepage/footer" element={<PermissionRoute permission={PERMISSIONS.HOMEPAGE_MANAGE}><AdminFooter /></PermissionRoute>} />
            <Route path="homepage" element={<PermissionRoute permission={PERMISSIONS.HOMEPAGE_MANAGE}><AdminHomepageBuilder /></PermissionRoute>} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
