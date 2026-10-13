import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import returnService from '../../services/returnService';
import refundService from '../../services/refundService';
import useAuthStore from '../../store/authStore';
import { hasPermission, PERMISSIONS } from '../../utils/permissions';
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
//
// Refunds are completed out-of-band (ePayGames exposes no automated refund
// API) and recorded here. A refund's amount is fixed before payment via the
// adjust action; recording only confirms money already moved.

const REFUND_STATUS_LABELS = {
  pending: 'Pending',
  processing: 'Processing',
  failed: 'Failed',
  succeeded: 'Succeeded',
};

const REFUND_STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-800',
  processing: 'bg-blue-100 text-blue-800',
  failed: 'bg-red-100 text-red-800',
  succeeded: 'bg-green-100 text-green-800',
};

const MAX_PROVIDER_REFERENCE = 255;
const MAX_NOTE = 1000;

function pesos(value) {
  return `₱${Number(value || 0).toFixed(2)}`;
}

function toCentavos(value) {
  return Math.round(Number(value) * 100);
}

// Human-readable notes for the lifecycle outcomes the recording endpoint
// returns — skipped transitions and Pass exceptions are surfaced, never silent.
function lifecycleNotes(lifecycle) {
  if (!lifecycle) return [];
  const notes = [];
  if (lifecycle.passExceptions?.length) {
    notes.push(`${lifecycle.passExceptions.length} checked-in Pass(es) could not be auto-refunded and need manual resolution.`);
  }
  if (typeof lifecycle.returnRequest === 'string' && lifecycle.returnRequest.startsWith('skipped')) {
    notes.push(`Return status transition skipped (${lifecycle.returnRequest.replace('skipped:', 'current: ')}).`);
  }
  if (typeof lifecycle.shipment === 'string' && lifecycle.shipment.startsWith('skipped')) {
    notes.push(`Shipment transition skipped (${lifecycle.shipment.replace('skipped:', 'current: ')}).`);
  }
  return notes;
}

const AdminReturns = () => {
  const user = useAuthStore((state) => state.user);
  const canManageRefunds = hasPermission(user, PERMISSIONS.REFUNDS_MANAGE);

  const [returns, setReturns] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [inspecting, setInspecting] = useState(null); // full ReturnRequest being inspected
  const [conditions, setConditions] = useState({}); // returnItemId -> condition

  // Refund modal state
  const [refundModal, setRefundModal] = useState(null); // { returnRequest, refund, orderTotal, refunds }
  const [refundTab, setRefundTab] = useState('record'); // 'record' | 'adjust'
  const [recordForm, setRecordForm] = useState({ confirmed: false, externalAmount: '', providerReference: '', note: '' });
  const [adjustForm, setAdjustForm] = useState({ mode: 'recompute', amount: '', externalAmount: '', reason: '' });
  const [refundError, setRefundError] = useState(null);
  const [refundSuccess, setRefundSuccess] = useState(null);
  const [refundBusy, setRefundBusy] = useState(false);

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

  // Resolve THIS return's refund from the order's refund history by
  // `returnRequestId` — never `refunds[0]`, which may belong to another return.
  const resolveRefundFrom = (returnRequestId, refunds = []) =>
    refunds.find((f) => f.returnRequestId === returnRequestId) || null;

  const openRefund = async (returnRequest) => {
    try {
      const res = await returnService.getReturn(returnRequest._id);
      const all = res.data.refunds || [];
      const refund = resolveRefundFrom(returnRequest._id, all);
      if (!refund) {
        alert('No refund record found for this return yet.');
        return;
      }
      setRefundModal({ returnRequest, refund, orderTotal: res.data.order?.total ?? null, refunds: all });
      setRecordForm({ confirmed: false, externalAmount: String(refund.amount ?? ''), providerReference: '', note: '' });
      setAdjustForm({ mode: 'recompute', amount: '', externalAmount: '', reason: '' });
      setRefundTab('record');
      setRefundError(null);
      setRefundSuccess(null);
    } catch (error) {
      console.error('Failed to load return detail:', error);
      alert(error.response?.data?.message || 'Failed to load return detail');
    }
  };

  const refreshRefundModal = async () => {
    if (!refundModal) return;
    const res = await returnService.getReturn(refundModal.returnRequest._id);
    const all = res.data.refunds || [];
    const refund = resolveRefundFrom(refundModal.returnRequest._id, all);
    setRefundModal((m) => (m ? { ...m, refund, refunds: all, orderTotal: res.data.order?.total ?? m.orderTotal } : m));
  };

  const submitRecord = async () => {
    if (!refundModal) return;
    setRefundError(null);
    const refund = refundModal.refund;
    const amount = Number(recordForm.externalAmount);

    if (!recordForm.confirmed) {
      setRefundError('Please confirm this refund was already completed with the provider.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setRefundError('Enter the exact amount refunded externally.');
      return;
    }
    if (toCentavos(amount) !== toCentavos(refund.amount)) {
      setRefundError(`The external amount (${pesos(amount)}) must exactly match the current refund amount (${pesos(refund.amount)}). Adjust the refund first if the amount is wrong.`);
      return;
    }
    if (refund.status === 'failed' && !recordForm.note.trim()) {
      setRefundError('A note explaining the correction is required to record a refund that was previously marked failed.');
      return;
    }
    if (recordForm.providerReference.trim().length > MAX_PROVIDER_REFERENCE) {
      setRefundError(`Provider reference must be at most ${MAX_PROVIDER_REFERENCE} characters.`);
      return;
    }
    if (recordForm.note.trim().length > MAX_NOTE) {
      setRefundError(`Note must be at most ${MAX_NOTE} characters.`);
      return;
    }

    setRefundBusy(true);
    try {
      const res = await refundService.record(refund._id, {
        confirmCompleted: true,
        externalAmount: amount,
        providerReference: recordForm.providerReference.trim() || undefined,
        note: recordForm.note.trim() || undefined,
      });
      const updated = res.data || {};
      setRefundSuccess({ amount: updated.amount ?? amount, lifecycle: updated.lifecycle || null });
      await refreshRefundModal();
      fetchReturns(pagination.page);
    } catch (error) {
      setRefundError(error.response?.data?.message || 'Failed to record refund');
    } finally {
      setRefundBusy(false);
    }
  };

  const submitAdjust = async () => {
    if (!refundModal) return;
    setRefundError(null);
    setRefundSuccess(null);
    const reason = adjustForm.reason.trim();
    if (!reason) {
      setRefundError('A reason is required to adjust a refund amount.');
      return;
    }
    if (reason.length > MAX_NOTE) {
      setRefundError(`Reason must be at most ${MAX_NOTE} characters.`);
      return;
    }

    let body;
    if (adjustForm.mode === 'recompute') {
      body = { externalPayment: 'none', recompute: true, reason };
    } else if (adjustForm.mode === 'explicit') {
      const amount = Number(adjustForm.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        setRefundError('Enter a positive amount.');
        return;
      }
      body = { externalPayment: 'none', amount, reason };
    } else {
      const externalAmount = Number(adjustForm.externalAmount);
      if (!Number.isFinite(externalAmount) || externalAmount <= 0) {
        setRefundError('Enter the actual amount refunded externally.');
        return;
      }
      body = { externalPayment: 'already_sent', externalAmount, reason };
    }

    setRefundBusy(true);
    try {
      await refundService.adjust(refundModal.refund._id, body);
      await refreshRefundModal();
      setAdjustForm({ mode: 'recompute', amount: '', externalAmount: '', reason: '' });
      fetchReturns(pagination.page);
    } catch (error) {
      setRefundError(error.response?.data?.message || 'Failed to adjust refund');
    } finally {
      setRefundBusy(false);
    }
  };

  const closeRefund = () => {
    setRefundModal(null);
    setRefundError(null);
    setRefundSuccess(null);
  };

  const refund = refundModal?.refund;
  const currentReturnId = refundModal?.returnRequest?._id;
  // RETURN-SCOPED progress: only THIS return's succeeded refunds, measured
  // against this return's refund amount (its attributable value). The modal is
  // about one return, so mixing in an order-wide denominator would misreport
  // it — a different return's succeeded refund must never appear here.
  const returnSucceededTotal = (refundModal?.refunds || [])
    .filter((f) => f.returnRequestId === currentReturnId && f.status === 'succeeded')
    .reduce((sum, f) => sum + Number(f.amount || 0), 0);
  const returnRefundable = refund ? Number(refund.amount || 0) : null;
  const returnNotYetRefunded = toCentavos(returnSucceededTotal) === 0;
  const returnFullyRefunded = returnRefundable != null && toCentavos(returnSucceededTotal) >= toCentavos(returnRefundable);
  const canAdjust = refund && (refund.status === 'pending' || refund.status === 'failed');

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
                            canManageRefunds ? (
                              <button
                                onClick={() => openRefund(r)}
                                className="px-3 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700 whitespace-nowrap"
                              >
                                Record Refund
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">Refund pending</span>
                            )
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

      {refundModal && refund && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={closeRefund}>
          <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Refund — Order #{refundModal.returnRequest.order?.orderNumber}</h2>

            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${REFUND_STATUS_COLORS[refund.status] || 'bg-gray-100 text-gray-800'}`}>
                {REFUND_STATUS_LABELS[refund.status] || refund.status}
              </span>
              <span className="text-sm font-medium text-gray-900">{pesos(refund.amount)}</span>
            </div>
            {returnRefundable != null && (
              <p className="text-xs text-gray-500 mb-4" data-testid="refund-scope-banner">
                This return is{' '}
                {returnNotYetRefunded
                  ? `not yet refunded (${pesos(returnSucceededTotal)} of ${pesos(returnRefundable)})`
                  : returnFullyRefunded
                    ? `fully refunded (${pesos(returnSucceededTotal)} of ${pesos(returnRefundable)})`
                    : `partially refunded (${pesos(returnSucceededTotal)} of ${pesos(returnRefundable)})`}
              </p>
            )}

            {refundError && (
              <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{refundError}</p>
            )}
            {refundSuccess && (
              <div role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                <p>Refund of {pesos(refundSuccess.amount)} recorded as completed.</p>
                {lifecycleNotes(refundSuccess.lifecycle).length > 0 && (
                  <ul className="mt-1 list-disc list-inside text-amber-800">
                    {lifecycleNotes(refundSuccess.lifecycle).map((note) => (<li key={note}>{note}</li>))}
                  </ul>
                )}
              </div>
            )}

            {refund.status === 'succeeded' ? (
              <p className="text-sm text-gray-600">This refund is recorded as completed. Recorded refunds are immutable.</p>
            ) : (
              <>
                <div className="flex gap-1 border-b border-gray-200 mb-4">
                  <button
                    onClick={() => { setRefundTab('record'); setRefundError(null); }}
                    className={`px-3 py-2 text-sm font-medium border-b-2 ${refundTab === 'record' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  >
                    Record completion
                  </button>
                  {canAdjust && (
                    <button
                      onClick={() => { setRefundTab('adjust'); setRefundError(null); }}
                      className={`px-3 py-2 text-sm font-medium border-b-2 ${refundTab === 'adjust' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                      Adjust amount
                    </button>
                  )}
                </div>

                {refundTab === 'record' ? (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500">Recording confirms you already completed this refund with the provider. It does not send any money.</p>
                    <label className="flex items-start gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={recordForm.confirmed}
                        onChange={(e) => setRecordForm((f) => ({ ...f, confirmed: e.target.checked }))}
                      />
                      I confirm this refund was already completed externally with the provider.
                    </label>
                    <label className="block text-sm text-gray-700">
                      External amount ({pesos(refund.amount)})
                      <input
                        type="number"
                        step="0.01"
                        aria-label="External amount"
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        value={recordForm.externalAmount}
                        onChange={(e) => setRecordForm((f) => ({ ...f, externalAmount: e.target.value }))}
                      />
                    </label>
                    <label className="block text-sm text-gray-700">
                      Provider reference (optional)
                      <input
                        type="text"
                        aria-label="Provider reference"
                        maxLength={MAX_PROVIDER_REFERENCE}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        value={recordForm.providerReference}
                        onChange={(e) => setRecordForm((f) => ({ ...f, providerReference: e.target.value }))}
                      />
                    </label>
                    <label className="block text-sm text-gray-700">
                      {refund.status === 'failed' ? 'Note (required for corrections)' : 'Note (optional)'}
                      <textarea
                        aria-label="Note"
                        rows={2}
                        maxLength={MAX_NOTE}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        value={recordForm.note}
                        onChange={(e) => setRecordForm((f) => ({ ...f, note: e.target.value }))}
                      />
                    </label>
                    <div className="flex justify-end gap-3 pt-2">
                      <button onClick={closeRefund} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
                      <button
                        onClick={submitRecord}
                        disabled={refundBusy}
                        className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                      >
                        {refundBusy ? 'Saving…' : 'Record refund'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500">Adjusting only changes the recorded amount before payment; it does not initiate a refund, and it cannot exceed the refundable ceiling.</p>
                    <div className="space-y-2 text-sm text-gray-700">
                      <label className="flex items-center gap-2">
                        <input type="radio" name="adjust-mode" checked={adjustForm.mode === 'recompute'} onChange={() => setAdjustForm((f) => ({ ...f, mode: 'recompute' }))} />
                        Recompute from the return
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="radio" name="adjust-mode" checked={adjustForm.mode === 'explicit'} onChange={() => setAdjustForm((f) => ({ ...f, mode: 'explicit' }))} />
                        Set an explicit amount
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="radio" name="adjust-mode" checked={adjustForm.mode === 'already_sent'} onChange={() => setAdjustForm((f) => ({ ...f, mode: 'already_sent' }))} />
                        Reconcile an amount already sent
                      </label>
                    </div>
                    {adjustForm.mode === 'explicit' && (
                      <label className="block text-sm text-gray-700">
                        New amount
                        <input
                          type="number"
                          step="0.01"
                          aria-label="New amount"
                          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          value={adjustForm.amount}
                          onChange={(e) => setAdjustForm((f) => ({ ...f, amount: e.target.value }))}
                        />
                      </label>
                    )}
                    {adjustForm.mode === 'already_sent' && (
                      <label className="block text-sm text-gray-700">
                        Amount actually sent externally
                        <input
                          type="number"
                          step="0.01"
                          aria-label="Already-sent amount"
                          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          value={adjustForm.externalAmount}
                          onChange={(e) => setAdjustForm((f) => ({ ...f, externalAmount: e.target.value }))}
                        />
                      </label>
                    )}
                    {adjustForm.mode === 'already_sent' && (
                      <p className="text-xs text-amber-700">This reconciles to money that already left; it still cannot exceed the refundable ceiling.</p>
                    )}
                    <label className="block text-sm text-gray-700">
                      Reason (required)
                      <input
                        type="text"
                        aria-label="Reason"
                        maxLength={MAX_NOTE}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        value={adjustForm.reason}
                        onChange={(e) => setAdjustForm((f) => ({ ...f, reason: e.target.value }))}
                      />
                    </label>
                    <div className="flex justify-end gap-3 pt-2">
                      <button onClick={closeRefund} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
                      <button
                        onClick={submitAdjust}
                        disabled={refundBusy}
                        className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                      >
                        {refundBusy ? 'Saving…' : 'Apply adjustment'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReturns;
