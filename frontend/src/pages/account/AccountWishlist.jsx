import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ProductCard from '../../components/products/ProductCard';
import { Pagination, EmptyState, ErrorState } from '../../components/ui';
import accountService from '../../services/accountService';

// The remove button is a sibling of ProductCard, not a child — ProductCard
// is itself a full-card <Link>, so a button nested inside it would be an
// interactive element inside an interactive element. Absolutely positioned
// against this wrapper's own relative container instead.
const AccountWishlist = () => {
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
  if (error) return <ErrorState description="Failed to load your wishlist." onRetry={load} />;
  if (items.length === 0) {
    return (
      <EmptyState
        title="Your wishlist is empty"
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
              aria-label={`Remove ${item.product.name} from wishlist`}
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

export default AccountWishlist;
