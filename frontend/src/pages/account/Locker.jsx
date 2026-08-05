import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ProductCard from '../../components/products/ProductCard';
import { Panel, Pagination, EmptyState, ErrorState } from '../../components/ui';
import accountService from '../../services/accountService';
import { ORDER_STATUS_LABELS, ORDER_STATUS_OPTIONS, orderStatusLabel } from '../../utils/orderStatus';

// docs/MY_PUSO_MANIFESTO.md: Locker is one destination — what's mine, plus
// a lighter Saved section for what a fan is thinking about adding — not a
// second top-level concept. Only the active section fetches; switching
// sections is a URL param, not a route, so both stay bookmarkable.
const SECTIONS = [
  { key: 'mine', label: 'My Gear' },
  { key: 'saved', label: 'Saved' },
];

const Locker = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const section = searchParams.get('section') === 'saved' ? 'saved' : 'mine';

  const setSection = (key) => {
    const next = new URLSearchParams(searchParams);
    if (key === 'mine') next.delete('section');
    else next.set('section', key);
    next.delete('page');
    setSearchParams(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              section === s.key ? 'bg-ink-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'mine' ? <LockerMine /> : <LockerSaved />}
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
          {ORDER_STATUS_OPTIONS.map((s) => (
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
                    className="w-14 h-14 rounded-lg object-cover bg-gray-100"
                  />
                ))}
                {order.items.length > 4 && (
                  <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-500">
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
                <p className="font-bold text-primary-600">₱{order.total?.toFixed(2)}</p>
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

export default Locker;
