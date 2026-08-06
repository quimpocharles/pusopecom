import ReportRecipients from '../../../components/admin/reports/ReportRecipients';
import ReportSchedules from '../../../components/admin/reports/ReportSchedules';
import PlaceholderSection from '../../../components/admin/settings/PlaceholderSection';

// Relocated from the Reports page — "who gets the report" and "on what
// cadence" are Settings concerns; "browse what was already sent" stays on
// Reports. Both components are self-contained (their own fetch/add/remove
// against the existing report endpoints), so nothing here needs the
// shared dirty-tracking/save-bar pattern.
const NotificationSettings = () => {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Notifications</h2>
      <p className="text-sm text-gray-500 mb-6">Who gets automated reports, on what cadence, and how.</p>

      <div className="space-y-8">
        <section>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Scheduled Reports</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ReportRecipients />
            <ReportSchedules />
          </div>
        </section>

        <section className="pt-8 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Email Templates</h3>
          <PlaceholderSection
            title="Order, payment & notification email templates"
            description="Not yet configurable — every transactional email is a hardcoded template in code today."
          />
        </section>
      </div>
    </div>
  );
};

export default NotificationSettings;
