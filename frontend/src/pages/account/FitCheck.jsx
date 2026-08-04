import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Modal, Pagination, EmptyState, ErrorState } from '../../components/ui';
import FitCheckCard from '../../components/portal/FitCheckCard';
import BeforeAfterSlider from '../../components/home/BeforeAfterSlider';
import accountService from '../../services/accountService';

// Real, queryable filters only — "Recent" would behave identically to "All"
// (both sort createdAt desc, and there's no separate recency window in the
// API), so it isn't rendered as its own chip; that would just be two
// identical-looking options next to each other. "Archived" is shown
// disabled per the spec's own "future" framing. "Deleted" is intentionally
// absent — that's an admin-only backend capability, never customer-facing.
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'favorited', label: 'Favorites' },
  { key: 'purchased', label: 'Purchased' },
];

const FitCheck = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page')) || 1;
  const filter = searchParams.get('filter') || 'all';

  const [tryOns, setTryOns] = useState([]);
  const [pagination, setPagination] = useState({ pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [compareTarget, setCompareTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const params = { page, limit: 12 };
      if (filter === 'favorited') params.favorited = true;
      if (filter === 'purchased') params.purchased = true;
      const res = await accountService.getTryOns(params);
      setTryOns(res.data);
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
  }, [page, filter]);

  const setFilter = (key) => {
    const next = new URLSearchParams(searchParams);
    if (key === 'all') next.delete('filter');
    else next.set('filter', key);
    next.delete('page');
    setSearchParams(next);
  };

  const handleFavoriteToggle = async (id, next) => {
    setTryOns((prev) => prev.map((t) => (t._id === id ? { ...t, favorited: next } : t)));
    try {
      await accountService.setTryOnFavorite(id, next);
    } catch {
      setTryOns((prev) => prev.map((t) => (t._id === id ? { ...t, favorited: !next } : t))); // revert on failure
    }
  };

  const handleDelete = async (id) => {
    const previous = tryOns;
    setTryOns((prev) => prev.filter((t) => t._id !== id)); // gone from the gallery immediately — soft delete on the backend
    try {
      await accountService.deleteTryOn(id);
    } catch {
      setTryOns(previous); // restore if the delete itself failed
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState description="Failed to load your Fit Checks." onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f.key ? 'bg-ink-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span
          className="px-4 py-1.5 rounded-full text-sm font-medium bg-gray-50 text-gray-300 cursor-not-allowed"
          title="Coming soon"
        >
          Archived
        </span>
      </div>

      {tryOns.length === 0 ? (
        <EmptyState
          title={filter === 'all' ? 'No Fit Checks yet' : 'Nothing here yet'}
          description={
            filter === 'all'
              ? 'Use Fit Check on any eligible product to see your results here.'
              : 'Try a different filter, or come back after your next Fit Check.'
          }
          actionLabel={filter === 'all' ? 'Browse Products' : undefined}
          onAction={filter === 'all' ? () => (window.location.href = '/products') : undefined}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {tryOns.map((tryOn) => (
              <FitCheckCard
                key={tryOn._id}
                tryOn={tryOn}
                onFavoriteToggle={handleFavoriteToggle}
                onDelete={handleDelete}
                onCompare={setCompareTarget}
              />
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
        </>
      )}

      <Modal open={!!compareTarget} onClose={() => setCompareTarget(null)} title="Product Photo vs. Fit Check" size="sm">
        {compareTarget && (
          <div className="p-4">
            {/* The fan's own uploaded photo is never persisted (Virtual
                Try-On inputs are deleted after use — CLAUDE.md's Trust
                Model). Compares the official product photo against the
                Fit Check result instead of a "before" selfie that doesn't
                exist past the moment it was generated. */}
            <BeforeAfterSlider
              beforeImage={compareTarget.product?.images?.[0]}
              afterImage={compareTarget.generatedImageUrl}
              beforeLabel="Product Photo"
              afterLabel="Your Fit Check"
              aspectClassName="aspect-square"
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FitCheck;
