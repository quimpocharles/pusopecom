import { useState, useEffect, useCallback } from 'react';
import staffService from '../../../services/staffService';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import PlaceholderSection from '../../../components/admin/settings/PlaceholderSection';
import Toast from '../../../components/admin/settings/Toast';
import useToast from '../../../components/admin/settings/useToast';

const DEPARTMENTS = ['warehouse', 'support', 'finance', 'operations', 'marketing', 'executive'];

// The first real UI ever built for StaffProfile — the model and its
// repository existed since the Enterprise Fulfillment Blueprint, but no
// route or page ever reached it. Each admin's row saves independently
// (not a single form-wide save/cancel) — the same "self-contained per
// item" pattern ReportRecipients already uses, since these are genuinely
// separate records, not one settings object.
const SecuritySettings = () => {
  const { toast, showToast, dismissToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [savingUserId, setSavingUserId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await staffService.getStaff();
      setRows(res.data.map((s) => ({
        ...s,
        department: s.staffProfile?.department || '',
        permissions: (s.staffProfile?.permissions || []).join(', '),
      })));
    } catch (error) {
      console.error('Failed to load staff:', error);
      showToast('error', 'Failed to load staff list');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const updateRow = (userId, field, value) =>
    setRows((prev) => prev.map((r) => (r.userId === userId ? { ...r, [field]: value } : r)));

  const handleSaveRow = async (row) => {
    if (!row.department) {
      showToast('error', 'Select a department before saving');
      return;
    }
    setSavingUserId(row.userId);
    try {
      const permissions = row.permissions.split(',').map((p) => p.trim()).filter(Boolean);
      await staffService.updateStaff(row.userId, { department: row.department, permissions });
      showToast('success', `Updated ${row.firstName} ${row.lastName}`);
      await load();
    } catch (error) {
      console.error('Failed to update staff profile:', error);
      showToast('error', error.response?.data?.message || 'Failed to save');
    } finally {
      setSavingUserId(null);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Security</h2>
      <p className="text-sm text-gray-500 mb-6">Who has admin access, what they can do, and how sessions are protected.</p>

      <div className="space-y-8">
        <section>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Roles & Permissions</h3>
          <p className="text-xs text-gray-500 mb-4">Every admin-role account, scoped by department and an explicit permission list. Unassigned accounts still have admin access — assigning a department here doesn't change that.</p>

          {rows.length === 0 ? (
            <p className="text-sm text-gray-400">No admin accounts found.</p>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Email</th>
                    <th className="px-4 py-2.5">Department</th>
                    <th className="px-4 py-2.5">Permissions</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row) => (
                    <tr key={row.userId}>
                      <td className="px-4 py-2.5 whitespace-nowrap">{row.firstName} {row.lastName}</td>
                      <td className="px-4 py-2.5 text-gray-500">{row.email}</td>
                      <td className="px-4 py-2.5">
                        <select
                          value={row.department}
                          onChange={(e) => updateRow(row.userId, 'department', e.target.value)}
                          className="input-field py-1.5 text-sm"
                        >
                          <option value="">Unassigned</option>
                          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={row.permissions}
                          onChange={(e) => updateRow(row.userId, 'permissions', e.target.value)}
                          placeholder="can_assign, can_refund"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => handleSaveRow(row)}
                          disabled={savingUserId === row.userId}
                          className="px-3 py-1.5 bg-primary-600 text-white rounded text-xs font-medium hover:bg-primary-700 disabled:opacity-50 whitespace-nowrap"
                        >
                          {savingUserId === row.userId ? 'Saving…' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="pt-8 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Session & Access</h3>
          <div className="space-y-3">
            <PlaceholderSection title="Session Timeout" description="Sessions currently expire on a fixed 7-day schedule, not admin-configurable." />
            <PlaceholderSection title="API Keys" description="No platform API key system exists yet." />
          </div>
        </section>
      </div>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
};

export default SecuritySettings;
