import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import LoadingSpinner from './components/common/LoadingSpinner';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
const Checkout = lazy(() => import('./pages/Checkout'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const CompleteProfile = lazy(() => import('./pages/CompleteProfile'));
const Orders = lazy(() => import('./pages/Orders'));
const OrderConfirmation = lazy(() => import('./pages/OrderConfirmation'));
const Account = lazy(() => import('./pages/Account'));
const DataPolicy = lazy(() => import('./pages/DataPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminProductForm = lazy(() => import('./pages/admin/AdminProductForm'));
const AdminLeagues = lazy(() => import('./pages/admin/AdminLeagues'));
const AdminCampaigns = lazy(() => import('./pages/admin/AdminCampaigns'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminOrderDetail = lazy(() => import('./pages/admin/AdminOrderDetail'));
const AdminReportArchive = lazy(() => import('./pages/admin/AdminReportArchive'));
const AdminFAQ = lazy(() => import('./pages/admin/AdminFAQ'));
const AdminPromoMessages = lazy(() => import('./pages/admin/AdminPromoMessages'));
const AdminHomepageSections = lazy(() => import('./pages/admin/AdminHomepageSections'));
const AdminFeaturedTeam = lazy(() => import('./pages/admin/AdminFeaturedTeam'));
const AdminPartnerLogos = lazy(() => import('./pages/admin/AdminPartnerLogos'));
const AdminNavigation = lazy(() => import('./pages/admin/AdminNavigation'));
const AdminFooter = lazy(() => import('./pages/admin/AdminFooter'));
const AdminHomepageBuilder = lazy(() => import('./pages/admin/AdminHomepageBuilder'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminPickup = lazy(() => import('./pages/admin/AdminPickup'));
const AdminShippingReports = lazy(() => import('./pages/admin/AdminShippingReports'));
const DesignSystemDemo = lazy(() => import('./pages/_dev/DesignSystemDemo'));

import AdminRoute from './components/admin/AdminRoute';
import AdminLayout from './components/admin/AdminLayout';

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
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/complete-profile" element={<CompleteProfile />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/order/:orderNumber" element={<OrderConfirmation />} />
          <Route path="/account" element={<Account />} />
          <Route path="/privacy" element={<DataPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          {/* Unlinked design-system primitive demo — Phase 1 of the design system migration plan, not part of any real user flow. */}
          <Route path="/_design-system" element={<DesignSystemDemo />} />

          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="products/new" element={<AdminProductForm />} />
            <Route path="products/:id/edit" element={<AdminProductForm />} />
            <Route path="leagues" element={<AdminLeagues />} />
            <Route path="campaigns" element={<AdminCampaigns />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="orders/:orderNumber" element={<AdminOrderDetail />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="settings/pickup" element={<AdminPickup />} />
            <Route path="reports/shipping" element={<AdminShippingReports />} />
            <Route path="reports/archive" element={<AdminReportArchive />} />
            <Route path="homepage/faq" element={<AdminFAQ />} />
            <Route path="homepage/announcements" element={<AdminPromoMessages />} />
            <Route path="homepage/sections" element={<AdminHomepageSections />} />
            <Route path="homepage/featured-team" element={<AdminFeaturedTeam />} />
            <Route path="homepage/partners" element={<AdminPartnerLogos />} />
            <Route path="homepage/navigation" element={<AdminNavigation />} />
            <Route path="homepage/footer" element={<AdminFooter />} />
            <Route path="homepage" element={<AdminHomepageBuilder />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
