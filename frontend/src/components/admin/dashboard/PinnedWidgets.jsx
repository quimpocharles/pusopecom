import { useState, useEffect, useCallback } from 'react';
import {
  CurrencyDollarIcon,
  ShoppingBagIcon,
  ExclamationTriangleIcon,
  TruckIcon,
  XCircleIcon,
  EyeIcon,
  SparklesIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import StatsCard from '../StatsCard';
import reportService from '../../../services/reportService';

const WIDGET_META = {
  todaysRevenue: { label: "Today's Revenue", icon: CurrencyDollarIcon, color: 'green' },
  todaysOrders: { label: "Today's Orders", icon: ShoppingBagIcon, color: 'blue' },
  lowStock: { label: 'Low Stock', icon: ExclamationTriangleIcon, color: 'orange' },
  pendingShipments: { label: 'Pending Shipments', icon: TruckIcon, color: 'purple' },
  failedPayments: { label: 'Failed Payments (Today)', icon: XCircleIcon, color: 'red' },
  mostViewedProducts: { label: 'Most Viewed Products', icon: EyeIcon, color: 'indigo' },
  mostTriedOnProducts: { label: 'Most Tried-On Products', icon: SparklesIcon, color: 'indigo' },
};

const money = (n) => `₱${Number(n ?? 0).toLocaleString()}`;

function widgetValue(key, data) {
  switch (key) {
    case 'todaysRevenue': return money(data.todaysRevenue);
    case 'todaysOrders': return data.todaysOrders;
    case 'lowStock': return data.lowStock;
    case 'pendingShipments': return data.pendingShipments;
    case 'failedPayments': return data.failedPayments;
    default: return null;
  }
}

const ListWidget = ({ label, icon: Icon, items, empty }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-6">
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-5 h-5 text-indigo-500" />
      <p className="text-sm font-semibold text-gray-900">{label}</p>
    </div>
    {items.length === 0 ? (
      <p className="text-sm text-gray-400">{empty}</p>
    ) : (
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-center justify-between text-sm">
            <span className="text-gray-700 truncate">{item.name || item.productName}</span>
            <span className="text-gray-500 flex-shrink-0 ml-2">{item.totalViews ?? item.count}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

const PinnedWidgets = () => {
  const [config, setConfig] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [customizing, setCustomizing] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, dataRes] = await Promise.all([
        reportService.getDashboardWidgetConfig(),
        reportService.getDashboardWidgetData(),
      ]);
      setConfig(configRes.data);
      setData(dataRes.data);
    } catch (error) {
      console.error('Failed to load dashboard widgets:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleToggle = async (key, active) => {
    await reportService.setDashboardWidgetActive(key, active);
    setConfig((prev) => prev.map((w) => (w.key === key ? { ...w, active } : w)));
  };

  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse h-24" />
        ))}
      </div>
    );
  }

  const active = config.filter((w) => w.active);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Pinned Reports</h2>
        <button
          onClick={() => setCustomizing((v) => !v)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <Cog6ToothIcon className="w-4 h-4" />
          Customize
        </button>
      </div>

      {customizing && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {config.map((w) => (
              <label key={w.key} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={w.active}
                  onChange={(e) => handleToggle(w.key, e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                {WIDGET_META[w.key]?.label || w.key}
              </label>
            ))}
          </div>
        </div>
      )}

      {active.length === 0 ? (
        <p className="text-sm text-gray-400">No widgets pinned — click Customize to add some.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {active.map((w) => {
            const meta = WIDGET_META[w.key];
            if (!meta) return null;

            if (w.key === 'mostViewedProducts') {
              return <ListWidget key={w.key} label={meta.label} icon={meta.icon} items={data.mostViewedProducts} empty="No view data yet" />;
            }
            if (w.key === 'mostTriedOnProducts') {
              return <ListWidget key={w.key} label={meta.label} icon={meta.icon} items={data.mostTriedOnProducts} empty="No try-on data yet" />;
            }
            return (
              <StatsCard
                key={w.key}
                icon={meta.icon}
                title={meta.label}
                value={widgetValue(w.key, data)}
                color={meta.color}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PinnedWidgets;
