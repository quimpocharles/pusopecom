import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownTrayIcon, PencilIcon } from '@heroicons/react/24/outline';
import orderService from '../../services/orderService';

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

const COURIERS = [
  'LBC',
  'J&T Express',
  'Ninja Van',
  'Flash Express',
  'GoGo Xpress',
  '2GO',
  'GrabExpress',
  'Lalamove',
  'DHL Express',
  'FedEx',
];

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [updating, setUpdating] = useState(null);
  // editStatus[orderId] = { orderStatus, courier, trackingNumber, editingShipping }
  const [editStatus, setEditStatus] = useState({});
  const [exportPeriod, setExportPeriod] = useState('daily');
  const [exporting, setExporting] = useState(false);

  const fetchOrders = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      if (paymentFilter) params.paymentStatus = paymentFilter;

      const res = await orderService.getAllOrders(params);
      setOrders(res.data);
      setPagination(res.pagination);
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, paymentFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const setField = (orderId, field, value) =>
    setEditStatus((prev) => ({
      ...prev,
      [orderId]: { ...prev[orderId], [field]: value }
    }));

  const handleStatusUpdate = async (orderId, order) => {
    const data = editStatus[orderId] || {};
    const orderStatus = data.orderStatus || order.orderStatus;
    const isPickup = order.shippingMethod === 'venue_pickup';

    setUpdating(orderId);
    try {
      await orderService.updateOrderStatus(orderId, {
        orderStatus,
        ...(isPickup ? {} : {
          courier: data.courier ?? order.courier,
          trackingNumber: data.trackingNumber ?? order.trackingNumber,
        }),
      });
      setEditStatus((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
      fetchOrders(pagination.page);
    } catch (error) {
      console.error('Failed to update order:', error);
    } finally {
      setUpdating(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await orderService.exportOrdersCSV(exportPeriod);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <div className="flex items-center gap-2">
          <select
            value={exportPeriod}
            onChange={(e) => setExportPeriod(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Annual</option>
            <option value="all">All Time</option>
          </select>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="processing">Processing</option>
            <option value="confirmed">Confirmed</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">All Payments</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                <th className="px-6 py-3">Order #</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Total</th>
                <th className="px-6 py-3">Payment</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Shipping</th>
                <th className="px-6 py-3">Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="w-6 h-6 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-500">
                    No orders found
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const edit = editStatus[order._id] || {};
                  const isEditingShipping = edit.editingShipping;
                  const isPickup = order.shippingMethod === 'venue_pickup';
                  const hasSavedShipping = !isPickup && (order.courier || order.trackingNumber);

                  return (
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
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.orderStatus]}`}>
                          {order.orderStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>

                      {/* Shipping column — courier + tracking (hidden for pick-up orders) */}
                      <td className="px-6 py-4">
                        {isPickup ? (
                          <div>
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              Venue Pick-Up
                            </span>
                            {order.shippingAddress?.city && (
                              <p className="text-xs text-gray-500 mt-1">{order.shippingAddress.city}</p>
                            )}
                          </div>
                        ) : hasSavedShipping && !isEditingShipping ? (
                          <div className="flex items-center gap-1.5">
                            <div className="text-xs text-gray-700">
                              <span className="font-medium">{order.courier}</span>
                              {order.trackingNumber && (
                                <span className="text-gray-500 ml-1">· {order.trackingNumber}</span>
                              )}
                            </div>
                            <button
                              onClick={() => setField(order._id, 'editingShipping', true)}
                              className="p-1 text-gray-400 hover:text-primary-600 rounded transition-colors"
                              title="Edit shipping"
                            >
                              <PencilIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            <select
                              value={edit.courier ?? order.courier ?? ''}
                              onChange={(e) => setField(order._id, 'courier', e.target.value)}
                              className="w-36 px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                            >
                              <option value="">Select courier</option>
                              {COURIERS.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                            <input
                              type="text"
                              placeholder="Tracking #"
                              value={edit.trackingNumber ?? order.trackingNumber ?? ''}
                              onChange={(e) => setField(order._id, 'trackingNumber', e.target.value)}
                              className="w-36 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                            />
                          </div>
                        )}
                      </td>

                      {/* Update column — status select + button */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <select
                            value={edit.orderStatus || order.orderStatus}
                            onChange={(e) => setField(order._id, 'orderStatus', e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                          >
                            <option value="processing">Processing</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                          <button
                            onClick={() => handleStatusUpdate(order._id, order)}
                            disabled={updating === order._id}
                            className="px-3 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            {updating === order._id ? '…' : 'Save'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Showing {(pagination.page - 1) * 20 + 1}–{Math.min(pagination.page * 20, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => fetchOrders(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => fetchOrders(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminOrders;
