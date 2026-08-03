import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Panel, Badge, Modal, Pagination, EmptyState, ErrorState } from '../../components/ui';
import accountService from '../../services/accountService';

// TryOnLog only ever stored the product's own image and a success/fail
// flag — the generated result image itself was never persisted anywhere
// (routes/tryon.js returns it once, directly in the response). So this
// shows what a try-on attempt was actually for and whether it succeeded,
// not a saved "result" image that doesn't exist.
const AccountTryOns = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page')) || 1;

  const [tryOns, setTryOns] = useState([]);
  const [pagination, setPagination] = useState({ pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await accountService.getTryOns({ page, limit: 12 });
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
  }, [page]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState description="Failed to load your try-on history." onRetry={load} />;
  if (tryOns.length === 0) {
    return (
      <EmptyState
        title="No try-ons yet"
        description="Use Virtual Try-On on any eligible product to see your history here."
        actionLabel="Browse Products"
        onAction={() => (window.location.href = '/products')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {tryOns.map((tryOn) => (
          <button key={tryOn._id} onClick={() => setSelected(tryOn)} className="text-left">
            <Panel padding="p-3">
              <img
                src={tryOn.productImage}
                alt={tryOn.productName}
                className="w-full aspect-square object-cover rounded-lg bg-gray-100 mb-2"
              />
              <p className="text-sm font-medium text-gray-900 truncate">{tryOn.productName}</p>
              <div className="flex items-center justify-between mt-1">
                <Badge tone={tryOn.success ? 'success' : 'secondary'}>
                  {tryOn.success ? 'Succeeded' : 'Failed'}
                </Badge>
                <span className="text-xs text-gray-400">
                  {new Date(tryOn.createdAt).toLocaleDateString('en-PH')}
                </span>
              </div>
            </Panel>
          </button>
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

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.productName} size="sm">
        {selected && (
          <div className="p-4 space-y-3">
            <img
              src={selected.productImage}
              alt={selected.productName}
              className="w-full aspect-square object-cover rounded-lg bg-gray-100"
            />
            <div className="flex items-center justify-between text-sm">
              <Badge tone={selected.success ? 'success' : 'secondary'}>
                {selected.success ? 'Succeeded' : 'Failed'}
              </Badge>
              <span className="text-gray-500">
                {new Date(selected.createdAt).toLocaleString('en-PH')}
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AccountTryOns;
