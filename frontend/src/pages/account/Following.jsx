import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { UserGroupIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Panel, Pagination, EmptyState, ErrorState } from '../../components/ui';
import accountService from '../../services/accountService';

// docs/MY_PUSO_MANIFESTO.md: Following makes fandom, not shopping, a reason
// to return. No public "browse organizations to follow" surface exists yet
// (out of scope this pass — the backend has no public organizations-list
// endpoint) so the empty state points at Products, where a fan discovers
// organizations organically through what they browse.
const Following = () => {
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
      const res = await accountService.getFollowing({ page, limit: 12 });
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

  const handleUnfollow = async (organizationId) => {
    setRemovingId(organizationId);
    try {
      await accountService.unfollowOrganization(organizationId);
      setItems((prev) => prev.filter((item) => item.organization._id !== organizationId));
    } catch {
      // leave it in place — the fan can retry
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState description="Failed to load who you follow." onRetry={load} />;
  if (items.length === 0) {
    return (
      <EmptyState
        icon={UserGroupIcon}
        title="You're not following anyone yet"
        description="Follow a school, team, or league to see their latest drops and news on your Home feed."
        actionLabel="Discover Teams"
        onAction={() => (window.location.href = '/products')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {items.map((item) => (
          <Panel key={item._id} className="flex items-center gap-4">
            {item.organization.logoUrl ? (
              <img src={item.organization.logoUrl} alt="" className="w-12 h-12 rounded-full object-cover bg-gray-100 flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-semibold flex-shrink-0">
                {item.organization.name?.[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <Link
                to={`/products?team=${encodeURIComponent(item.organization.name)}`}
                className="font-semibold text-gray-900 hover:text-primary-600 truncate block"
              >
                {item.organization.name}
              </Link>
              <p className="text-xs text-gray-500">Following since {new Date(item.createdAt).toLocaleDateString('en-PH')}</p>
            </div>
            <button
              onClick={() => handleUnfollow(item.organization._id)}
              disabled={removingId === item.organization._id}
              className="text-xs font-medium text-gray-500 hover:text-red-600 disabled:opacity-50 flex-shrink-0"
            >
              Unfollow
            </button>
          </Panel>
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

export default Following;
