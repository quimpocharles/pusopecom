import { useState, useMemo } from 'react';
import DateRangeSelector, { getDateRange } from '../../components/admin/reports/DateRangeSelector';
import SalesSection from '../../components/admin/reports/SalesSection';
import ProductsSection from '../../components/admin/reports/ProductsSection';
import OrdersSection from '../../components/admin/reports/OrdersSection';
import CustomersSection from '../../components/admin/reports/CustomersSection';
import TryOnSection from '../../components/admin/reports/TryOnSection';

const AdminReports = () => {
  const [selectedPreset, setSelectedPreset] = useState('30d');
  const [dateRange, setDateRange] = useState(() => getDateRange('30d'));

  const handleSelect = (preset, range) => {
    setSelectedPreset(preset);
    setDateRange(range);
  };

  // Stable params object that only changes when dateRange changes
  const dateParams = useMemo(() => {
    const params = {};
    if (dateRange.startDate) params.startDate = dateRange.startDate;
    if (dateRange.endDate) params.endDate = dateRange.endDate;
    return params;
  }, [dateRange.startDate, dateRange.endDate]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <DateRangeSelector selected={selectedPreset} onSelect={handleSelect} />
      </div>

      <SalesSection dateParams={dateParams} />
      <ProductsSection dateParams={dateParams} />
      <OrdersSection dateParams={dateParams} />
      <CustomersSection dateParams={dateParams} />
      <TryOnSection dateParams={dateParams} />
    </div>
  );
};

export default AdminReports;
