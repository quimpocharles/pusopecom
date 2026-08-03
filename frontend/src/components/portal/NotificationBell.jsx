import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellIcon } from '@heroicons/react/24/outline';
import { Panel } from '../ui';
import accountService from '../../services/accountService';

// An overlay, never a page — docs/MY_PUSO_MANIFESTO.md and the IA pass
// built on it are explicit that notifications interrupt, they don't
// relocate. No pagination here on purpose: this is "what's new right now,"
// not a full archive — a fan who wants the full history isn't the case
// this component is for.
const PREVIEW_SIZE = 10;

const NotificationBell = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const panelRef = useRef(null);

  const refresh = async () => {
    try {
      const [listRes, unreadRes] = await Promise.all([
        accountService.getNotifications({ limit: PREVIEW_SIZE }),
        accountService.getNotifications({ limit: 1, read: false }),
      ]);
      setNotifications(listRes.data);
      setUnreadCount(unreadRes.pagination?.total || 0);
    } catch {
      // silent — the bell just stays at its last known state
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleOpenNotification = async (n) => {
    setOpen(false);
    if (!n.read) {
      setNotifications((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      accountService.markNotificationsRead([n._id]).catch(() => {});
    }
    if (n.link) navigate(n.link);
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    await accountService.markNotificationsRead().catch(() => {});
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      >
        <BellIcon className="w-5 h-5 text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary-600" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 z-50">
          <Panel padding="p-0" className="shadow-lg">
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">Notifications</p>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs font-medium text-primary-600 hover:text-primary-700"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {!loaded ? null : notifications.length === 0 ? (
                <p className="text-sm text-gray-500 px-4 py-6 text-center">You're all caught up.</p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n._id}
                    onClick={() => handleOpenNotification(n)}
                    className="w-full text-left flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50"
                  >
                    <span className={`w-1.5 h-1.5 mt-1.5 rounded-full flex-shrink-0 ${n.read ? 'bg-transparent' : 'bg-primary-600'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${n.read ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{n.body}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
