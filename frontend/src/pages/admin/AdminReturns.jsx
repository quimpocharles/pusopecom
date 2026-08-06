import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import returnService from '../../services/returnService';
import refundService from '../../services/refundService';
import {
  RETURN_STATUS_LABELS,
  RETURN_STATUS_COLORS,
  RETURN_QUEUES,
  NEXT_STATUS,
  returnStatusLabel,
} from '../../utils/returnStatus';

// Enterprise Fulfillment Blueprint, Phase 2 — the Returns queue, same tab
// shape as AdminShipments.jsx. A dedicated view rather than crowding the
// Fulfillment queue (Blueprint §2's own note: "Phase 2 gives them their own
// dedicated Returns view instead of crowding this one").
const AdminReturns = () => {
  const [returns, setReturns] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [inspecting, setInspecting] = useState(null); // full ReturnRequest being inspected
  const [conditions, setConditions] = useState({}); // returnItemId -> condition

  const fetchReturns = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      const res = await returnService.getReturns(params);
      setReturns(res.data);
      setPagination(res.pagination);
    } catch (error) {
      console.error('Failed to load returns:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchReturns(); }, [fetchReturns]);

  const handleAdvance = async (returnRequest) => {
    const next = NEXT_STATUS[returnRequest.status];
    if (!next) return;
    setBusyId(returnRequest._id);
    try {
      await returnService.transitionStatus(returnRequest._id, next);
      fetchReturns(pagination.page);
    } catch (error) {
      console.error('Failed to advance return:', error);
      alert(error.response?.data?.message || 'Failed to update return request');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (returnRequest) => {
    const resolutionNotes = window.prompt('Reason for rejecting this return request?');
    if (resolutionNotes === null) return;
    setBusyId(returnRequest._id);
    try {
      await returnService.transitionStatus(returnRequest._id, 'rejected', resolutionNotes);
      fetchReturns(pagination.page);
    } catch (error) {
      console.error('Failed to reject return:', error);
      alert(error.response?.data?.message || 'Failed to reject return request');
    } finally {
      setBusyId(null);
    }
  };

  const openInspect = async (returnRequest) => {
    try {
      const res = await returnService.getReturn(returnRequest._id);
      setInspecting(res.data);
      setConditions(Object.fromEntries(res.data.items.map((i) => [i._id, 'sellable'])));
    } catch (error) {
      console.error('Failed to load return detail:', error);
    }
  };

  const submitInspection = async () => {
    if (!inspecting) return;
    setBusyId(inspecting._id);
    try {
      await returnService.inspect(
        inspecting._id,
        inspecting.items.map((i) => ({ returnItemId: i._id, condition: conditions[i._id] || 'sellable' }))
      );
      setInspecting(null);
      fetchReturns(pagination.page);
    } catch (error) {
      console.error('Failed to record inspection:', error);
      alert(error.response?.data?.message || 'Failed to record inspection');
    } finally {
      setBusyId(null);
    }
  };

  const handleProcessRefund = async (returnRequest) => {
    // refund_pending doesn't carry the Refund id directly on the queue row —
    // the detail fetch below resolves it via the order's refund history.
    try {
      const res = await returnService.getReturn(returnRequest._id);
      const refundId = res.data.refunds?.[0]?._id;
      if (!refundId) {
        alert('No refund record found for this return yet.');
        return;
      }
      setBusyId(returnRequest._id);
      await refundService.process(refundId);
      fetchReturns(pagination.page);
    } catch (error) {
      console.error('Failed to process refund:', error);
      alert(error.response?.data?.message || 'Failed to process refund');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Returns &amp; Refunds</h1>
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setStatusFilter('')}
          className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            statusFilter === '' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          All
        </button>
        {RETURN_QUEUES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              statusFilter === s ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {RETURN_STATUS_LABELS[s]}
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
                <th className="px-6 py-3">Reason</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Updated</th>
                <th className="px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center">
                  <div className="w-6 h-6 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
                </td></tr>
              ) : returns.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">No return requests in this queue</td></tr>
              ) : (
                returns.map((r) => {
                  const next = NEXT_STATUS[r.status];
                  return (
                    <tr key={r._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium">
                        <Link to={`/admin/orders/${r.order?.orderNumber}`} className="text-primary-600 hover:text-primary-800 hover:underline">
                          {r.order?.orderNumber}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {r.order?.user ? `${r.order.user.firstName} ${r.order.user.lastName}` : r.order?.email}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate" title={r.reason}>{r.reason}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${RETURN_STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-800'}`}>
                          {returnStatusLabel(r.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{new Date(r.updatedAt || r.requestedAt).toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {r.status === 'received' ? (
                            <button
                              onClick={() => openInspect(r)}
                              className="px-3 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700 whitespace-nowrap"
                            >
                              Inspect
                            </button>
                          ) : r.status === 'refund_pending' ? (
                            <button
                              onClick={() => handleProcessRefund(r)}
                              disabled={busyId === r._id}
                              className="px-3 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700 disabled:opacity-50 whitespace-nowrap"
                            >
                              {busyId === r._id ? '…' : 'Process Refund'}
                            </button>
                          ) : next ? (
                            <button
                              onClick={() => handleAdvance(r)}
                              disabled={busyId === r._id}
                              className="px-3 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700 disabled:opacity-50 whitespace-nowrap"
                            >
                              {busyId === r._id ? '…' : `Mark ${RETURN_STATUS_LABELS[next]}`}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                          {(r.status === 'requested' || r.status === 'under_review') && (
                            <button
                              onClick={() => handleReject(r)}
                              disabled={busyId === r._id}
                              className="px-3 py-1 border border-red-300 text-red-600 rounded text-xs hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
                            >
                              Reject
                            </button>
                          )}
                        </div>
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
              <button onClick={() => fetchReturns(pagination.page - 1)} disabled={pagination.page <= 1} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Previous</button>
              <button onClick={() => fetchReturns(pagination.page + 1)} disabled={pagination.page >= pagination.pages} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {inspecting && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setInspecting(null)}>
          <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Inspect Return — {inspecting.order?.orderNumber}</h2>
            <p className="text-sm text-gray-500 mb-4">Record the condition of each returned item. Sellable items restock automatically; damaged/unsellable items are quarantined and never restocked.</p>
            <div className="space-y-3 mb-6">
              {inspecting.items.map((item) => (
                <div key={item._id} className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.orderItem?.name}</p>
                    <p className="text-xs text-gray-500">Size {item.orderItem?.size}{item.orderItem?.color ? ` · ${item.orderItem.color}` : ''} · Qty {item.quantity}</p>
                  </div>
                  <select
                    value={conditions[item._id] || 'sellable'}
                    onChange={(e) => setConditions((c) => ({ ...c, [item._id]: e.target.value }))}
                    className="px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="sellable">Sellable</option>
                    <option value="damaged">Damaged</option>
                    <option value="unsellable">Unsellable</option>
                  </select>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setInspecting(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={submitInspection}
                disabled={busyId === inspecting._id}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {busyId === inspecting._id ? 'Saving…' : 'Submit Inspection & Create Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReturns;
