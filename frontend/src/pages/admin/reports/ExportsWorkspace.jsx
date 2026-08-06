import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowPathIcon, ArrowDownTrayIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline';
import DateRangeSelector, { getDateRange } from '../../../components/admin/reports/DateRangeSelector';
import ExportButtons from '../../../components/admin/reports/ExportButtons';
import Modal from '../../../components/ui/Modal';
import reportService from '../../../services/reportService';

// Replaces export buttons scattered across every report tab with one
// dedicated workspace, plus folds in the old standalone AdminReportArchive
// page as its second tab — both are fundamentally the same job ("get a
// report out of the system"), just ad-hoc vs. scheduled.
//
// Org/league/team/product/campaign filtering isn't built here yet — those
// only become meaningful once the Organizations workspace (Phase 2) gives
// them something real to filter against. Shipping dropdown inputs that
// don't yet do anything would be worse than not having them.

const REPORT_OPTIONS = [
  { key: 'executive', label: 'Executive Dashboard' },
  { key: 'sales', label: 'Sales' },
  { key: 'products', label: 'Products' },
  { key: 'orders', label: 'Orders' },
  { key: 'customers', label: 'Customers' },
  { key: 'fit-check', label: 'Fit Check Analytics' },
  { key: 'organizations', label: 'Organizations' },
  { key: 'finance', label: 'Finance' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'checkout-recovery', label: 'Checkout Recovery' },
];

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
  // Reports Module Redesign, Phase 3 — the daily slot's 6-way split, each
  // archived under its own type so it's independently downloadable here.
  executive_daily_report: 'Executive Daily Report',
  sales_report: 'Sales Report (Daily)',
  inventory_report: 'Inventory Report (Daily)',
  fulfillment_report: 'Fulfillment Report (Daily)',
  fit_check_analytics_report: 'Fit Check Analytics (Daily)',
  organization_performance_report: 'Organization Performance (Daily)',
};

// The in-page "View" modal below only knows how to render the original
// composite business-report shape (data.sales/products/customers/tryOn).
// The 6-way split's report types have their own, different data shapes —
// they're still fully downloadable (Excel/CSV/PDF), just not previewable
// in this modal without building 6 more bespoke viewers for marginal value.
const VIEWABLE_TYPES = new Set([
  'daily_business_report', 'weekly_business_report', 'monthly_business_report', 'quarterly_business_report',
]);

const money = (n) => `₱${Number(n ?? 0).toLocaleString()}`;

const TabButton = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      active ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'
    }`}
  >
    {children}
  </button>
);

const AdHocExportTab = () => {
  const [reportKey, setReportKey] = useState('executive');
  const [selectedPreset, setSelectedPreset] = useState('30d');
  const [dateRange, setDateRange] = useState(() => getDateRange('30d'));

  const handleSelect = (preset, range) => {
    setSelectedPreset(preset);
    setDateRange(range);
  };

  const dateParams = useMemo(() => {
    const params = {};
    if (dateRange.startDate) params.startDate = dateRange.startDate;
    if (dateRange.endDate) params.endDate = dateRange.endDate;
    return params;
  }, [dateRange.startDate, dateRange.endDate]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Pick a report and a date range, then download it as CSV or Excel.</p>
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <select
          value={reportKey}
          onChange={(e) => setReportKey(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {REPORT_OPTIONS.map((opt) => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>
        <DateRangeSelector selected={selectedPreset} onSelect={handleSelect} />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">{REPORT_OPTIONS.find((o) => o.key === reportKey)?.label}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {dateRange.startDate && dateRange.endDate ? `${dateRange.startDate} to ${dateRange.endDate}` : 'All time'}
          </p>
        </div>
        <ExportButtons reportKey={reportKey} dateParams={dateParams} />
      </div>
    </div>
  );
};

const ViewStat = ({ label, value }) => (
  <div className="bg-gray-50 rounded-lg p-3">
    <p className="text-xs text-gray-500">{label}</p>
    <p className="text-lg font-bold text-gray-900">{value}</p>
  </div>
);

const ArchiveTab = () => {
  const [runs, setRuns] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateFrequency, setRegenerateFrequency] = useState('daily');
  const [viewing, setViewing] = useState(null);
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

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <p className="text-sm text-gray-500">Every scheduled report run, kept exactly as it was sent.</p>
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
                        <button onClick={() => handleView(run)} disabled={!run.hasData || !VIEWABLE_TYPES.has(run.type)} className="p-1.5 text-gray-400 hover:text-primary-600 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title={VIEWABLE_TYPES.has(run.type) ? 'View' : 'Preview not available for this report type — download instead'}>
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDownload(run, 'xlsx')} disabled={!run.hasData} className="p-1.5 text-gray-400 hover:text-primary-600 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Download Excel">
                          <ArrowDownTrayIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(run)} className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors" title="Delete">
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
              <button onClick={() => fetchRuns(pagination.page - 1)} disabled={pagination.page <= 1} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                Previous
              </button>
              <button onClick={() => fetchRuns(pagination.page + 1)} disabled={pagination.page >= pagination.pages} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
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
              <ViewStat label="Fit Check Sessions" value={viewing.data.tryOn.sessions} />
              <ViewStat label="Fit Check Success Rate" value={`${viewing.data.tryOn.successRate}%`} />
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
              <button onClick={() => handleDownload(viewing, 'csv')} className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50">
                Download CSV
              </button>
              <button onClick={() => handleDownload(viewing, 'xlsx')} className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50">
                Download Excel
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const ExportsWorkspace = () => {
  const [tab, setTab] = useState('export'); // 'export' | 'archive'

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-200 flex gap-4">
        <TabButton active={tab === 'export'} onClick={() => setTab('export')}>Ad-hoc Export</TabButton>
        <TabButton active={tab === 'archive'} onClick={() => setTab('archive')}>Scheduled Report Archive</TabButton>
      </div>
      {tab === 'export' ? <AdHocExportTab /> : <ArchiveTab />}
    </div>
  );
};

export default ExportsWorkspace;
