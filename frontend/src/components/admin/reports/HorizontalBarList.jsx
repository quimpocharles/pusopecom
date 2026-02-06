const formatNumber = (num) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
};

const HorizontalBarList = ({ items, labelKey, valueKey, formatValue, maxItems = 10, color = 'bg-primary-500' }) => {
  if (!items || items.length === 0) {
    return <p className="text-sm text-gray-500">No data available</p>;
  }

  const displayItems = items.slice(0, maxItems);
  const maxValue = Math.max(...displayItems.map(item => item[valueKey] || 0));

  return (
    <div className="space-y-3">
      {displayItems.map((item, index) => {
        const value = item[valueKey] || 0;
        const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
        const label = item[labelKey] || 'Unknown';
        const displayValue = formatValue ? formatValue(value) : formatNumber(value);

        return (
          <div key={`${label}-${index}`}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-gray-700 truncate mr-2">
                {label}
              </span>
              <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                {displayValue}
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`${color} h-2 rounded-full transition-all duration-500`}
                style={{ width: `${Math.max(percentage, 1)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default HorizontalBarList;
