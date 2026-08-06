import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import DateRangeSelector, { getDateRange } from '../../../components/admin/reports/DateRangeSelector';
import ReportCard from '../../../components/admin/reports/ReportCard';
import ExportButtons from '../../../components/admin/reports/ExportButtons';
import reportService from '../../../services/reportService';

const formatPeso = (val) => `₱${Number(val).toLocaleString()}`;

const FinanceReportPage = () => {
  const [selectedPreset, setSelectedPreset] = useState('30d');
  const [dateRange, setDateRange] = useState(() => getDateRange('30d'));
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reportService.getFinanceReport(dateParams).then((res) => {
      if (!cancelled) setData(res.data);
    }).catch((err) => {
      console.error('Finance report error:', err);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [dateParams]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-sm text-gray-500">Net revenue after refunds, refund queue health, and payment-provider reliability.</p>
        <DateRangeSelector selected={selectedPreset} onSelect={handleSelect} />
      </div>

      <div className="flex justify-end">
        <ExportButtons reportKey="finance" dateParams={dateParams} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ReportCard>
          <p className="text-sm text-gray-500">Gross Revenue</p>
          <p className="text-2xl font-bold text-gray-900">{formatPeso(data.grossRevenue)}</p>
        </ReportCard>
        <ReportCard>
          <p className="text-sm text-gray-500">Refunded</p>
          <p className="text-2xl font-bold text-red-600">{formatPeso(data.refundedAmount)}</p>
          <p className="text-xs text-gray-400 mt-1">{data.refundCount} refund{data.refundCount === 1 ? '' : 's'} processed</p>
        </ReportCard>
        <ReportCard>
          <p className="text-sm text-gray-500">Net Revenue</p>
          <p className="text-2xl font-bold text-green-600">{formatPeso(data.netRevenue)}</p>
        </ReportCard>
      </div>

      {/* Refund queue health */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ReportCard>
          <p className="text-sm text-gray-500">Refund Queue (pending)</p>
          <p className="text-2xl font-bold text-amber-600">{data.refundQueueCount}</p>
          <p className="text-xs text-gray-400 mt-1">Live snapshot — not scoped to the date range above</p>
        </ReportCard>
        <ReportCard>
          <p className="text-sm text-gray-500">Avg Refund Velocity</p>
          <p className="text-2xl font-bold text-gray-900">
            {data.avgRefundVelocityHours === null ? 'N/A' : `${data.avgRefundVelocityHours}h`}
          </p>
          <p className="text-xs text-gray-400 mt-1">Time from request to resolution, for refunds resolved in range</p>
        </ReportCard>
      </div>

      {/* Net revenue over time */}
      {data.revenueOverTime.length > 0 && (
        <ReportCard title="Net Revenue Over Time">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.revenueOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(val, name) => [formatPeso(val), name === 'netRevenue' ? 'Net Revenue' : name === 'grossRevenue' ? 'Gross Revenue' : 'Refunded']} />
                <Line type="monotone" dataKey="grossRevenue" stroke="#94a3b8" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="netRevenue" stroke="#16a34a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ReportCard>
      )}

      {/* Payment provider success rate */}
      <ReportCard title="Payment Provider Reliability">
        {data.providerSuccessRate.length === 0 ? (
          <p className="text-sm text-gray-500">No resolved payment attempts in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="py-2 pr-4">Provider</th>
                  <th className="py-2 pr-4 text-right">Succeeded</th>
                  <th className="py-2 pr-4 text-right">Total Attempts</th>
                  <th className="py-2 text-right">Success Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.providerSuccessRate.map((p) => (
                  <tr key={p.provider}>
                    <td className="py-2 pr-4 font-medium text-gray-900 capitalize">{p.provider}</td>
                    <td className="py-2 pr-4 text-right text-gray-700">{p.succeeded}</td>
                    <td className="py-2 pr-4 text-right text-gray-700">{p.total}</td>
                    <td className="py-2 text-right font-medium text-gray-900">{p.successRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReportCard>

      {/* Fee breakdown — explicitly descoped */}
      <div className="flex items-start gap-2 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
        <InformationCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-gray-400" />
        <span>Payment-provider fee breakdown isn't available yet — no fee data is captured by the platform today.</span>
      </div>
    </div>
  );
};

export default FinanceReportPage;
