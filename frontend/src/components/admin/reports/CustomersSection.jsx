import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ReportCard from './ReportCard';
import HorizontalBarList from './HorizontalBarList';
import reportService from '../../../services/reportService';

const formatPeso = (val) => `₱${Number(val).toLocaleString()}`;

const CustomersSection = ({ dateParams }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reportService.getCustomersReport(dateParams).then(res => {
      if (!cancelled) setData(res.data);
    }).catch(err => {
      console.error('Customers report error:', err);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [dateParams]);

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Customer Insights</h2>
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

  const { newVsReturning } = data;
  const totalCustomers = newVsReturning.newCustomers + newVsReturning.returningCustomers;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Customer Insights</h2>

      {/* New vs Returning */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ReportCard>
          <p className="text-sm text-gray-500">Total Customers</p>
          <p className="text-2xl font-bold text-gray-900">{totalCustomers}</p>
        </ReportCard>
        <ReportCard>
          <p className="text-sm text-gray-500">New (1 order)</p>
          <p className="text-2xl font-bold text-blue-600">{newVsReturning.newCustomers}</p>
        </ReportCard>
        <ReportCard>
          <p className="text-sm text-gray-500">Returning (2+ orders)</p>
          <p className="text-2xl font-bold text-green-600">{newVsReturning.returningCustomers}</p>
        </ReportCard>
      </div>

      {/* Top customers table */}
      {data.topCustomers.length > 0 && (
        <ReportCard title="Top Customers by Spend">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 font-medium text-gray-500">#</th>
                  <th className="text-left py-2 pr-4 font-medium text-gray-500">Customer</th>
                  <th className="text-right py-2 pr-4 font-medium text-gray-500">Orders</th>
                  <th className="text-right py-2 font-medium text-gray-500">Total Spent</th>
                </tr>
              </thead>
              <tbody>
                {data.topCustomers.map((customer, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 pr-4 text-gray-400 font-bold">{i + 1}</td>
                    <td className="py-2 pr-4">
                      <p className="font-medium text-gray-900">{customer.name}</p>
                      <p className="text-xs text-gray-500">{customer.email}</p>
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-700">{customer.orderCount}</td>
                    <td className="py-2 text-right font-semibold text-gray-900">{formatPeso(customer.totalSpent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ReportCard>
      )}

      {/* Customer growth chart */}
      {data.customerGrowth.length > 0 && (
        <ReportCard title="New User Registrations">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.customerGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip formatter={(val) => [val, 'New Users']} />
                <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ReportCard>
      )}

      {/* Geographic distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReportCard title="Top Provinces">
          <HorizontalBarList
            items={data.geographicDistribution}
            labelKey="province"
            valueKey="orders"
            formatValue={(v) => `${v} orders`}
            maxItems={15}
            color="bg-teal-500"
          />
        </ReportCard>
        <ReportCard title="Top Cities">
          <HorizontalBarList
            items={data.cityDistribution}
            labelKey="city"
            valueKey="orders"
            formatValue={(v) => `${v} orders`}
            maxItems={15}
            color="bg-cyan-500"
          />
        </ReportCard>
      </div>
    </div>
  );
};

export default CustomersSection;
