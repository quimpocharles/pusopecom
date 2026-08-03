import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Panel, Pagination, EmptyState, ErrorState } from '../../components/ui';
import accountService from '../../services/accountService';

const STATUS_OPTIONS = ['processing', 'confirmed', 'shipped', 'delivered', 'cancelled'];

const AccountOrders = () => {
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

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <select
          value={status}
          onChange={(e) => updateParams({ status: e.target.value, page: null })}
          className="input-field w-auto"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorState description="Failed to load your orders." onRetry={load} />
      ) : orders.length === 0 ? (
        <EmptyState title="No orders found" actionLabel="Start Shopping" onAction={() => (window.location.href = '/products')} />
      ) : (
        <>
          <div className="space-y-4">
            {orders.map((order) => (
              <Panel key={order._id}>
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
                    <p className="font-semibold capitalize">{order.orderStatus}</p>
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
        </>
      )}
    </div>
  );
};

export default AccountOrders;
