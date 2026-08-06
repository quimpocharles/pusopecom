import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import orderService from '../../services/orderService';
import shipmentService from '../../services/shipmentService';
import authService from '../../services/authService';
import { ORDER_STATUS_COLORS, orderStatusLabel } from '../../utils/orderStatus';
import { SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_COLORS, shipmentStatusLabel } from '../../utils/shipmentStatus';

const statusColors = ORDER_STATUS_COLORS;

const paymentColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-800',
};

const COURIERS = ['LBC', 'J&T Express', 'Ninja Van', 'Flash Express', 'GoGo Xpress', '2GO', 'GrabExpress', 'Lalamove', 'DHL Express', 'FedEx'];

// Every legal Shipment status an operator can jump to from this page — the
// server's adjacency map (shipmentRepository.SHIPMENT_TRANSITIONS) is the
// real guard; this dropdown just offers the full vocabulary and surfaces a
// 400 if the jump isn't actually legal from the shipment's current stage.
const SHIPMENT_STATUS_OPTIONS = Object.keys(SHIPMENT_STATUS_LABELS).filter((s) => s !== 'cancelled');

// Dot color per event type — payment outcomes get semantic color, everything
// else (creation, admin edits, webhook pings) stays neutral so the eye is
// drawn to what actually changed money/stock state. Shipment events reuse
// the same visual language, keyed by fromStatus/toStatus instead of a type.
const eventDotColors = {
  created: 'bg-gray-400',
  payment_pending: 'bg-yellow-400',
  payment_succeeded: 'bg-green-500',
  payment_failed: 'bg-red-500',
  payment_expired: 'bg-red-400',
  status_updated: 'bg-blue-500',
  webhook_received: 'bg-gray-300',
  status_changed: 'bg-blue-500',
  assigned: 'bg-purple-400',
  note_added: 'bg-gray-300',
};

const actorLabels = {
  system: 'System',
  webhook: 'Gateway webhook',
  customer: 'Customer',
  admin: 'Admin',
};

function actorLabel(event) {
  if (event.actor === 'admin' && event.actorUser) {
    return `${event.actorUser.firstName} ${event.actorUser.lastName}`.trim() || 'Admin';
  }
  return actorLabels[event.actor] || event.actor;
}

const AdminOrderDetail = () => {
  const { orderNumber } = useParams();
  const [order, setOrder] = useState(null);
  const [events, setEvents] = useState([]);
  const [shipment, setShipment] = useState(null);
  const [shipmentEvents, setShipmentEvents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [statusDraft, setStatusDraft] = useState('');
  const [courierDraft, setCourierDraft] = useState('');
  const [trackingDraft, setTrackingDraft] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [actionError, setActionError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [orderRes, eventsRes] = await Promise.all([
        orderService.getOrderByNumber(orderNumber),
        orderService.getOrderEvents(orderNumber),
      ]);
      setOrder(orderRes.data);
      setEvents(eventsRes.data);
      setCourierDraft(orderRes.data.courier || '');
      setTrackingDraft(orderRes.data.trackingNumber || '');

      try {
        const shipmentRes = await shipmentService.getShipmentByOrder(orderRes.data._id);
        setShipment(shipmentRes.data);
        setStatusDraft(shipmentRes.data.status);
        const shipmentEventsRes = await shipmentService.getShipmentEvents(shipmentRes.data._id);
        setShipmentEvents(shipmentEventsRes.data);
      } catch {
        // No Shipment yet — order hasn't been paid, or creation is still
        // in flight (it's fire-and-forget on the backend). Not an error.
        setShipment(null);
        setShipmentEvents([]);
      }
    } catch (err) {
      setError('Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderNumber]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    authService.getAdminUsers({ role: 'admin', limit: 100 })
      .then((res) => setStaff(res.data))
      .catch(() => {});
  }, []);

  const handleSaveStatus = async () => {
    if (!shipment) return;
    setSavingStatus(true);
    setActionError('');
    try {
      await shipmentService.transitionStatus(shipment._id, {
        status: statusDraft,
        courier: courierDraft,
        trackingNumber: trackingDraft,
      });
      await fetchData();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to update shipment status');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleAssign = async (userId) => {
    if (!shipment) return;
    try {
      await shipmentService.assign(shipment._id, userId || null);
      await fetchData();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to assign shipment');
    }
  };

  const handleAddNote = async () => {
    if (!shipment || !noteDraft.trim()) return;
    setSavingNote(true);
    try {
      await shipmentService.addNote(shipment._id, noteDraft.trim());
      setNoteDraft('');
      await fetchData();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to add note');
    } finally {
      setSavingNote(false);
    }
  };

  // The Fulfillment Audit's #1 finding, fixed structurally — this is the
  // ONLY control in the entire admin UI that can cancel a paid order, and
  // it always goes through the route that releases stock and creates a
  // Refund atomically. There is deliberately no other cancel button
  // anywhere (see routes/orders.js's own VALID_ORDER_STATUSES, which no
  // longer accepts 'cancelled' at all).
  const handleCancel = async () => {
    if (!shipment) return;
    setCancelling(true);
    setActionError('');
    try {
      await shipmentService.cancel(shipment._id, cancelReason.trim() || undefined);
      setShowCancelForm(false);
      setCancelReason('');
      await fetchData();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !order) {
    return <div className="text-center py-16 text-sm text-gray-500">{error || 'Order not found'}</div>;
  }

  const isPickup = order.shippingMethod === 'venue_pickup';

  // Merge Order's payment-side audit trail with Shipment's fulfillment-side
  // one into a single chronological timeline — the two tables are separate
  // for real architectural reasons (see the schema comment on Shipment),
  // but an operator reading "everything that happened to this order"
  // shouldn't have to look in two places for it.
  const timeline = [
    ...events.map((e) => ({ ...e, _source: 'order' })),
    ...shipmentEvents.map((e) => ({ ...e, _source: 'shipment' })),
  ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const canCancel = shipment && !['cancelled', 'refunded', 'delivered', 'completed'].includes(shipment.status);

  return (
    <div>
      <Link to="/admin/orders" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeftIcon className="w-4 h-4" />
        Back to Orders
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
          <p className="text-sm text-gray-500">Placed {new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${paymentColors[order.paymentStatus]}`}>
            {order.paymentStatus}
          </span>
          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[order.orderStatus]}`}>
            {orderStatusLabel(order.orderStatus)}
          </span>
          {shipment && (
            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${SHIPMENT_STATUS_COLORS[shipment.status] || 'bg-gray-100 text-gray-800'}`}>
              {shipmentStatusLabel(shipment.status)}
            </span>
          )}
        </div>
      </div>

      {actionError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{actionError}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — everything an operator acts on */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Items</h2>
            <div className="divide-y divide-gray-100">
              {order.items.map((item) => (
                <div key={item._id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <img src={item.image} alt={item.name} className="w-14 h-14 rounded-lg object-cover border border-gray-100" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.color && `${item.color} · `}Size {item.size} · Qty {item.quantity}</p>
                  </div>
                  <p className="text-sm font-medium text-gray-900">₱{(item.price * item.quantity).toLocaleString()}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 mt-4 pt-4 space-y-1 text-sm">
              <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>₱{order.subtotal?.toLocaleString()}</span></div>
              <div className="flex justify-between text-gray-500"><span>Shipping</span><span>₱{order.shippingFee?.toLocaleString()}</span></div>
              <div className="flex justify-between text-gray-900 font-semibold pt-1"><span>Total</span><span>₱{order.total?.toLocaleString()}</span></div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Customer &amp; Shipping</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Customer</dt>
                <dd className="text-gray-900">{order.user ? `${order.user.firstName} ${order.user.lastName}` : order.email}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Email</dt>
                <dd className="text-gray-900">{order.user ? order.user.email : order.email}</dd>
              </div>
              {isPickup ? (
                <div className="col-span-2">
                  <dt className="text-gray-500">Fulfillment</dt>
                  <dd className="text-gray-900">Venue Pick-Up</dd>
                </div>
              ) : (
                <>
                  <div>
                    <dt className="text-gray-500">Recipient</dt>
                    <dd className="text-gray-900">{order.shippingAddress?.fullName}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Phone</dt>
                    <dd className="text-gray-900">{order.shippingAddress?.phone}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-gray-500">Address</dt>
                    <dd className="text-gray-900">{order.shippingAddress?.address}, {order.shippingAddress?.city}, {order.shippingAddress?.province} {order.shippingAddress?.zipCode}</dd>
                  </div>
                </>
              )}
              {/* Customer's own checkout instructions — captured since day
                  one, previously never rendered anywhere in this admin UI
                  (Fulfillment Audit finding). */}
              {order.notes && (
                <div className="col-span-2">
                  <dt className="text-gray-500">Customer Notes</dt>
                  <dd className="text-gray-900">{order.notes}</dd>
                </div>
              )}
            </dl>
          </div>

          {shipment ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Fulfillment</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <select
                    value={statusDraft}
                    onChange={(e) => setStatusDraft(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    {SHIPMENT_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{SHIPMENT_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                {!isPickup && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Courier</label>
                      <select
                        value={courierDraft}
                        onChange={(e) => setCourierDraft(e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                      >
                        <option value="">Select courier</option>
                        {COURIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Tracking #</label>
                      <input
                        type="text"
                        value={trackingDraft}
                        onChange={(e) => setTrackingDraft(e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={handleSaveStatus}
                disabled={savingStatus}
                className="px-4 py-1.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
              >
                {savingStatus ? 'Saving…' : 'Save'}
              </button>

              <div className="border-t border-gray-100 mt-4 pt-4">
                <label className="block text-xs font-medium text-gray-500 mb-1">Assigned To</label>
                <select
                  value={shipment.assignedToUserId || ''}
                  onChange={(e) => handleAssign(e.target.value)}
                  className="px-2 py-1.5 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">Unassigned</option>
                  {staff.map((s) => <option key={s._id} value={s._id}>{s.firstName} {s.lastName}</option>)}
                </select>
              </div>

              {canCancel && (
                <div className="border-t border-gray-100 mt-4 pt-4">
                  {showCancelForm ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Reason for cancellation (optional)"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleCancel}
                          disabled={cancelling}
                          className="px-3 py-1.5 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50"
                        >
                          {cancelling ? 'Cancelling…' : 'Confirm Cancellation'}
                        </button>
                        <button onClick={() => setShowCancelForm(false)} className="px-3 py-1.5 border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50">
                          Back
                        </button>
                      </div>
                      <p className="text-xs text-gray-500">Releases reserved stock and creates a pending refund — atomically, not a bare status change.</p>
                    </div>
                  ) : (
                    <button onClick={() => setShowCancelForm(true)} className="text-xs text-red-600 hover:text-red-800 font-medium">
                      Cancel Order
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-sm text-gray-500">
              No fulfillment record yet — this order hasn't been paid for.
            </div>
          )}

          {shipment && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Internal Notes</h2>
              <div className="space-y-3 mb-4">
                {shipmentEvents.filter((e) => e.type === 'note_added').length === 0 ? (
                  <p className="text-sm text-gray-400">No notes yet.</p>
                ) : (
                  shipmentEvents.filter((e) => e.type === 'note_added').map((note) => (
                    <div key={note._id} className="text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-gray-900">{note.message}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{actorLabel(note)} · {new Date(note.createdAt).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a note for the team…"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <button
                  onClick={handleAddNote}
                  disabled={savingNote || !noteDraft.trim()}
                  className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs hover:bg-gray-800 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right column — the merged Order + Shipment audit trail */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 h-fit">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Timeline</h2>
          {timeline.length === 0 ? (
            <p className="text-sm text-gray-500">No history recorded for this order.</p>
          ) : (
            <ul className="space-y-0">
              {timeline.map((event, i) => (
                <li key={`${event._source}-${event._id}`} className="relative pl-6 pb-5 last:pb-0">
                  {i !== timeline.length - 1 && <span className="absolute left-[5px] top-3 bottom-0 w-px bg-gray-200" />}
                  <span className={`absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full ${eventDotColors[event.type] || 'bg-gray-300'}`} />
                  <p className="text-sm text-gray-900">{event.message}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{actorLabel(event)} · {new Date(event.createdAt).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminOrderDetail;
