import { useState } from 'react';

// Order matches the spec's date-filtering section exactly (Today ... Year
// To Date), with the pre-existing 3 Months/All Time presets kept afterward
// rather than removed — nothing already relying on those two breaks.
const presets = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'This Month', value: 'thisMonth' },
  { label: 'Last Month', value: 'lastMonth' },
  { label: 'Year to Date', value: 'ytd' },
  { label: '3 Months', value: '3m' },
  { label: 'All Time', value: 'all' },
];

const toISODate = (date) => date.toISOString().split('T')[0];

function getDateRange(preset) {
  const now = new Date();
  let startDate = null;
  let endDate = toISODate(now);

  switch (preset) {
    case 'today': {
      startDate = toISODate(now);
      break;
    }
    case 'yesterday': {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      startDate = toISODate(d);
      endDate = startDate;
      break;
    }
    case '7d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      startDate = toISODate(d);
      break;
    }
    case '30d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      startDate = toISODate(d);
      break;
    }
    case 'thisMonth': {
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      break;
    }
    case 'lastMonth': {
      // Built in UTC, matching toISODate's own UTC-based toISOString() read —
      // mixing local-time construction with a UTC read is what shifts the
      // date by a day depending on the machine's timezone offset.
      const lastMonthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0)); // day 0 = last day of previous month
      const lastMonthStart = new Date(Date.UTC(lastMonthEnd.getUTCFullYear(), lastMonthEnd.getUTCMonth(), 1));
      startDate = toISODate(lastMonthStart);
      endDate = toISODate(lastMonthEnd);
      break;
    }
    case 'ytd': {
      startDate = `${now.getFullYear()}-01-01`;
      break;
    }
    case '3m': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      startDate = toISODate(d);
      break;
    }
    case 'all':
    default:
      startDate = null;
      endDate = null;
      break;
  }

  return { startDate, endDate };
}

const buttonClass = (active) =>
  `px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
    active ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
  }`;

const DateRangeSelector = ({ selected, onSelect }) => {
  const [showCustom, setShowCustom] = useState(selected === 'custom');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const handlePresetClick = (preset) => {
    setShowCustom(false);
    onSelect(preset.value, getDateRange(preset.value));
  };

  const applyCustomRange = () => {
    if (customStart && customEnd) {
      onSelect('custom', { startDate: customStart, endDate: customEnd });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.value}
            onClick={() => handlePresetClick(preset)}
            className={buttonClass(selected === preset.value)}
          >
            {preset.label}
          </button>
        ))}
        <button onClick={() => setShowCustom(true)} className={buttonClass(selected === 'custom')}>
          Custom Range
        </button>
      </div>

      {showCustom && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            max={customEnd || undefined}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <span className="text-sm text-gray-500">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            min={customStart || undefined}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            onClick={applyCustomRange}
            disabled={!customStart || !customEnd}
            className="px-3 py-1.5 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
};

export { getDateRange };
export default DateRangeSelector;
