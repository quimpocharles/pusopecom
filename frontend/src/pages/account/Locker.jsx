import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShoppingBagIcon, TicketIcon } from '@heroicons/react/24/outline';
import { Pagination, EmptyState, ErrorState } from '../../components/ui';
import MerchandiseCard from '../../components/locker/MerchandiseCard';
import MerchandiseCardSkeleton from '../../components/locker/MerchandiseCardSkeleton';
import PassCard from '../../components/locker/PassCard';
import PassCardSkeleton from '../../components/locker/PassCardSkeleton';
import PassTicket from '../../components/locker/PassTicket';
import Modal from '../../components/ui/Modal';
import accountService from '../../services/accountService';
import passEventService from '../../services/passEventService';
import { ORDER_STATUS_LABELS, ORDER_STATUS_FILTER_OPTIONS } from '../../utils/orderStatus';

// The Locker is a consumer wallet with two sections — MY GEAR (merchandise)
// and PASSES (event tickets) — not a transaction history plus a wishlist.
// Only the active section fetches; switching is a URL param, not a route.
const SECTIONS = [
  { key: 'mine', label: 'My Gear', caption: 'Merch', subtitle: 'Your merchandise purchases', icon: ShoppingBagIcon },
  { key: 'passes', label: 'Passes', subtitle: 'Your event passes & tickets', icon: TicketIcon },
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
        {SECTIONS.map((s) => {
          const active = section === s.key;
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              aria-pressed={active}
              className={`flex items-center gap-4 p-5 border-2 bg-white text-left transition-colors duration-150 ${
                active ? 'border-ink-900' : 'border-ink-200 hover:border-ink-500'
              }`}
            >
              <span className={`flex-shrink-0 w-11 h-11 flex items-center justify-center border-2 ${
                active ? 'border-ink-900 text-ink-900' : 'border-ink-200 text-ink-500'
              }`}>
                <Icon className="w-5 h-5" />
              </span>
              <span className="min-w-0">
                <span className={`block text-editorial-label font-bold uppercase tracking-wide ${
                  active ? 'text-ink-900' : 'text-ink-500'
                }`}>
                  {s.label}{s.caption ? ` (${s.caption})` : ''}
                </span>
                <span className="block text-editorial-caption text-ink-500 mt-0.5">
                  {s.subtitle}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {section === 'mine' ? <LockerMine /> : <LockerPasses />}
    </div>
  );
};

// MY GEAR — merchandise wallet, not transaction history. Each card answers
// "what did I buy?" (line items, name-led) then "where is it?" (delivery),
// with order number/date/total/payment secondary. Pass orders are excluded
// here: /account/orders returns every order, but a Pass order has items: [],
// so filtering to orders with a real item keeps this merchandise-only
// without inventing a backend flag.
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
      // Merchandise-only: keep orders that have at least one item. A Pass
      // order has no OrderItems (its fulfillment unit is the Pass itself,
      // ADR-011) and lives in the Passes section instead.
      setOrders((res.data || []).filter((o) => (o.items?.length || 0) > 0));
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

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading your gear">
        {Array.from({ length: 3 }).map((_, i) => (
          <MerchandiseCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) return <ErrorState description="Failed to load your Gear." onRetry={load} />;

  if (orders.length === 0) {
    return (
      <EmptyState
        title="No merchandise orders yet."
        description="When you buy apparel or gear, it'll show up here with its delivery status."
        actionLabel="Shop Now"
        onAction={() => (window.location.href = '/products')}
      />
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
          <option value="">All Orders</option>
          {ORDER_STATUS_FILTER_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {orders.map((order) => (
          <MerchandiseCard key={order._id} order={order} />
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

// PASSES — a digital ticket wallet. Not an order list: the primary intent
// is "find my ticket and present it at the venue", so the QR is shown right
// in the card and one "View Ticket" tap opens the gate-optimised ticket
// with a large, scannable QR.
const LockerPasses = () => {
  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activePass, setActivePass] = useState(null);
  const activeTicketRef = useRef(null);

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

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6" aria-busy="true" aria-label="Loading your passes">
        {Array.from({ length: 3 }).map((_, i) => (
          <PassCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) return <ErrorState description="Failed to load your Passes." onRetry={load} />;

  if (passes.length === 0) {
    return (
      <EmptyState
        title="No passes yet."
        description="Buy a Pass to a game or event and your ticket will be ready here."
        actionLabel="Explore Events"
        onAction={() => (window.location.href = '/events')}
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {passes.map((pass) => (
          <PassCard key={pass._id} pass={pass} onViewTicket={setActivePass} />
        ))}
      </div>

      {/* Gate view — large, scannable QR, minimal chrome around it. */}
      <Modal open={!!activePass} onClose={() => setActivePass(null)} size="md">
        {activePass && (
          <div className="bg-paper p-4">
            <PassTicket pass={activePass} large ticketRef={activeTicketRef} orderNumber={activePass.order?.orderNumber} />
            <p className="text-center text-editorial-caption text-ink-500 mt-3">
              Present this QR at the venue entrance. Turn your screen brightness up.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
};

export default Locker;
