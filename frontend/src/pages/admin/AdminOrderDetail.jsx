import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import orderService from '../../services/orderService';
import { ORDER_STATUS_COLORS, orderStatusLabel } from '../../utils/orderStatus';

const statusColors = ORDER_STATUS_COLORS;

const paymentColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-800',
};

// Dot color per event type — payment outcomes get semantic color, everything
// else (creation, admin edits, webhook pings) stays neutral so the eye is
// drawn to what actually changed money/stock state.
const eventDotColors = {
  created: 'bg-gray-400',
  payment_pending: 'bg-yellow-400',
  payment_succeeded: 'bg-green-500',
  payment_failed: 'bg-red-500',
  payment_expired: 'bg-red-400',
  status_updated: 'bg-blue-500',
  webhook_received: 'bg-gray-300',
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [orderRes, eventsRes] = await Promise.all([
        orderService.getOrderByNumber(orderNumber),
        orderService.getOrderEvents(orderNumber),
      ]);
      setOrder(orderRes.data);
      setEvents(eventsRes.data);
    } catch (err) {
      setError('Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="text-center py-16 text-sm text-gray-500">
        {error || 'Order not found'}
      </div>
    );
  }

  const isPickup = order.shippingMethod === 'venue_pickup';

  return (
    <div>
      <Link
        to="/admin/orders"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Back to Orders
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
          <p className="text-sm text-gray-500">
            Placed {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${paymentColors[order.paymentStatus]}`}>
            {order.paymentStatus}
          </span>
          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[order.orderStatus]}`}>
            {orderStatusLabel(order.orderStatus)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — order summary */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Items</h2>
            <div className="divide-y divide-gray-100">
              {order.items.map((item) => (
                <div key={item._id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-14 h-14 rounded-lg object-cover border border-gray-100"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.color && `${item.color} · `}Size {item.size} · Qty {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-gray-900">
                    ₱{(item.price * item.quantity).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 mt-4 pt-4 space-y-1 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>₱{order.subtotal?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Shipping</span>
                <span>₱{order.shippingFee?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-900 font-semibold pt-1">
                <span>Total</span>
                <span>₱{order.total?.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Customer & Shipping</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Customer</dt>
                <dd className="text-gray-900">
                  {order.user ? `${order.user.firstName} ${order.user.lastName}` : order.email}
                </dd>
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
                    <dd className="text-gray-900">
                      {order.shippingAddress?.address}, {order.shippingAddress?.city}, {order.shippingAddress?.province} {order.shippingAddress?.zipCode}
                    </dd>
                  </div>
                  {(order.courier || order.trackingNumber) && (
                    <div className="col-span-2">
                      <dt className="text-gray-500">Courier</dt>
                      <dd className="text-gray-900">
                        {order.courier || '—'}{order.trackingNumber && ` · ${order.trackingNumber}`}
                      </dd>
                    </div>
                  )}
                </>
              )}
            </dl>
          </div>
        </div>

        {/* Right column — Admin Order Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 h-fit">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Order Timeline</h2>
          {events.length === 0 ? (
            <p className="text-sm text-gray-500">No history recorded for this order.</p>
          ) : (
            <ul className="space-y-0">
              {events.map((event, i) => (
                <li key={event._id} className="relative pl-6 pb-5 last:pb-0">
                  {i !== events.length - 1 && (
                    <span className="absolute left-[5px] top-3 bottom-0 w-px bg-gray-200" />
                  )}
                  <span
                    className={`absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full ${eventDotColors[event.type] || 'bg-gray-300'}`}
                  />
                  <p className="text-sm text-gray-900">{event.message}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {actorLabel(event)} · {new Date(event.createdAt).toLocaleString()}
                  </p>
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
