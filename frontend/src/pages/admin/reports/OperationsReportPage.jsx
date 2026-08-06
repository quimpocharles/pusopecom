import { useState, useMemo } from 'react';
import DateRangeSelector, { getDateRange } from '../../../components/admin/reports/DateRangeSelector';
import OrdersSection from '../../../components/admin/reports/OrdersSection';
import ShippingSection from '../../../components/admin/reports/ShippingSection';
import CheckoutRecoverySection from '../../../components/admin/reports/CheckoutRecoverySection';

// Folds in what used to be three separate places: OrdersSection (was on
// the old flat AdminReports page), the standalone AdminShippingReports
// page (now ShippingSection), and CheckoutRecoverySection — which already
// includes its own Webhook Health panel, so nothing extra was needed for
// that piece. One shared date range across all three, replacing
// AdminShippingReports' own independent DateRangeSelector state.
const OperationsReportPage = () => {
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
    <div className="space-y-8">
      <div className="flex justify-end">
        <DateRangeSelector selected={selectedPreset} onSelect={handleSelect} />
      </div>
      <OrdersSection dateParams={dateParams} />
      <ShippingSection dateParams={dateParams} />
      <CheckoutRecoverySection dateParams={dateParams} />
    </div>
  );
};

export default OperationsReportPage;
