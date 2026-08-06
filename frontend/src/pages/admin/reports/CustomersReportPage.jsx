import { useState, useMemo } from 'react';
import DateRangeSelector, { getDateRange } from '../../../components/admin/reports/DateRangeSelector';
import CustomersSection from '../../../components/admin/reports/CustomersSection';

const CustomersReportPage = () => {
  const [selectedPreset, setSelectedPreset] = useState('30d');
  const [dateRange, setDateRange] = useState(() => getDateRange('30d'));

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

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <DateRangeSelector selected={selectedPreset} onSelect={handleSelect} />
      </div>
      <CustomersSection dateParams={dateParams} />
    </div>
  );
};

export default CustomersReportPage;
