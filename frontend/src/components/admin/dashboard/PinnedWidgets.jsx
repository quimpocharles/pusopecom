import { useState, useEffect, useCallback } from 'react';
import { EyeIcon, SparklesIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import reportService from '../../../services/reportService';

// Admin Dashboard Phase 2 — this used to also offer Today's Revenue,
// Today's Orders, Low Stock, Pending Shipments, and Failed Payments as
// pinnable cards. Those now live in the Dashboard's own fixed STATUS/NEEDS
// ATTENTION sections (STATUS and NEEDS ATTENTION "must always be visible
// and must not be hideable" — a customizable pin is the opposite of that),
// so they were removed from what this component can render, leaving only
// the two genuine PERFORMANCE-tier widgets. The backend's dashboard-widget
// config/data endpoints are untouched and still return all 7 keys — a
// widget whose key has no entry here (below) simply doesn't render, same
// as this component already did for any unrecognized key.
const WIDGET_META = {
  mostViewedProducts: { label: 'Most Viewed Products', icon: EyeIcon },
  mostTriedOnProducts: { label: 'Most Tried-On Products', icon: SparklesIcon },
};

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

  // Only ever consider keys this component still knows how to render — the
  // backend config can (and does) still contain the 5 retired keys; they
  // just silently never appear here, same as any other unrecognized key
  // already did before this change.
  const knownConfig = config.filter((w) => WIDGET_META[w.key]);

  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse h-32" />
        ))}
      </div>
    );
  }

  const active = knownConfig.filter((w) => w.active);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-900">More Insights</p>
        <button
          onClick={() => setCustomizing((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800"
        >
          <Cog6ToothIcon className="w-3.5 h-3.5" />
          Customize
        </button>
      </div>

      {customizing && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
          <div className="grid grid-cols-2 gap-2">
            {knownConfig.map((w) => (
              <label key={w.key} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={w.active}
                  onChange={(e) => handleToggle(w.key, e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                {WIDGET_META[w.key].label}
              </label>
            ))}
          </div>
        </div>
      )}

      {active.length === 0 ? (
        <p className="text-sm text-gray-400">No widgets pinned — click Customize to add some.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {active.map((w) => {
            const meta = WIDGET_META[w.key];
            if (w.key === 'mostViewedProducts') {
              return <ListWidget key={w.key} label={meta.label} icon={meta.icon} items={data.mostViewedProducts} empty="No view data yet" />;
            }
            return <ListWidget key={w.key} label={meta.label} icon={meta.icon} items={data.mostTriedOnProducts} empty="No try-on data yet" />;
          })}
        </div>
      )}
    </div>
  );
};

export default PinnedWidgets;
