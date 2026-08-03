import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Panel, Pagination, EmptyState, ErrorState } from '../../components/ui';
import accountService from '../../services/accountService';

const AccountNotifications = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page')) || 1;

  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState({ pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await accountService.getNotifications({ page, limit: 15 });
      setNotifications(res.data);
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

  const handleOpen = async (notification) => {
    if (!notification.read) {
      setNotifications((prev) =>
        prev.map((n) => (n._id === notification._id ? { ...n, read: true } : n))
      );
      accountService.markNotificationsRead([notification._id]).catch(() => {});
    }
    if (notification.link) navigate(notification.link);
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await accountService.markNotificationsRead().catch(() => {});
  };

  const hasUnread = notifications.some((n) => !n.read);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState description="Failed to load your notifications." onRetry={load} />;

  return (
    <div className="space-y-6">
      {notifications.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleMarkAllRead}
            disabled={!hasUnread}
            className="text-sm font-medium text-primary-600 hover:text-primary-700 disabled:text-gray-300 disabled:cursor-not-allowed"
          >
            Mark all read
          </button>
        </div>
      )}

      {notifications.length === 0 ? (
        <EmptyState title="No notifications yet" description="Updates about your orders will show up here." />
      ) : (
        <>
          <Panel padding="p-0">
            {notifications.map((n) => (
              <button
                key={n._id}
                onClick={() => handleOpen(n)}
                className="w-full text-left flex items-start gap-3 px-5 py-4 border-b border-gray-100 last:border-0 hover:bg-gray-50"
              >
                <span className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${n.read ? 'bg-transparent' : 'bg-primary-600'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${n.read ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>{n.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{n.body}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(n.createdAt).toLocaleString('en-PH')}
                  </p>
                </div>
              </button>
            ))}
          </Panel>

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
        </>
      )}
    </div>
  );
};

export default AccountNotifications;
