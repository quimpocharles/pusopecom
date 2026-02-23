import { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import DateRangeSelector, { getDateRange } from '../../components/admin/reports/DateRangeSelector';
import api from '../../services/api';

// ── Constants ──────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  '#3b82f6', // blue   – domestic standard
  '#10b981', // green  – domestic free
  '#f59e0b', // amber  – intl SEA
  '#ef4444', // red    – intl ME
  '#8b5cf6', // purple – intl NA
  '#06b6d4', // cyan   – intl EU
  '#84cc16', // lime   – intl RoW
  '#ec4899', // pink   – venue pickup
  '#6b7280', // gray   – contact us / unknown
];

// Ordered rows for the breakdown table + chart
const ALL_ROWS = [
  {
    key:    'domestic_standard',
    label:  'Domestic — Standard Shipping',
    match:  (m) => m._id.method === 'domestic_flat_rate',
  },
  {
    key:    'domestic_free',
    label:  'Domestic — Free Shipping (₱2,000+)',
    match:  (m) => m._id.method === 'domestic_free',
  },
  {
    key:    'intl_sea',
    label:  'International — SEA',
    match:  (m) => m._id.method === 'international' && m._id.region === 'SEA',
  },
  {
    key:    'intl_me',
    label:  'International — Middle East',
    match:  (m) => m._id.method === 'international' && m._id.region === 'Middle East',
  },
  {
    key:    'intl_na',
    label:  'International — North America',
    match:  (m) => m._id.method === 'international' && m._id.region === 'North America',
  },
  {
    key:    'intl_eu',
    label:  'International — Europe',
    match:  (m) => m._id.method === 'international' && m._id.region === 'Europe',
  },
  {
    key:    'intl_row',
    label:  'International — Rest of World',
    match:  (m) =>
      m._id.method === 'international' &&
      !['SEA', 'Middle East', 'North America', 'Europe'].includes(m._id.region),
  },
  {
    key:    'venue_pickup',
    label:  'Venue Pick-Up',
    match:  (m) => m._id.method === 'venue_pickup',
  },
  {
    key:    'contact_us',
    label:  'Contact Us (International)',
    match:  (m) => m._id.method === 'contact_us',
  },
  {
    key:    'unknown',
    label:  'Unknown / Legacy',
    match:  (m) => m._id.method === 'unknown',
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

const SummaryCard = ({ label, count, total, colorClass }) => {
  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${colorClass}`}>{count.toLocaleString()}</p>
      <p className="text-xs text-gray-400 mt-1">{pct}% of all orders</p>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const AdminShippingReports = () => {
  const [selectedPreset, setSelectedPreset] = useState('30d');
  const [dateRange, setDateRange]           = useState(() => getDateRange('30d'));
  const [reportData, setReportData]         = useState(null);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateRange.startDate) params.set('startDate', dateRange.startDate);
      if (dateRange.endDate)   params.set('endDate',   dateRange.endDate);
      const res = await api.get(`/reports/shipping?${params.toString()}`);
      setReportData(res.data.data);
    } catch (err) {
      console.error('Shipping report fetch error:', err);
      setError('Failed to load shipping report. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [dateRange.startDate, dateRange.endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSelect = (preset, range) => {
    setSelectedPreset(preset);
    setDateRange(range);
  };

  // ── Derived data ──────────────────────────────────────────────────────────

  const totalOrders      = reportData?.totalOrders     ?? 0;
  const methodBreakdown  = reportData?.methodBreakdown ?? [];

  const rowCounts = ALL_ROWS.map((row) =>
    methodBreakdown.filter(row.match).reduce((s, m) => s + m.count, 0)
  );

  const domesticCount  = rowCounts[0] + rowCounts[1];
  const intlCount      = rowCounts[2] + rowCounts[3] + rowCounts[4] + rowCounts[5] + rowCounts[6];
  const pickupCount    = rowCounts[7];

  const chartData = ALL_ROWS
    .map((row, i) => ({ name: row.label, value: rowCounts[i], color: CHART_COLORS[i] }))
    .filter((d) => d.value > 0);

  // ── CSV export ────────────────────────────────────────────────────────────

  const handleExport = () => {
    const rawEvents = reportData?.rawEvents ?? [];
    const today     = new Date().toISOString().split('T')[0];
    const header    = ['Order ID', 'Date', 'Shipping Method', 'Order Total (PHP)', 'Region'];
    const rows      = rawEvents.map((e) => [
      e.orderId,
      new Date(e.createdAt).toISOString().split('T')[0],
      e.shippingMethod,
      e.orderTotal,
      e.region ?? '',
    ]);
    const csv  = [header, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `puso-shipping-report-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Shipping Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">
          Distribution of shipping methods across confirmed, paid orders.
        </p>
      </div>

      {/* Filters + export */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <DateRangeSelector selected={selectedPreset} onSelect={handleSelect} />
        <button
          onClick={handleExport}
          disabled={loading || !reportData || totalOrders === 0}
          className="px-4 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          Export CSV
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total Orders"   count={totalOrders}   total={totalOrders} colorClass="text-gray-900"   />
        <SummaryCard label="Domestic"       count={domesticCount} total={totalOrders} colorClass="text-blue-600"   />
        <SummaryCard label="International"  count={intlCount}     total={totalOrders} colorClass="text-amber-600"  />
        <SummaryCard label="Venue Pick-Up"  count={pickupCount}   total={totalOrders} colorClass="text-purple-600" />
      </div>

      {/* Chart + Table */}
      <div className="card p-6">
        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading…</div>
        ) : totalOrders === 0 ? (
          <div className="text-center py-16 text-gray-400">
            No shipping data for this period.
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-10">

            {/* Donut chart */}
            <div className="lg:w-72 flex-shrink-0">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Method Distribution</h2>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`${value.toLocaleString()} orders`]}
                    contentStyle={{ fontSize: '12px', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Legend */}
              <div className="space-y-1.5 mt-1">
                {chartData.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: entry.color }}
                    />
                    <span className="text-gray-600 truncate">{entry.name}</span>
                    <span className="ml-auto text-gray-400 font-medium">{entry.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Breakdown table */}
            <div className="flex-1 overflow-x-auto">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Breakdown by Method</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Shipping Method
                    </th>
                    <th className="pb-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Orders
                    </th>
                    <th className="pb-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      % of Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ALL_ROWS.map((row, i) => {
                    const count = rowCounts[i];
                    if (count === 0) return null;
                    const pct = ((count / totalOrders) * 100).toFixed(1);
                    return (
                      <tr key={row.key} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 text-gray-700 flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: CHART_COLORS[i] }}
                          />
                          {row.label}
                        </td>
                        <td className="py-3 text-right font-semibold text-gray-900">
                          {count.toLocaleString()}
                        </td>
                        <td className="py-3 text-right text-gray-500">
                          {pct}%
                        </td>
                      </tr>
                    );
                  })}
                  {/* Total row */}
                  <tr className="border-t border-gray-200">
                    <td className="pt-3 font-semibold text-gray-900">Total</td>
                    <td className="pt-3 text-right font-semibold text-gray-900">{totalOrders.toLocaleString()}</td>
                    <td className="pt-3 text-right font-semibold text-gray-900">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminShippingReports;
