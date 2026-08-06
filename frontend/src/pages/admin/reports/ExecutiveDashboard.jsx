import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUpIcon, ArrowDownIcon, ExclamationTriangleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import DateRangeSelector, { getDateRange } from '../../../components/admin/reports/DateRangeSelector';
import ReportCard from '../../../components/admin/reports/ReportCard';
import HorizontalBarList from '../../../components/admin/reports/HorizontalBarList';
import reportService from '../../../services/reportService';
import orderService from '../../../services/orderService';
import { ORDER_STATUS_COLORS, orderStatusLabel } from '../../../utils/orderStatus';

const formatPeso = (val) => `₱${Number(val).toLocaleString()}`;

const paymentColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-800',
};

const DeltaBadge = ({ value }) => {
  if (value === 0) return <span className="text-xs text-gray-400">No change</span>;
  const positive = value > 0;
  const Icon = positive ? ArrowUpIcon : ArrowDownIcon;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${positive ? 'text-green-600' : 'text-red-600'}`}>
      <Icon className="w-3 h-3" />
      {Math.abs(value)}%
    </span>
  );
};

const alertStyles = {
  critical: { border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-700', Icon: ExclamationCircleIcon, iconColor: 'text-red-500' },
  warning: { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-700', Icon: ExclamationTriangleIcon, iconColor: 'text-amber-500' },
};

const ExecutiveDashboard = () => {
  const [selectedPreset, setSelectedPreset] = useState('30d');
  const [dateRange, setDateRange] = useState(() => getDateRange('30d'));
  const [data, setData] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
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
    Promise.all([
      reportService.getExecutiveReport(dateParams),
      orderService.getAllOrders({ limit: 5 }),
    ]).then(([reportRes, ordersRes]) => {
      if (cancelled) return;
      setData(reportRes.data);
      setRecentOrders(ordersRes.data);
    }).catch((err) => {
      console.error('Executive dashboard error:', err);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [dateParams]);

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

  const bestSellersForBarList = data.whatsSelling.bestSellers.map((p) => ({ name: p.name, revenue: p.revenue }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-sm text-gray-500">How much did we sell, is everything healthy, and what needs attention today.</p>
        <DateRangeSelector selected={selectedPreset} onSelect={handleSelect} />
      </div>

      {/* Executive summary */}
      <ReportCard title="Summary">
        <ul className="space-y-1.5 text-sm text-gray-700">
          {data.executiveSummary.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </ReportCard>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportCard>
          <p className="text-sm text-gray-500">Revenue</p>
          <p className="text-2xl font-bold text-gray-900">{formatPeso(data.kpis.totalRevenue)}</p>
          <div className="mt-1"><DeltaBadge value={data.kpis.delta.revenue} /></div>
        </ReportCard>
        <ReportCard>
          <p className="text-sm text-gray-500">Orders</p>
          <p className="text-2xl font-bold text-gray-900">{data.kpis.totalOrders.toLocaleString()}</p>
          <div className="mt-1"><DeltaBadge value={data.kpis.delta.orders} /></div>
        </ReportCard>
        <ReportCard>
          <p className="text-sm text-gray-500">Avg Order Value</p>
          <p className="text-2xl font-bold text-gray-900">{formatPeso(data.kpis.averageOrderValue)}</p>
          <div className="mt-1"><DeltaBadge value={data.kpis.delta.averageOrderValue} /></div>
        </ReportCard>
        <ReportCard>
          <p className="text-sm text-gray-500">Fulfillment Rate</p>
          <p className="text-2xl font-bold text-blue-600">{data.operationsHealth.fulfillmentRate}%</p>
          <p className="text-xs text-gray-400 mt-1">{data.operationsHealth.pendingShipments} pending shipment{data.operationsHealth.pendingShipments === 1 ? '' : 's'}</p>
        </ReportCard>
      </div>

      {/* Alerts */}
      <ReportCard title="Alerts — needs attention today">
        {data.alerts.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing flagged — operations look healthy.</p>
        ) : (
          <div className="space-y-2">
            {data.alerts.map((alert, i) => {
              const style = alertStyles[alert.severity];
              const AlertIcon = style.Icon;
              return (
                <Link
                  key={i}
                  to={alert.link}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-lg border ${style.border} ${style.bg} hover:opacity-80 transition-opacity`}
                >
                  <AlertIcon className={`w-5 h-5 flex-shrink-0 ${style.iconColor}`} />
                  <span className={`text-sm font-medium ${style.text}`}>{alert.message}</span>
                </Link>
              );
            })}
          </div>
        )}
      </ReportCard>

      {/* Revenue over time + What's Selling */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.revenueOverTime.length > 0 && (
          <ReportCard title="Revenue Over Time">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.revenueOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(val) => [formatPeso(val), 'Revenue']} />
                  <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ReportCard>
        )}

        {data.whatsSelling.salesByCategory.length > 0 && (
          <ReportCard title="Sales by Category">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.whatsSelling.salesByCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(val) => [formatPeso(val), 'Revenue']} />
                  <Bar dataKey="revenue" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ReportCard>
        )}
      </div>

      {/* Top products */}
      {bestSellersForBarList.length > 0 && (
        <ReportCard title="Top Products">
          <HorizontalBarList
            items={bestSellersForBarList}
            labelKey="name"
            valueKey="revenue"
            formatValue={formatPeso}
            maxItems={5}
            color="bg-primary-500"
          />
        </ReportCard>
      )}

      {/* Recent orders */}
      <ReportCard title="Recent Orders">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="pb-2 pr-4">Order #</th>
                <th className="pb-2 pr-4">Customer</th>
                <th className="pb-2 pr-4">Total</th>
                <th className="pb-2 pr-4">Payment</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentOrders.map((order) => (
                <tr key={order._id}>
                  <td className="py-2 pr-4 font-medium text-gray-900">{order.orderNumber}</td>
                  <td className="py-2 pr-4 text-gray-600">
                    {order.user ? `${order.user.firstName} ${order.user.lastName}` : order.email}
                  </td>
                  <td className="py-2 pr-4 font-medium text-gray-900">{formatPeso(order.total)}</td>
                  <td className="py-2 pr-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${paymentColors[order.paymentStatus]}`}>
                      {order.paymentStatus}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS_COLORS[order.orderStatus]}`}>
                      {orderStatusLabel(order.orderStatus)}
                    </span>
                  </td>
                  <td className="py-2 text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-500">No orders yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ReportCard>
    </div>
  );
};

export default ExecutiveDashboard;
