import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ReportCard from './ReportCard';
import HorizontalBarList from './HorizontalBarList';
import reportService from '../../../services/reportService';

const statusColors = {
  processing: 'bg-yellow-500',
  confirmed: 'bg-blue-500',
  shipped: 'bg-indigo-500',
  delivered: 'bg-green-500',
  cancelled: 'bg-red-500',
};

const paymentColors = {
  pending: 'bg-yellow-500',
  paid: 'bg-green-500',
  failed: 'bg-red-500',
  refunded: 'bg-gray-500',
};

const OrdersSection = ({ dateParams }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reportService.getOrdersReport(dateParams).then(res => {
      if (!cancelled) setData(res.data);
    }).catch(err => {
      console.error('Orders report error:', err);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [dateParams]);

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Order Analytics</h2>
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
      <h2 className="text-xl font-bold text-gray-900">Order Analytics</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <ReportCard>
          <p className="text-sm text-gray-500">Total Orders</p>
          <p className="text-2xl font-bold text-gray-900">{data.totalOrders}</p>
        </ReportCard>
        <ReportCard>
          <p className="text-sm text-gray-500">Delivered</p>
          <p className="text-2xl font-bold text-green-600">{data.deliveredOrders}</p>
        </ReportCard>
        <ReportCard>
          <p className="text-sm text-gray-500">Fulfillment Rate</p>
          <p className="text-2xl font-bold text-blue-600">{data.fulfillmentRate}%</p>
        </ReportCard>
        <ReportCard>
          <p className="text-sm text-gray-500">Failed Payments</p>
          <p className="text-2xl font-bold text-red-600">{data.failedPayments.count}</p>
          {data.failedPayments.totalValue > 0 && (
            <p className="text-xs text-gray-500">₱{data.failedPayments.totalValue.toLocaleString()}</p>
          )}
        </ReportCard>
      </div>

      {/* Orders over time chart */}
      {data.ordersOverTime.length > 0 && (
        <ReportCard title="Orders Over Time">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.ordersOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip formatter={(val) => [val, 'Orders']} />
                <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ReportCard>
      )}

      {/* Status and payment breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReportCard title="Order Status">
          <div className="space-y-3">
            {data.statusBreakdown.map((item) => {
              const total = data.totalOrders || 1;
              const pct = Math.round((item.count / total) * 100);
              const color = statusColors[item.status] || 'bg-gray-400';
              return (
                <div key={item.status}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700 capitalize">{item.status}</span>
                    <span className="text-sm text-gray-900 font-semibold">{item.count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={`${color} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </ReportCard>
        <ReportCard title="Payment Status">
          <div className="space-y-3">
            {data.paymentBreakdown.map((item) => {
              const total = data.totalOrders || 1;
              const pct = Math.round((item.count / total) * 100);
              const color = paymentColors[item.status] || 'bg-gray-400';
              return (
                <div key={item.status}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700 capitalize">{item.status}</span>
                    <span className="text-sm text-gray-900 font-semibold">{item.count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={`${color} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </ReportCard>
      </div>
    </div>
  );
};

export default OrdersSection;
