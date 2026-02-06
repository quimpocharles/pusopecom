import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CurrencyDollarIcon,
  CalendarDaysIcon,
  ShoppingCartIcon,
  UsersIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import StatsCard from '../../components/admin/StatsCard';
import orderService from '../../services/orderService';
import authService from '../../services/authService';

const AdminDashboard = () => {
  const [orderStats, setOrderStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, ordersRes, usersRes] = await Promise.all([
          orderService.getOrderStats(),
          orderService.getAllOrders({ limit: 5 }),
          authService.getAdminUsers({ limit: 1 })
        ]);

        setOrderStats(statsRes.data);
        setRecentOrders(ordersRes.data);
        setTotalOrders(ordersRes.pagination.total);
        setTotalUsers(usersRes.pagination.total);
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statusColors = {
    processing: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  const paymentColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    paid: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    refunded: 'bg-gray-100 text-gray-800',
  };

  const pendingCount = orderStats?.ordersByStatus?.processing || 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          icon={CurrencyDollarIcon}
          title="Total Revenue"
          value={`₱${(orderStats?.totalRevenue || 0).toLocaleString()}`}
          subtitle={`${orderStats?.paidOrdersCount || 0} orders paid`}
          color="green"
        />
        <StatsCard
          icon={CalendarDaysIcon}
          title="Revenue This Month"
          value={`₱${(orderStats?.revenueThisMonth || 0).toLocaleString()}`}
          subtitle={`${orderStats?.monthlyOrdersCount || 0} orders this month`}
          color="blue"
        />
        <StatsCard
          icon={ShoppingCartIcon}
          title="Total Orders"
          value={totalOrders}
          subtitle={`${pendingCount} processing`}
          color="purple"
        />
        <StatsCard
          icon={UsersIcon}
          title="Total Users"
          value={totalUsers}
          color="orange"
        />
      </div>

      {/* Two-column section: Top Products & Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top Selling Products */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Top Selling Products</h2>
          </div>
          <div className="p-6">
            {orderStats?.topSellingProducts?.length > 0 ? (
              <div className="space-y-4">
                {orderStats.topSellingProducts.map((product, index) => (
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
            )}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 p-6 border-b border-gray-200">
            <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">Low Stock Alerts</h2>
          </div>
          <div className="p-6">
            {orderStats?.lowStockProducts?.length > 0 ? (
              <div className="space-y-3">
                {orderStats.lowStockProducts.map((product) => (
                  <div key={product._id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={product.images?.[0]}
                        alt={product.name}
                        className="w-10 h-10 rounded-lg object-cover bg-gray-100"
                      />
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {product.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        product.totalStock === 0
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {product.totalStock === 0 ? 'Out of stock' : `${product.totalStock} left`}
                      </span>
                      <Link
                        to={`/admin/products/${product._id}/edit`}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">All products well stocked</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Orders */}
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
              {recentOrders.map((order) => (
                <tr key={order._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {order.orderNumber}
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
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.orderStatus]}`}>
                      {order.orderStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                    No orders yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
