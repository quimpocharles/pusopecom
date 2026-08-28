import { useState, useEffect, useCallback, useMemo } from 'react';
import staffService from '../../../services/staffService';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import PlaceholderSection from '../../../components/admin/settings/PlaceholderSection';
import Modal from '../../../components/ui/Modal';
import Toast from '../../../components/admin/settings/Toast';
import useToast from '../../../components/admin/settings/useToast';

const DEPARTMENTS = ['warehouse', 'support', 'finance', 'operations', 'marketing', 'executive', 'scanner', 'order_management'];

// Every existing department has always displayed as its raw value here —
// no label map existed before this. Rather than restyle departments nobody
// asked to change, this only translates the two new ones (their raw enum
// values, `scanner`/`order_management`, aren't names an admin should have
// to parse) and falls through to the raw string for everything else,
// exactly matching prior behavior.
const DEPARTMENT_LABEL = { scanner: 'Scanner', order_management: 'Order Management' };
const departmentLabel = (d) => DEPARTMENT_LABEL[d] || d;

// Presentation-only grouping — the permission strings themselves come from
// the backend (staffService.getPermissionVocabulary, backed by
// lib/permissions.js) so this page can never drift from what
// requirePermission() actually enforces. This just decides how to lay them
// out in the picker.
const GROUP_FOR = (permission) => {
  if (permission.startsWith('reports.')) return 'Reports';
  if (permission.startsWith('settings.')) return 'Settings';
  if (['orders.', 'fulfillment.', 'returns.'].some((p) => permission.startsWith(p))) return 'Commerce & Fulfillment';
  if (permission.startsWith('users.')) return 'People';
  return 'Catalog & Content';
};

const GROUP_ORDER = ['Catalog & Content', 'Commerce & Fulfillment', 'People', 'Reports', 'Settings'];

// Roles module, Phase 1 — StaffProfile (department + permissions) existed
// since the Enterprise Fulfillment Blueprint but nothing ever enforced it;
// every admin-role account had identical access. This page is now the real
// editor for what requirePermission() checks. `department` sets a default
// permission bundle; `permissions` on top of it is additive — an admin can
// hold more than their department's defaults, never fewer, without a
// department change. The picker below always shows the union (defaults +
// overrides) and saves back only what's *not* already implied by the
// department default, so the stored `permissions` array stays a true
// "extra, on top of" list rather than a duplicate of the defaults.
const SecuritySettings = () => {
  const { toast, showToast, dismissToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [departmentDefaults, setDepartmentDefaults] = useState({});
  const [savingUserId, setSavingUserId] = useState(null);
  const [editing, setEditing] = useState(null); // the row currently open in the permission picker

  const load = useCallback(async () => {
    try {
      const [staffRes, vocabRes] = await Promise.all([
        staffService.getStaff(),
        staffService.getPermissionVocabulary(),
      ]);
      setRows(staffRes.data.map((s) => ({
        ...s,
        department: s.staffProfile?.department || '',
        permissions: s.staffProfile?.permissions || [],
      })));
      setAllPermissions(vocabRes.data.permissions);
      setDepartmentDefaults(vocabRes.data.departmentDefaults);
    } catch (error) {
      console.error('Failed to load staff:', error);
      showToast('error', 'Failed to load staff list');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const defaultsFor = useCallback(
    (department) => new Set(departmentDefaults[department] || []),
    [departmentDefaults]
  );

  const updateDepartment = (userId, department) =>
    setRows((prev) => prev.map((r) => (r.userId === userId ? { ...r, department } : r)));

  const handleSaveRow = async (row) => {
    if (!row.department) {
      showToast('error', 'Select a department before saving');
      return;
    }
    setSavingUserId(row.userId);
    try {
      await staffService.updateStaff(row.userId, { department: row.department, permissions: row.permissions });
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
          <p className="text-xs text-gray-500 mb-4">
            Department sets a default set of permissions; an account can hold more than its department's
            defaults, never fewer, without changing department. An account with no department is treated
            as executive (full access) — assign a department to narrow it.
          </p>

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
                  {rows.map((row) => {
                    const effective = new Set([...defaultsFor(row.department), ...row.permissions]);
                    const isExecutive = row.department === 'executive';
                    return (
                      <tr key={row.userId}>
                        <td className="px-4 py-2.5 whitespace-nowrap">{row.firstName} {row.lastName}</td>
                        <td className="px-4 py-2.5 text-gray-500">{row.email}</td>
                        <td className="px-4 py-2.5">
                          <select
                            value={row.department}
                            onChange={(e) => updateDepartment(row.userId, e.target.value)}
                            className="input-field py-1.5 text-sm"
                          >
                            <option value="">Unassigned (full access)</option>
                            {DEPARTMENTS.map((d) => <option key={d} value={d}>{departmentLabel(d)}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2.5">
                          {isExecutive ? (
                            <span className="text-xs text-gray-400">Everything — executive</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditing(row)}
                              disabled={!row.department}
                              className="text-xs font-medium text-primary-600 hover:text-primary-700 disabled:text-gray-300 disabled:cursor-not-allowed"
                            >
                              {effective.size} permission{effective.size === 1 ? '' : 's'} — edit
                            </button>
                          )}
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
                    );
                  })}
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

      <PermissionPickerModal
        row={editing}
        allPermissions={allPermissions}
        departmentDefault={editing ? defaultsFor(editing.department) : new Set()}
        onClose={() => setEditing(null)}
        onChange={(permissions) => {
          setRows((prev) => prev.map((r) => (r.userId === editing.userId ? { ...r, permissions } : r)));
          setEditing(null);
        }}
      />

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
};

const PermissionPickerModal = ({ row, allPermissions, departmentDefault, onClose, onChange }) => {
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    if (row) setSelected(new Set([...departmentDefault, ...row.permissions]));
  }, [row, departmentDefault]);

  const grouped = useMemo(() => {
    const groups = {};
    for (const p of allPermissions) {
      const g = GROUP_FOR(p);
      (groups[g] ||= []).push(p);
    }
    return groups;
  }, [allPermissions]);

  if (!row) return null;

  const toggle = (permission) => {
    if (departmentDefault.has(permission)) return; // department defaults aren't individually removable here — change department instead
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return next;
    });
  };

  const handleSave = () => {
    // Only store what's genuinely additive — permissions already implied
    // by the department default don't need to be duplicated in the row.
    const additive = [...selected].filter((p) => !departmentDefault.has(p));
    onChange(additive);
  };

  return (
    <Modal open={!!row} onClose={onClose} title={`Permissions — ${row.firstName} ${row.lastName}`} size="lg">
      <div className="p-4">
        <p className="text-xs text-gray-500 mb-4">
          Greyed-out, checked permissions come from the <strong>{departmentLabel(row.department)}</strong> department default and can't
          be removed here — change department to change those. Anything else is an individual addition.
        </p>
        <div className="space-y-5 max-h-96 overflow-y-auto pr-1">
          {GROUP_ORDER.filter((g) => grouped[g]?.length).map((group) => (
            <div key={group}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{group}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {grouped[group].map((permission) => {
                  const fromDepartment = departmentDefault.has(permission);
                  return (
                    <label
                      key={permission}
                      className={`flex items-center gap-2 text-sm px-2 py-1 rounded ${fromDepartment ? 'text-gray-400' : 'text-gray-700 hover:bg-gray-50 cursor-pointer'}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(permission)}
                        disabled={fromDepartment}
                        onChange={() => toggle(permission)}
                        className="rounded border-gray-300"
                      />
                      <span className="font-mono text-xs">{permission}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-4 mt-2 border-t border-gray-100">
          <button onClick={onClose} className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900">
            Cancel
          </button>
          <button onClick={handleSave} className="px-3 py-1.5 bg-primary-600 text-white rounded text-xs font-medium hover:bg-primary-700">
            Apply
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default SecuritySettings;
