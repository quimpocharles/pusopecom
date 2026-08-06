import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import shipmentService from '../../services/shipmentService';
import authService from '../../services/authService';
import {
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_COLORS,
  SHIPMENT_QUEUES,
  NEXT_STATUS,
  shipmentStatusLabel,
} from '../../utils/shipmentStatus';

// Enterprise Fulfillment Blueprint, Phase 1 — replaces the flat status
// dropdown (AdminOrders.jsx) with the real operational queue view: a tab
// per stage, one-click "advance to next" instead of picking from every
// possible status, and an assignee so more than one warehouse staffer can
// work the queue without stepping on each other.
const AdminShipments = () => {
  const [shipments, setShipments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [staff, setStaff] = useState([]);
  const [advancing, setAdvancing] = useState(null);

  const fetchShipments = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      const res = await shipmentService.getShipments(params);
      setShipments(res.data);
      setPagination(res.pagination);
    } catch (error) {
      console.error('Failed to load shipments:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  useEffect(() => {
    authService.getAdminUsers({ role: 'admin', limit: 100 })
      .then((res) => setStaff(res.data))
      .catch((err) => console.error('Failed to load staff list:', err));
  }, []);

  const handleAdvance = async (shipment) => {
    const next = NEXT_STATUS[shipment.status];
    if (!next) return;
    setAdvancing(shipment._id);
    try {
      await shipmentService.transitionStatus(shipment._id, { status: next });
      fetchShipments(pagination.page);
    } catch (error) {
      console.error('Failed to advance shipment:', error);
    } finally {
      setAdvancing(null);
    }
  };

  const handleAssign = async (shipmentId, userId) => {
    try {
      await shipmentService.assign(shipmentId, userId || null);
      fetchShipments(pagination.page);
    } catch (error) {
      console.error('Failed to assign shipment:', error);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Fulfillment Queue</h1>
      </div>

      {/* Queue tabs — the operational shape from Blueprint §2, not a generic dropdown */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setStatusFilter('')}
          className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            statusFilter === '' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          All
        </button>
        {SHIPMENT_QUEUES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              statusFilter === s ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {SHIPMENT_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                <th className="px-6 py-3">Order #</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Assigned To</th>
                <th className="px-6 py-3">Updated</th>
                <th className="px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center">
                  <div className="w-6 h-6 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
                </td></tr>
              ) : shipments.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">No shipments in this queue</td></tr>
              ) : (
                shipments.map((shipment) => {
                  const next = NEXT_STATUS[shipment.status];
                  return (
                    <tr key={shipment._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium">
                        <Link to={`/admin/orders/${shipment.order?.orderNumber}`} className="text-primary-600 hover:text-primary-800 hover:underline">
                          {shipment.order?.orderNumber}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {shipment.order?.user ? `${shipment.order.user.firstName} ${shipment.order.user.lastName}` : shipment.order?.email}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${SHIPMENT_STATUS_COLORS[shipment.status] || 'bg-gray-100 text-gray-800'}`}>
                          {shipmentStatusLabel(shipment.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={shipment.assignedToUserId || ''}
                          onChange={(e) => handleAssign(shipment._id, e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          <option value="">Unassigned</option>
                          {staff.map((s) => (
                            <option key={s._id} value={s._id}>{s.firstName} {s.lastName}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{new Date(shipment.updatedAt).toLocaleString()}</td>
                      <td className="px-6 py-4">
                        {next ? (
                          <button
                            onClick={() => handleAdvance(shipment)}
                            disabled={advancing === shipment._id}
                            className="px-3 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700 disabled:opacity-50 whitespace-nowrap"
                          >
                            {advancing === shipment._id ? '…' : `Mark ${SHIPMENT_STATUS_LABELS[next]}`}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Showing {(pagination.page - 1) * 20 + 1}–{Math.min(pagination.page * 20, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-2">
              <button onClick={() => fetchShipments(pagination.page - 1)} disabled={pagination.page <= 1} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Previous</button>
              <button onClick={() => fetchShipments(pagination.page + 1)} disabled={pagination.page >= pagination.pages} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminShipments;
