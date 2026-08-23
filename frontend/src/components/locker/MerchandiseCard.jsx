import { Link } from 'react-router-dom';
import { ArrowRightIcon, TruckIcon } from '@heroicons/react/24/outline';
import DeliveryProgress from './DeliveryProgress';
import CompletePaymentButton from '../orders/CompletePaymentButton';
import { orderStatusLabel } from '../../utils/orderStatus';

// A single Merchandise order, presented as "what did I buy / where is it?"
// — product-first, transaction data secondary. The order is the unit, but
// the fan recognizes it by its items, so each line item leads with its own
// image/name/variant/quantity, and the order metadata (number, date, total,
// payment status) is collapsed to a secondary info strip. Passes never reach
// this card — Locker.jsx already filters /account/orders down to orders that
// have items (a Pass order carries items: [] and lives in Passes instead).
const MerchandiseCard = ({ order }) => {
  const items = order.items || [];
  const canPay = order.paymentStatus !== 'paid' && order.orderStatus !== 'cancelled';
  const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '';

  return (
    <div className="card overflow-hidden">
      {/* Product-first header strip — the fan's recognition anchor. */}
      <div className="divide-y divide-ink-200">
        {items.map((item, idx) => (
          <div key={item._id || idx} className="flex items-center gap-4 p-4">
            {item.image ? (
              <img
                src={item.image}
                alt={item.name}
                className="w-16 h-16 object-cover bg-ink-200/40 border border-ink-200 flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 bg-ink-200/40 border border-ink-200 flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-editorial-body font-semibold text-ink-900 truncate">{item.name}</p>
              <p className="text-editorial-caption text-ink-500 mt-0.5">
                {item.size && <span>Size {item.size}</span>}
                {item.size && item.color && <span> · </span>}
                {item.color && <span>{item.color}</span>}
                {!item.size && !item.color && 'One size'}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-semibold text-ink-900">×{item.quantity}</p>
              <p className="text-editorial-caption text-ink-500">₱{item.price?.toFixed(2)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Delivery answer — where is it? This is the second thing a fan
          wants, after "what did I buy". */}
      <div className="border-t-2 border-ink-900 p-4">
        <p className="text-editorial-label font-bold text-ink-900 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <TruckIcon className="w-4 h-4" />
          {orderStatusLabel(order.orderStatus) === 'Delivered' ? 'Delivered' : 'Delivery'}
        </p>
        <DeliveryProgress orderStatus={order.orderStatus} />

        {/* Tracking — only ever when it actually exists. No invented
            courier or tracking number. */}
        {order.courier && order.trackingNumber && (
          <div className="mt-4 flex items-start justify-between gap-3 text-sm">
            <div>
              <p className="text-editorial-caption text-ink-500">{order.courier}</p>
              <p className="font-mono text-ink-900">{order.trackingNumber}</p>
            </div>
            <Link
              to={`/order/${order.orderNumber}`}
              className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 font-semibold whitespace-nowrap"
            >
              Track Package
              <ArrowRightIcon className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>

      {/* Secondary info strip — order number, date, total, payment status.
          Present but deliberately not the headline. */}
      <div className="border-t border-ink-200 p-4 flex flex-wrap items-center justify-between gap-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-500">
          <span className="text-editorial-caption font-medium">{order.orderNumber}</span>
          {orderDate && <span className="text-editorial-caption">{orderDate}</span>}
          <span className="font-semibold text-ink-900">₱{order.total?.toFixed(2)}</span>
          {order.paymentStatus === 'paid' ? (
            <span className="text-editorial-caption font-medium text-green-700">Paid</span>
          ) : order.paymentStatus === 'pending' ? (
            <span className="text-editorial-caption font-medium text-amber-600">Pending</span>
          ) : (
            <span className="text-editorial-caption font-medium text-rose-600 capitalize">{order.paymentStatus}</span>
          )}
        </div>

        <Link
          to={`/order/${order.orderNumber}`}
          className="inline-flex items-center gap-1 text-ink-900 hover:text-ink-700 font-semibold"
        >
          View Details
          <ArrowRightIcon className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Unpaid / failed / expired — make the recovery action explicit, the
          same "complete your payment" path the confirmation page uses. */}
      {canPay && (
        <div className="p-4 pt-0">
          <CompletePaymentButton orderNumber={order.orderNumber} payment={order.payment} />
        </div>
      )}
    </div>
  );
};

export default MerchandiseCard;
