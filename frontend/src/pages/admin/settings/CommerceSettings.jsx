import { useState, useEffect, useCallback } from 'react';
import settingsService from '../../../services/settingsService';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import { useSettingsDirty } from '../../../components/admin/settings/SettingsDirtyContext';
import SettingsSaveBar from '../../../components/admin/settings/SettingsSaveBar';
import PlaceholderSection from '../../../components/admin/settings/PlaceholderSection';
import VenuePickupSection from '../../../components/admin/settings/VenuePickupSection';
import Toast from '../../../components/admin/settings/Toast';
import useToast from '../../../components/admin/settings/useToast';

const DEFAULTS = { orderExpirationEnabled: true, orderRetentionHours: 48 };

const CommerceSettings = () => {
  const { setIsDirty } = useSettingsDirty();
  const { toast, showToast, dismissToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState({ updatedAt: null, updatedBy: null });
  const [saved, setSaved] = useState(DEFAULTS);
  const [draft, setDraft] = useState(DEFAULTS);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useEffect(() => { setIsDirty(dirty); }, [dirty, setIsDirty]);

  const load = useCallback(async () => {
    try {
      const res = await settingsService.getSettings();
      const next = {
        orderExpirationEnabled: res.data?.payment?.orderExpirationEnabled ?? true,
        orderRetentionHours: res.data?.payment?.orderRetentionHours ?? 48,
      };
      setSaved(next);
      setDraft(next);
      setMeta({ updatedAt: res.data?.updatedAt, updatedBy: res.data?.updatedBy });
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      showToast('error', 'Failed to load Commerce settings');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await settingsService.updateSettings({ payment: draft });
      setSaved(draft);
      setMeta({ updatedAt: res.data?.updatedAt, updatedBy: res.data?.updatedBy });
      showToast('success', 'Commerce settings saved');
    } catch (error) {
      console.error('Failed to save settings:', error);
      showToast('error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => setDraft(saved);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Commerce</h2>
      <p className="text-sm text-gray-500 mb-6">Order expiration, venue pickup, and what's coming next.</p>

      <div className="space-y-8">
        {/* Order Expiration */}
        <section>
          <div className="flex items-start justify-between gap-4 mb-1">
            <h3 className="text-sm font-semibold text-gray-900">Order Expiration</h3>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.orderExpirationEnabled}
                onChange={(e) => setDraft((d) => ({ ...d, orderExpirationEnabled: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Enabled</span>
            </label>
          </div>
          <p className="text-xs text-gray-500 mb-4">How long an unpaid order stays recoverable before it's marked Expired and its reserved stock is released.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Retention window (hours)</label>
            <input
              type="number"
              min="1"
              disabled={!draft.orderExpirationEnabled}
              value={draft.orderRetentionHours}
              onChange={(e) => setDraft((d) => ({ ...d, orderRetentionHours: Number(e.target.value) }))}
              className="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Checked hourly. Inventory reservation uses this same window today — there's no separate reservation-window setting yet, despite reading like one.
            </p>
          </div>
        </section>

        {/* Venue Pickup */}
        <section className="pt-8 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Venue Pickup</h3>
          <p className="text-xs text-gray-500 mb-4">Configure pick-up slots at checkout. Relocated here from its own top-level nav item — same settings, same behavior.</p>
          <VenuePickupSection />
        </section>

        {/* Reserved for later */}
        <section className="pt-8 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Reserved for later</h3>
          <div className="space-y-3">
            <PlaceholderSection title="Payment Providers" description="Maya is configured via environment variables today — no admin-managed provider list yet." />
            <PlaceholderSection title="Shipping Defaults" description="Shipping rates are computed in code today — no admin-configurable defaults yet." />
            <PlaceholderSection title="Return Window" description="No admin-configurable return eligibility window yet." />
            <PlaceholderSection title="Tax Settings" description="No tax configuration exists yet." />
          </div>
        </section>
      </div>

      <SettingsSaveBar dirty={dirty} saving={saving} onSave={handleSave} onCancel={handleCancel} updatedAt={meta.updatedAt} updatedBy={meta.updatedBy} />
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
};

export default CommerceSettings;
