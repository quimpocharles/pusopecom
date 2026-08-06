import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import DateRangeSelector, { getDateRange } from '../../../components/admin/reports/DateRangeSelector';
import ReportCard from '../../../components/admin/reports/ReportCard';
import HorizontalBarList from '../../../components/admin/reports/HorizontalBarList';
import ExportButtons from '../../../components/admin/reports/ExportButtons';
import Pagination from '../../../components/ui/Pagination';
import reportService from '../../../services/reportService';

const PAGE_SIZE = 20;
const formatPeso = (val) => `₱${Number(val).toLocaleString()}`;

const formatTimeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const formatMs = (ms) => {
  if (ms == null) return 'N/A';
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
};

const providerLabels = { wavespeed: 'WaveSpeed', replicate: 'Replicate', unknown: 'Unknown' };

// The dedicated Fit Check Analytics workspace — supersedes the old flat
// page's Try-On section (still separately reachable via Exports' report
// picker) with the 11 metrics explicitly requested: daily volume, guest/
// registered/premium usage, success/failure rate, avg generation time,
// avg AI cost (per-provider — Replicate correctly shows N/A, no verified
// pricing exists for it), most tried products, conversion/revenue
// attribution, and sponsored campaign performance. Log table templated
// directly off TryOnSection.jsx, this session's freshest component.
const FitCheckAnalyticsPage = () => {
  const [selectedPreset, setSelectedPreset] = useState('30d');
  const [dateRange, setDateRange] = useState(() => getDateRange('30d'));
  const [logPage, setLogPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => { setLogPage(1); }, [dateParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reportService.getFitCheckAnalyticsReport({ ...dateParams, page: logPage, pageSize: PAGE_SIZE }).then((res) => {
      if (!cancelled) setData(res.data);
    }).catch((err) => {
      console.error('Fit Check Analytics report error:', err);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [dateParams, logPage]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
              <div className="h-8 bg-gray-200 rounded w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { usageBreakdown } = data;
  const totalUsage = usageBreakdown.guest + usageBreakdown.registered + usageBreakdown.premium;
  const conversionRatePct = Math.round((data.conversion.conversionRate || 0) * 10000) / 100;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <DateRangeSelector selected={selectedPreset} onSelect={handleSelect} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportCard>
          <p className="text-sm text-gray-500">Total Attempts</p>
          <p className="text-2xl font-bold text-gray-900">{data.totalAttempts}</p>
        </ReportCard>
        <ReportCard>
          <p className="text-sm text-gray-500">Success / Failure Rate</p>
          <p className="text-2xl font-bold text-green-600">{data.successRate}% <span className="text-base text-red-500 font-medium">/ {data.failureRate}%</span></p>
        </ReportCard>
        <ReportCard>
          <p className="text-sm text-gray-500">Avg Generation Time</p>
          <p className="text-2xl font-bold text-gray-900">{formatMs(data.avgDurationMs)}</p>
        </ReportCard>
        <ReportCard>
          <p className="text-sm text-gray-500">Avg AI Cost (priced attempts)</p>
          <p className="text-2xl font-bold text-gray-900">{data.overallAvgCostUsd != null ? `$${data.overallAvgCostUsd.toFixed(4)}` : 'N/A'}</p>
        </ReportCard>
      </div>

      {/* Usage breakdown */}
      <ReportCard title="Guest vs Registered vs Premium">
        <HorizontalBarList
          items={[
            { label: 'Guest', value: usageBreakdown.guest },
            { label: 'Registered', value: usageBreakdown.registered },
            { label: 'Premium', value: usageBreakdown.premium },
          ]}
          labelKey="label"
          valueKey="value"
          formatValue={(v) => `${v} (${totalUsage > 0 ? Math.round((v / totalUsage) * 100) : 0}%)`}
          color="bg-indigo-500"
        />
      </ReportCard>

      {/* Cost & duration by provider */}
      <ReportCard title="Cost & Duration by Provider">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="py-2 pr-4">Provider</th>
                <th className="py-2 pr-4 text-right">Attempts</th>
                <th className="py-2 text-right">Avg Cost (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.byProviderCost.map((p) => (
                <tr key={p.provider}>
                  <td className="py-2 pr-4 font-medium text-gray-900">{providerLabels[p.provider] || p.provider}</td>
                  <td className="py-2 pr-4 text-right text-gray-700">{p.attempts}</td>
                  <td className="py-2 text-right text-gray-700">
                    {p.avgCostUsd != null ? (
                      `$${p.avgCostUsd.toFixed(4)} (${p.costSampleSize}/${p.attempts} priced)`
                    ) : (
                      <span className="text-gray-400">N/A — no verified pricing</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportCard>

      {/* Over time + Most tried */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.tryOnOverTime.length > 0 && (
          <ReportCard title="Fit Checks Over Time">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.tryOnOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip formatter={(val) => [val, 'Fit Checks']} />
                  <Line type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ReportCard>
        )}
        {data.mostTriedProducts.length > 0 && (
          <ReportCard title="Most Tried Products">
            <HorizontalBarList
              items={data.mostTriedProducts}
              labelKey="productName"
              valueKey="count"
              formatValue={(v) => `${v} tries`}
              color="bg-purple-500"
            />
          </ReportCard>
        )}
      </div>

      {/* Conversion & revenue attribution */}
      <ReportCard title="Conversion After Fit Check">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">Fans Who Tried</p>
            <p className="text-2xl font-bold text-gray-900">{data.conversion.triedUsers}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Conversion Rate</p>
            <p className="text-2xl font-bold text-blue-600">{conversionRatePct}%</p>
            <p className="text-xs text-gray-400 mt-0.5">{data.conversion.purchases} purchase{data.conversion.purchases === 1 ? '' : 's'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Revenue Attributed</p>
            <p className="text-2xl font-bold text-green-600">{formatPeso(data.conversion.revenue)}</p>
          </div>
        </div>
      </ReportCard>

      {/* Sponsored campaign performance */}
      {data.campaignPerformance.length > 0 && (
        <ReportCard title="Sponsored Campaign Performance">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="py-2 pr-4">Campaign</th>
                  <th className="py-2 pr-4">Sponsor</th>
                  <th className="py-2 pr-4 text-right">Views</th>
                  <th className="py-2 pr-4 text-right">Generations</th>
                  <th className="py-2 pr-4 text-right">Unique Fans</th>
                  <th className="py-2 pr-4 text-right">Purchases</th>
                  <th className="py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.campaignPerformance.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 pr-4 font-medium text-gray-900">{c.name}</td>
                    <td className="py-2 pr-4 text-gray-600">{c.sponsorName}</td>
                    <td className="py-2 pr-4 text-right text-gray-700">{c.views}</td>
                    <td className="py-2 pr-4 text-right text-gray-700">{c.generations}</td>
                    <td className="py-2 pr-4 text-right text-gray-700">{c.uniqueFans}</td>
                    <td className="py-2 pr-4 text-right text-gray-700">{c.purchases}</td>
                    <td className="py-2 text-right font-medium text-gray-900">{formatPeso(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-2">Each campaign's own all-time performance — not sliced to the date range above.</p>
        </ReportCard>
      )}

      {/* Full Fit Check log */}
      {data.tryOnLogTotal > 0 && (
        <ReportCard title="Fit Check Log">
          <div className="flex justify-end mb-3">
            <ExportButtons reportKey="fit-check" dateParams={dateParams} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 font-medium text-gray-500">Product</th>
                  <th className="text-left py-2 pr-4 font-medium text-gray-500">Email</th>
                  <th className="text-left py-2 pr-4 font-medium text-gray-500">Provider</th>
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
                          <img src={tryOn.productImage} alt={tryOn.productName} className="w-8 h-8 object-cover rounded" />
                        )}
                        <span className="font-medium text-gray-900 truncate max-w-[200px]">{tryOn.productName}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-gray-700 truncate max-w-[220px]">{tryOn.email}</td>
                    <td className="py-2 pr-4 text-gray-500">{providerLabels[tryOn.provider] || tryOn.provider || '—'}</td>
                    <td className="py-2 pr-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        tryOn.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
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

export default FitCheckAnalyticsPage;
