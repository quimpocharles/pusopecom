const presets = [
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: 'This Month', value: 'thisMonth' },
  { label: '3 Months', value: '3m' },
  { label: 'All Time', value: 'all' },
];

function getDateRange(preset) {
  const now = new Date();
  let startDate = null;
  let endDate = now.toISOString().split('T')[0];

  switch (preset) {
    case '7d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      startDate = d.toISOString().split('T')[0];
      break;
    }
    case '30d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      startDate = d.toISOString().split('T')[0];
      break;
    }
    case 'thisMonth': {
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      break;
    }
    case '3m': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      startDate = d.toISOString().split('T')[0];
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

const DateRangeSelector = ({ selected, onSelect }) => {
  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((preset) => (
        <button
          key={preset.value}
          onClick={() => onSelect(preset.value, getDateRange(preset.value))}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            selected === preset.value
              ? 'bg-primary-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
};

export { getDateRange };
export default DateRangeSelector;
