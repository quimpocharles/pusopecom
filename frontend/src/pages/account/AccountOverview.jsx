import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Panel, Badge, ErrorState } from '../../components/ui';
import accountService from '../../services/accountService';

const STAT_LABELS = [
  { key: 'orders', label: 'Orders' },
  { key: 'wishlist', label: 'Wishlist' },
  { key: 'tryOns', label: 'Try-Ons' },
  { key: 'organizations', label: 'Organizations' },
  { key: 'notifications', label: 'Unread' },
];

// The dashboard aggregation endpoint's whole reason for existing — one
// request instead of the account page firing five+ separate ones.
const AccountOverview = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await accountService.getDashboard();
      setData(res.data);
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
  if (error || !data) {
    return <ErrorState description="Failed to load your account overview." onRetry={load} />;
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {STAT_LABELS.map(({ key, label }) => (
          <Panel key={key} padding="p-4" className="text-center">
            <p className="text-2xl font-bold text-ink-900">{data.stats[key]}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </Panel>
        ))}
      </div>

      <Panel title="Recent Orders">
        {data.recentOrders.length === 0 ? (
          <p className="text-sm text-gray-500">No orders yet.</p>
        ) : (
          <div className="space-y-1">
            {data.recentOrders.map((order) => (
              <Link
                key={order._id}
                to={`/order/${order.orderNumber}`}
                className="flex justify-between items-center text-sm py-2 border-b border-gray-100 last:border-0 hover:text-primary-600"
              >
                <span className="font-medium">{order.orderNumber}</span>
                <span className="text-gray-500 capitalize">{order.orderStatus}</span>
                <span className="text-gray-900 font-semibold">₱{order.total?.toLocaleString()}</span>
              </Link>
            ))}
          </div>
        )}
        <Link to="/account/orders" className="text-sm font-medium text-primary-600 hover:text-primary-700 mt-4 inline-block">
          See all orders →
        </Link>
      </Panel>

      <Panel title="Recent Try-Ons">
        {data.recentTryOns.length === 0 ? (
          <p className="text-sm text-gray-500">No try-ons yet.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {data.recentTryOns.map((tryOn) => (
              <div key={tryOn._id} className="flex-shrink-0 w-24">
                <img
                  src={tryOn.productImage}
                  alt={tryOn.productName}
                  className="w-24 h-24 object-cover rounded-lg bg-gray-100"
                />
                <p className="text-xs text-gray-600 truncate mt-1">{tryOn.productName}</p>
              </div>
            ))}
          </div>
        )}
        <Link to="/account/try-ons" className="text-sm font-medium text-primary-600 hover:text-primary-700 mt-4 inline-block">
          See all try-ons →
        </Link>
      </Panel>

      <Panel title="Notifications">
        {data.notifications.length === 0 ? (
          <p className="text-sm text-gray-500">No notifications yet.</p>
        ) : (
          <div className="space-y-1">
            {data.notifications.map((n) => (
              <div key={n._id} className="flex justify-between items-start gap-3 text-sm py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className={n.read ? 'text-gray-700' : 'font-semibold text-gray-900'}>{n.title}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{n.body}</p>
                </div>
                {!n.read && <Badge tone="accent">New</Badge>}
              </div>
            ))}
          </div>
        )}
        <Link to="/account/notifications" className="text-sm font-medium text-primary-600 hover:text-primary-700 mt-4 inline-block">
          See all notifications →
        </Link>
      </Panel>

      {data.organizations.length > 0 && (
        <Panel title="Organizations You've Shopped From">
          <div className="flex flex-wrap gap-2">
            {data.organizations.map((org) => (
              <Badge key={org._id} tone="secondary">{org.name}</Badge>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
};

export default AccountOverview;
