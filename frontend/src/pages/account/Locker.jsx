import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ProductCard from '../../components/products/ProductCard';
import { Panel, Pagination, EmptyState, ErrorState } from '../../components/ui';
import accountService from '../../services/accountService';
import passEventService from '../../services/passEventService';
import { ORDER_STATUS_LABELS, ORDER_STATUS_FILTER_OPTIONS, orderStatusLabel } from '../../utils/orderStatus';

// docs/MY_PUSO_MANIFESTO.md: Locker is one destination — what's mine, plus
// a lighter Saved section for what a fan is thinking about adding — not a
// second top-level concept. Passes is a peer of My Gear, not folded into
// it: an Order-centric list and a Pass-credential-centric list (each with
// its own scannable status) are genuinely different shapes to browse, the
// same way Pass itself isn't forced into OrderItem/Shipment's shape on the
// backend (see the schema comment on the Pass model, ADR-011). Only the
// active section fetches; switching sections is a URL param, not a route,
// so all three stay bookmarkable.
const SECTIONS = [
  { key: 'mine', label: 'My Gear' },
  { key: 'passes', label: 'Passes' },
  { key: 'saved', label: 'Saved' },
];

const Locker = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSection = searchParams.get('section');
  const section = SECTIONS.some((s) => s.key === rawSection) ? rawSection : 'mine';

  const setSection = (key) => {
    const next = new URLSearchParams(searchParams);
    if (key === 'mine') next.delete('section');
    else next.set('section', key);
    next.delete('page');
    setSearchParams(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6 border-b-2 border-ink-200">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={`pb-3 text-editorial-label font-semibold uppercase tracking-wide whitespace-nowrap transition-colors duration-150 border-b-2 -mb-0.5 ${
              section === s.key
                ? 'text-ink-900 border-ink-900'
                : 'text-ink-500 border-transparent hover:text-ink-900'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'mine' ? <LockerMine /> : section === 'passes' ? <LockerPasses /> : <LockerSaved />}
    </div>
  );
};

const LockerMine = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page')) || 1;
  const status = searchParams.get('status') || '';

  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await accountService.getOrders({ page, limit: 10, ...(status && { status }) });
      setOrders(res.data);
      setPagination(res.pagination);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  const updateParams = (updates) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    setSearchParams(next);
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState description="Failed to load your Locker." onRetry={load} />;
  if (orders.length === 0) {
    return (
      <EmptyState title="Your Locker is empty" actionLabel="Start Shopping" onAction={() => (window.location.href = '/products')} />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <select
          value={status}
          onChange={(e) => updateParams({ status: e.target.value, page: null })}
          className="input-field w-auto"
        >
          <option value="">All Statuses</option>
          {ORDER_STATUS_FILTER_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {orders.map((order) => (
          <Panel key={order._id}>
            {/* Fans remember products, not order numbers — thumbnails lead. */}
            {order.items?.length > 0 && (
              <div className="flex gap-2 mb-4">
                {order.items.slice(0, 4).map((item, i) => (
                  <img
                    key={i}
                    src={item.image}
                    alt=""
                    className="w-14 h-14 object-cover bg-ink-200 border border-ink-200"
                  />
                ))}
                {order.items.length > 4 && (
                  <div className="w-14 h-14 bg-paper border border-ink-200 flex items-center justify-center text-xs font-medium text-ink-500">
                    +{order.items.length - 4}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm text-gray-600">Order Number</p>
                <p className="font-bold text-lg">{order.orderNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Order Date</p>
                <p className="font-semibold">{new Date(order.createdAt).toLocaleDateString('en-PH')}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Payment Status</p>
                <p className={`font-semibold capitalize ${order.paymentStatus === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                  {order.paymentStatus}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Order Status</p>
                <p className="font-semibold">{orderStatusLabel(order.orderStatus)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="font-bold text-ink-900">₱{order.total?.toFixed(2)}</p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <p className="text-sm text-gray-600">
                {order.items?.length || 0} item{order.items?.length === 1 ? '' : 's'}
              </p>
              <Link to={`/order/${order.orderNumber}`} className="text-primary-600 hover:text-primary-700 font-semibold">
                View Details →
              </Link>
            </div>
          </Panel>
        ))}
      </div>

      <Pagination
        page={page}
        totalPages={pagination.pages || 0}
        onPageChange={(p) => updateParams({ page: String(p) })}
        className="mt-8"
      />
    </div>
  );
};

// The remove button is a sibling of ProductCard, not a child — ProductCard
// is itself a full-card <Link>, so a button nested inside it would be an
// interactive element inside an interactive element.
const LockerSaved = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page')) || 1;

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await accountService.getWishlist({ page, limit: 12 });
      setItems(res.data);
      setPagination(res.pagination);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleRemove = async (productId) => {
    setRemovingId(productId);
    try {
      await accountService.removeWishlistItem(productId);
      setItems((prev) => prev.filter((item) => item.product._id !== productId));
    } catch {
      // leave the item in place — the user can retry the remove action
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState description="Failed to load Saved." onRetry={load} />;
  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing saved yet"
        description="Save products you're interested in to find them here later."
        actionLabel="Browse Products"
        onAction={() => (window.location.href = '/products')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
        {items.map((item) => (
          <div key={item._id} className="relative">
            <ProductCard product={item.product} />
            <button
              onClick={() => handleRemove(item.product._id)}
              disabled={removingId === item.product._id}
              className="absolute top-2 right-2 z-20 bg-white/90 hover:bg-white rounded-full p-1.5 shadow disabled:opacity-50"
              aria-label={`Remove ${item.product.name} from Saved`}
            >
              <XMarkIcon className="w-4 h-4 text-ink-900" />
            </button>
          </div>
        ))}
      </div>

      <Pagination
        page={page}
        totalPages={pagination.pages || 0}
        onPageChange={(p) => {
          const next = new URLSearchParams(searchParams);
          next.set('page', String(p));
          setSearchParams(next);
        }}
        className="mt-8"
      />
    </div>
  );
};

const PASS_STATUS_STYLES = {
  issued: 'text-green-600',
  checked_in: 'text-blue-600',
  cancelled: 'text-gray-400',
  refunded: 'text-gray-400',
};

const PASS_STATUS_LABELS = {
  issued: 'Ready',
  checked_in: 'Checked In',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

// The QR code image itself is a Stage 4 (check-in tool) concern — this
// shows the same qrToken as a plain, copyable code for now, same
// information, no new dependency added before the scanning side that
// would actually need one exists.
const LockerPasses = () => {
  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await passEventService.getMyPasses();
      setPasses(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState description="Failed to load your Passes." onRetry={load} />;
  if (passes.length === 0) {
    return (
      <EmptyState
        title="No Passes yet"
        description="Buy a Pass to a game or event to see it here."
        actionLabel="Browse Events"
        onAction={() => (window.location.href = '/events')}
      />
    );
  }

  return (
    <div className="space-y-4">
      {passes.map((pass) => (
        <Panel key={pass._id}>
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="font-bold text-lg">{pass.passEvent?.name}</p>
              <p className="text-sm text-gray-600">
                {pass.passEvent?.venue?.name} · {pass.passEvent?.startsAt && new Date(pass.passEvent.startsAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>
            <span className={`font-semibold text-sm ${PASS_STATUS_STYLES[pass.status] || 'text-gray-500'}`}>
              {PASS_STATUS_LABELS[pass.status] || pass.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
            <div>
              <p className="text-gray-600">Tier</p>
              <p className="font-semibold">{pass.passTier?.name}</p>
            </div>
            {pass.passEventSeat?.seat && (
              <div>
                <p className="text-gray-600">Seat</p>
                <p className="font-semibold">{pass.passEventSeat.seat.label}</p>
              </div>
            )}
          </div>

          {pass.status === 'issued' && (
            <div className="pt-4 border-t">
              <p className="text-xs text-gray-500 mb-1">Show this code at the gate</p>
              <p className="font-mono text-sm bg-paper border border-ink-200 px-3 py-2 break-all">{pass.qrToken}</p>
            </div>
          )}
        </Panel>
      ))}
    </div>
  );
};

export default Locker;
