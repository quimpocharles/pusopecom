import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ReportCard from './ReportCard';
import HorizontalBarList from './HorizontalBarList';
import ExportButtons from './ExportButtons';
import Pagination from '../../ui/Pagination';
import reportService from '../../../services/reportService';

const PAGE_SIZE = 20;

const formatTimeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const TryOnSection = ({ dateParams }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logPage, setLogPage] = useState(1);

  // A new date range invalidates whatever page the log table was on —
  // reset to page 1 rather than risk landing past the end of a now-smaller
  // result set.
  useEffect(() => { setLogPage(1); }, [dateParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reportService.getTryOnReport({ ...dateParams, page: logPage, pageSize: PAGE_SIZE }).then(res => {
      if (!cancelled) setData(res.data);
    }).catch(err => {
      console.error('Try-on report error:', err);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [dateParams, logPage]);

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Fit Check</h2>
        <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-6 bg-gray-200 rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Fit Check</h2>
        <ExportButtons reportKey="tryon" dateParams={dateParams} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ReportCard>
          <p className="text-sm text-gray-500">Total Attempts</p>
          <p className="text-2xl font-bold text-gray-900">{data.totalAttempts}</p>
        </ReportCard>
        <ReportCard>
          <p className="text-sm text-gray-500">Successful</p>
          <p className="text-2xl font-bold text-green-600">{data.successfulAttempts}</p>
        </ReportCard>
        <ReportCard>
          <p className="text-sm text-gray-500">Success Rate</p>
          <p className="text-2xl font-bold text-purple-600">{data.successRate}%</p>
        </ReportCard>
      </div>

      {/* Try-ons over time chart */}
      {data.tryOnOverTime.length > 0 && (
        <ReportCard title="Try-Ons Over Time">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.tryOnOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip formatter={(val) => [val, 'Try-Ons']} />
                <Line type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ReportCard>
      )}

      {/* Most tried products */}
      {data.mostTriedProducts.length > 0 && (
        <ReportCard title="Most Tried Products">
          <HorizontalBarList
            items={data.mostTriedProducts}
            labelKey="productName"
            valueKey="count"
            formatValue={(v) => `${v} tries`}
            maxItems={10}
            color="bg-purple-500"
          />
        </ReportCard>
      )}

      {/* Full Fit Check log — who used it, on what, and when. Paginated
          server-side (data.tryOnLog is just the current page); totals/chart
          above always reflect the whole date range regardless of page. */}
      {data.tryOnLogTotal > 0 && (
        <ReportCard title="Fit Check Log">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 font-medium text-gray-500">Product</th>
                  <th className="text-left py-2 pr-4 font-medium text-gray-500">Email</th>
                  <th className="text-left py-2 pr-4 font-medium text-gray-500">Status</th>
                  <th className="text-right py-2 font-medium text-gray-500">Time</th>
                </tr>
              </thead>
              <tbody>
                {data.tryOnLog.map((tryOn, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        {tryOn.productImage && (
                          <img
                            src={tryOn.productImage}
                            alt={tryOn.productName}
                            className="w-8 h-8 object-cover rounded"
                          />
                        )}
                        <span className="font-medium text-gray-900 truncate max-w-[200px]">
                          {tryOn.productName}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-gray-700 truncate max-w-[220px]">
                      {tryOn.email}
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        tryOn.success
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {tryOn.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td className="py-2 text-right text-gray-500 whitespace-nowrap" title={new Date(tryOn.createdAt).toLocaleString()}>
                      {formatTimeAgo(tryOn.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.page}
            totalPages={Math.max(1, Math.ceil(data.tryOnLogTotal / data.pageSize))}
            onPageChange={setLogPage}
            className="mt-4"
          />
        </ReportCard>
      )}
    </div>
  );
};

export default TryOnSection;
