import { useState, useEffect, useCallback } from 'react';
import { ArrowPathIcon, ArrowDownTrayIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline';
import Modal from '../../components/ui/Modal';
import reportService from '../../services/reportService';

const statusColors = {
  sent: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  skipped: 'bg-gray-100 text-gray-600',
};

const typeLabels = {
  daily_business_report: 'Daily Business Report',
  weekly_business_report: 'Weekly Business Report',
  monthly_business_report: 'Monthly Business Report',
  quarterly_business_report: 'Quarterly Business Report',
};

const money = (n) => `₱${Number(n ?? 0).toLocaleString()}`;

const AdminReportArchive = () => {
  const [runs, setRuns] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateFrequency, setRegenerateFrequency] = useState('daily');
  const [viewing, setViewing] = useState(null); // full run detail, or null
  const [error, setError] = useState('');

  const fetchRuns = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await reportService.getArchive({ page, limit: 20 });
      setRuns(res.data);
      setPagination(res.pagination);
    } catch (err) {
      setError('Failed to load report archive');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    setError('');
    try {
      await reportService.regenerateReport(regenerateFrequency);
      fetchRuns(1);
    } catch (err) {
      setError('Failed to regenerate report — check server logs');
    } finally {
      setRegenerating(false);
    }
  };

  const handleView = async (run) => {
    try {
      const res = await reportService.getArchiveRun(run._id);
      setViewing(res.data);
    } catch (err) {
      setError('Failed to load run detail');
    }
  };

  const handleDownload = async (run, format) => {
    try {
      await reportService.downloadArchiveRun(run._id, format);
    } catch (err) {
      setError('Failed to download report');
    }
  };

  const handleDelete = async (run) => {
    try {
      await reportService.deleteArchiveRun(run._id);
      fetchRuns(pagination.page);
    } catch (err) {
      setError('Failed to delete report run');
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Report Archive</h1>
          <p className="text-sm text-gray-500 mt-1">Every scheduled report run, kept exactly as it was sent.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={regenerateFrequency}
            onChange={(e) => setRegenerateFrequency(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
            {regenerating ? 'Regenerating…' : 'Regenerate Now'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                <th className="px-6 py-3">Report</th>
                <th className="px-6 py-3">Covers</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Recipients</th>
                <th className="px-6 py-3">Generated</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="w-6 h-6 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">No reports archived yet</td>
                </tr>
              ) : (
                runs.map((run) => (
                  <tr key={run._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{typeLabels[run.type] || run.type}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{new Date(run.reportDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[run.status]}`}>
                        {run.status}
                      </span>
                      {run.status === 'failed' && run.errorMessage && (
                        <p className="text-xs text-red-500 mt-1 max-w-xs truncate" title={run.errorMessage}>{run.errorMessage}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{run.recipients?.length ?? 0}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(run.createdAt).toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleView(run)}
                          disabled={!run.hasData}
                          className="p-1.5 text-gray-400 hover:text-primary-600 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="View"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownload(run, 'xlsx')}
                          disabled={!run.hasData}
                          className="p-1.5 text-gray-400 hover:text-primary-600 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Download Excel"
                        >
                          <ArrowDownTrayIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(run)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Showing {(pagination.page - 1) * 20 + 1}–{Math.min(pagination.page * 20, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => fetchRuns(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => fetchRuns(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Daily Business Report" size="lg">
        {viewing && (
          <div className="p-4 space-y-4">
            <p className="text-sm text-gray-500">{new Date(viewing.reportDate).toLocaleDateString()}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <ViewStat label="Gross Revenue" value={money(viewing.data.sales.grossRevenue)} />
              <ViewStat label="Net Revenue" value={money(viewing.data.sales.netRevenue)} />
              <ViewStat label="Orders" value={viewing.data.sales.orders} />
              <ViewStat label="New Customers" value={viewing.data.customers.newCustomers} />
              <ViewStat label="Try-On Sessions" value={viewing.data.tryOn.sessions} />
              <ViewStat label="Try-On Success Rate" value={`${viewing.data.tryOn.successRate}%`} />
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Top Selling Products</h3>
              {viewing.data.products.topSelling.length === 0 ? (
                <p className="text-sm text-gray-400">No products sold</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {viewing.data.products.topSelling.map((p, i) => (
                    <li key={i} className="flex justify-between py-1.5 text-sm">
                      <span className="text-gray-700">{p.name} &times;{p.quantity}</span>
                      <span className="font-medium text-gray-900">{money(p.revenue)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleDownload(viewing, 'csv')}
                className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Download CSV
              </button>
              <button
                onClick={() => handleDownload(viewing, 'xlsx')}
                className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Download Excel
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const ViewStat = ({ label, value }) => (
  <div className="bg-gray-50 rounded-lg p-3">
    <p className="text-xs text-gray-500">{label}</p>
    <p className="text-lg font-bold text-gray-900">{value}</p>
  </div>
);

export default AdminReportArchive;
