import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ReportCard from './ReportCard';
import HorizontalBarList from './HorizontalBarList';
import reportService from '../../../services/reportService';

const formatPeso = (val) => `₱${Number(val).toLocaleString()}`;

const SalesSection = ({ dateParams }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reportService.getSalesReport(dateParams).then(res => {
      if (!cancelled) setData(res.data);
    }).catch(err => {
      console.error('Sales report error:', err);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [dateParams]);

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Sales & Revenue</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
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
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Sales & Revenue</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ReportCard>
          <p className="text-sm text-gray-500">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-900">{formatPeso(data.totalRevenue)}</p>
        </ReportCard>
        <ReportCard>
          <p className="text-sm text-gray-500">Total Orders</p>
          <p className="text-2xl font-bold text-gray-900">{data.totalOrders.toLocaleString()}</p>
        </ReportCard>
        <ReportCard>
          <p className="text-sm text-gray-500">Avg Order Value</p>
          <p className="text-2xl font-bold text-gray-900">{formatPeso(data.averageOrderValue)}</p>
        </ReportCard>
      </div>

      {/* Revenue over time chart */}
      {data.revenueOverTime.length > 0 && (
        <ReportCard title="Revenue Over Time">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.revenueOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `₱${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(val) => [formatPeso(val), 'Revenue']} />
                <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ReportCard>
      )}

      {/* Category and Sport breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReportCard title="Sales by Category">
          <HorizontalBarList
            items={data.salesByCategory}
            labelKey="category"
            valueKey="revenue"
            formatValue={formatPeso}
            color="bg-blue-500"
          />
        </ReportCard>
        <ReportCard title="Sales by Sport">
          <HorizontalBarList
            items={data.salesBySport}
            labelKey="sport"
            valueKey="revenue"
            formatValue={formatPeso}
            color="bg-green-500"
          />
        </ReportCard>
      </div>
    </div>
  );
};

export default SalesSection;
