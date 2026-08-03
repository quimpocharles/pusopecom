import { useState, useEffect } from 'react';
import reportService from '../../../services/reportService';

const FREQUENCY_LABELS = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};

const FREQUENCY_DESCRIPTIONS = {
  daily: 'Every day, 5:00 AM — covers the prior day',
  weekly: 'Every Monday, 5:00 AM — covers the past 7 days',
  monthly: '1st of the month, 5:00 AM — covers the previous month',
  quarterly: '1st of Jan/Apr/Jul/Oct, 5:00 AM — covers the previous quarter',
};

// Toggle-only — the actual send time for each cadence is fixed (see
// server.js's cron definitions), not admin-editable. See ReportSchedule's
// schema comment for why.
const ReportSchedules = () => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportService.getSchedules()
      .then((res) => setSchedules(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (frequency, active) => {
    setSchedules((prev) => prev.map((s) => (s.frequency === frequency ? { ...s, active } : s)));
    try {
      await reportService.setScheduleActive(frequency, active);
    } catch (error) {
      console.error(`Failed to update ${frequency} schedule:`, error);
      setSchedules((prev) => prev.map((s) => (s.frequency === frequency ? { ...s, active: !active } : s)));
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-1">Report Delivery Schedule</h2>
      <p className="text-sm text-gray-500 mb-4">Turn each Business Report cadence on or off.</p>

      {loading ? (
        <div className="w-5 h-5 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      ) : (
        <ul className="divide-y divide-gray-100">
          {schedules.map((s) => (
            <li key={s.frequency} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{FREQUENCY_LABELS[s.frequency]}</p>
                <p className="text-xs text-gray-500">{FREQUENCY_DESCRIPTIONS[s.frequency]}</p>
              </div>
              <button
                role="switch"
                aria-checked={s.active}
                onClick={() => handleToggle(s.frequency, !s.active)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  s.active ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    s.active ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ReportSchedules;
