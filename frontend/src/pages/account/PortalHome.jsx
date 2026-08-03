import { useEffect, useState } from 'react';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { ErrorState } from '../../components/ui';
import MomentCard from '../../components/portal/MomentCard';
import accountService from '../../services/accountService';

// My PUSO's Home — a living feed, not a dashboard of statistics. Every
// moment already comes pre-composed from GET /api/account/home (see
// accountRepository.getHomeFeed); this page just renders them in order.
const PortalHome = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await accountService.getHome();
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
    return <ErrorState description="Failed to load My PUSO." onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      <p className="text-gray-500">
        Welcome back, <span className="font-semibold text-gray-900">{data.profile?.firstName}</span>.
      </p>

      <div className="space-y-3">
        {data.feed.map((moment) => (
          <MomentCard key={moment.id} moment={moment} />
        ))}
      </div>
    </div>
  );
};

export default PortalHome;
