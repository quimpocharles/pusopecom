import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ExclamationTriangleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import PinnedWidgets from '../../components/admin/dashboard/PinnedWidgets';
import reportService from '../../services/reportService';
import orderService from '../../services/orderService';
import authService from '../../services/authService';
import { ORDER_STATUS_COLORS, orderStatusLabel } from '../../utils/orderStatus';

const paymentColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-800',
};

// Same severity → style mapping as ExecutiveDashboard.jsx's own alert rows
// (kept in sync by hand, not shared, since that file is explicitly not to
// be touched by this change) — visual consistency between the two
// surfaces that both render this exact alert feed.
const alertStyles = {
  critical: { border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-700', Icon: ExclamationCircleIcon, iconColor: 'text-red-500' },
  warning: { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-700', Icon: ExclamationTriangleIcon, iconColor: 'text-amber-500' },
};

// Admin Dashboard Phase 2A — every data source below is fetched and
// tracked independently (never one Promise.all whose single rejection
// blanks the whole page). `state` distinguishes a genuine value from an
// unreachable one so a 403 (an admin's department lacks the permission a
// given call requires) can never render as a false "zero" / "all healthy"
// result — see classifyError below and each section's own state === ...
// branches.
function classifyError(err) {
  return err?.response?.status === 403 ? 'forbidden' : 'error';
}

const UNAVAILABLE_TEXT = {
  forbidden: 'Not available for your role',
  error: "Couldn't load",
};

function StatusCard({ label, state, value, subtitle }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      {state === 'ready' ? (
        <>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </>
      ) : state === 'loading' ? (
        <div className="h-8 w-20 bg-gray-100 rounded animate-pulse mt-2" />
      ) : (
        <p className="text-sm text-gray-400 mt-2">{UNAVAILABLE_TEXT[state]}</p>
      )}
    </div>
  );
}

const AdminDashboard = () => {
  // { state: 'loading' | 'ready' | 'forbidden' | 'error', data }
  const [executive, setExecutive] = useState({ state: 'loading', data: null });
  const [users, setUsers] = useState({ state: 'loading', data: null });
  const [topSelling, setTopSelling] = useState({ state: 'loading', data: null });
  const [recentOrders, setRecentOrders] = useState({ state: 'loading', data: null });

  useEffect(() => {
    // Ungated (see routes/reports.js's own comment on dashboard-widgets —
    // the same "visible to every admin" philosophy applies here); called
    // with no date params, computeExecutiveReport's totals are all-time,
    // matching what "Total Revenue"/"Total Orders" have always meant here.
    reportService.getExecutiveReport()
      .then((res) => setExecutive({ state: 'ready', data: res.data }))
      .catch((err) => setExecutive({ state: classifyError(err), data: null }));

    // users.view-gated — not every department has it (e.g. marketing).
    authService.getAdminUsers({ limit: 1 })
      .then((res) => setUsers({ state: 'ready', data: res.pagination.total }))
      .catch((err) => setUsers({ state: classifyError(err), data: null }));

    // orders.view-gated.
    orderService.getOrderStats()
      .then((res) => setTopSelling({ state: 'ready', data: res.data.topSellingProducts || [] }))
      .catch((err) => setTopSelling({ state: classifyError(err), data: null }));

    // orders.view-gated.
    orderService.getAllOrders({ limit: 5 })
      .then((res) => setRecentOrders({ state: 'ready', data: res.data || [] }))
      .catch((err) => setRecentOrders({ state: classifyError(err), data: null }));
  }, []);

  const alerts = executive.state === 'ready' ? executive.data.alerts : null;
  const kpis = executive.state === 'ready' ? executive.data.kpis : null;
  const ops = executive.state === 'ready' ? executive.data.operationsHealth : null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* STATUS — fixed, always visible, never customizable/hideable. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatusCard
          label="Total Revenue"
          state={executive.state}
          value={kpis && `₱${kpis.totalRevenue.toLocaleString()}`}
        />
        <StatusCard
          label="Total Orders"
          state={executive.state}
          value={kpis && kpis.totalOrders.toLocaleString()}
        />
        <StatusCard
          label="Fulfillment Rate"
          state={executive.state}
          value={ops && `${ops.fulfillmentRate}%`}
          subtitle={ops && `${ops.pendingShipments} pending shipment${ops.pendingShipments === 1 ? '' : 's'}`}
        />
        <StatusCard
          label="Users"
          state={users.state}
          value={users.state === 'ready' ? users.data.toLocaleString() : null}
        />
      </div>

      {/* NEEDS ATTENTION — reuses GET /reports/executive's alerts feed
          verbatim (severity, sorting, message, link, empty state all
          computed server-side in buildAlertsFeed) — nothing here decides
          what counts as an alert. Always rendered, never customizable. */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Needs Attention</h2>
        {executive.state === 'loading' ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-11 bg-gray-100 rounded-lg animate-pulse" />)}
          </div>
        ) : executive.state !== 'ready' ? (
          <p className="text-sm text-gray-400">{UNAVAILABLE_TEXT[executive.state]}</p>
        ) : alerts.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing flagged — operations look healthy.</p>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert, i) => {
              const style = alertStyles[alert.severity];
              const AlertIcon = style.Icon;
              return (
                <Link
                  key={i}
                  to={alert.link}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-lg border ${style.border} ${style.bg} hover:opacity-80 transition-opacity`}
                >
                  <AlertIcon className={`w-5 h-5 flex-shrink-0 ${style.iconColor}`} />
                  <span className={`text-sm font-medium ${style.text}`}>{alert.message}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* PERFORMANCE — Top Selling Products (fixed) alongside the
          customizable widgets (PinnedWidgets, now scoped to Performance-
          only widgets — see that component's own comment). Customization
          never applies to STATUS or NEEDS ATTENTION above. */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm font-semibold text-gray-900 mb-3">Top Selling Products</p>
            {topSelling.state === 'ready' ? (
              topSelling.data.length > 0 ? (
                <div className="space-y-4">
                  {topSelling.data.map((product, index) => (
                    <div key={product._id || index} className="flex items-center gap-4">
                      <span className="text-sm font-bold text-gray-400 w-5 text-right">
                        {index + 1}
                      </span>
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-10 h-10 rounded-lg object-cover bg-gray-100"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {product.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {product.totalQuantity} units sold
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No sales data yet</p>
              )
            ) : topSelling.state === 'loading' ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-4">{UNAVAILABLE_TEXT[topSelling.state]}</p>
            )}
          </div>

          <PinnedWidgets />
        </div>
      </div>

      {/* RECENT ACTIVITY */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
          <Link to="/admin/orders" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
            View all
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">Order #</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Total</th>
                <th className="px-6 py-3">Payment</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentOrders.state === 'loading' && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="w-6 h-6 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              )}
              {(recentOrders.state === 'forbidden' || recentOrders.state === 'error') && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400">
                    {UNAVAILABLE_TEXT[recentOrders.state]}
                  </td>
                </tr>
              )}
              {recentOrders.state === 'ready' && recentOrders.data.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                    No orders yet
                  </td>
                </tr>
              )}
              {recentOrders.state === 'ready' && recentOrders.data.map((order) => (
                <tr key={order._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium">
                    <Link
                      to={`/admin/orders/${order.orderNumber}`}
                      className="text-primary-600 hover:text-primary-800 hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {order.user ? `${order.user.firstName} ${order.user.lastName}` : order.email}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                    ₱{order.total?.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${paymentColors[order.paymentStatus]}`}>
                      {order.paymentStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS_COLORS[order.orderStatus]}`}>
                      {orderStatusLabel(order.orderStatus)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
