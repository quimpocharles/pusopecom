import { useState, useEffect } from 'react';
import pickupService from '../../services/pickupService';

// Format an ISO date string or YYYY-MM-DD value for the preview label
const formatPreviewDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    // Append T00:00:00 so the date isn't shifted by timezone
    const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

// ── Toggle Switch ────────────────────────────────────────────────────────────
const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#0a0a0a] focus:ring-offset-2 ${
      checked ? 'bg-[#0a0a0a]' : 'bg-gray-200'
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

// ── Preview Card (mirrors DeliveryCard from Checkout) ────────────────────────
const PickupPreviewCard = ({ form }) => {
  const desc = [
    form.venueName,
    formatPreviewDate(form.pickupDate),
    form.pickupHours,
  ].filter(Boolean).join(' · ');

  const isPastDate =
    form.pickupDate && new Date(form.pickupDate + 'T23:59:59') < new Date();

  const effectivelyEnabled = form.enabled && !isPastDate;

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Preview at Checkout
      </h2>

      {isPastDate && form.enabled && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          ⚠ Pick-up date is in the past — this option will be automatically hidden from buyers.
        </p>
      )}

      <div
        className={`border rounded-xl p-4 flex items-start gap-3 transition-all ${
          effectivelyEnabled
            ? 'border-[#0a0a0a] bg-gray-50'
            : 'border-gray-200 opacity-50'
        }`}
      >
        {/* Radio dot */}
        <span
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
            effectivelyEnabled ? 'border-[#0a0a0a]' : 'border-gray-300'
          }`}
        >
          {effectivelyEnabled && (
            <span className="w-2.5 h-2.5 rounded-full bg-[#0a0a0a]" />
          )}
        </span>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900">Pick Up at Venue</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {desc || 'Venue details will appear here once filled in'}
          </p>
          {form.specialInstructions && (
            <p className="text-xs text-gray-400 italic mt-1">{form.specialInstructions}</p>
          )}
        </div>

        {/* Price */}
        <div className="flex-shrink-0">
          <span className="text-sm font-semibold text-green-600">FREE</span>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-2">
        This option is only shown to buyers who select Philippines as their country.
      </p>
    </div>
  );
};

// ── Main Page ────────────────────────────────────────────────────────────────
const AdminPickup = () => {
  const [form, setForm] = useState({
    enabled:             false,
    venueName:           '',
    venueAddress:        '',
    pickupDate:          '',
    pickupHours:         '',
    specialInstructions: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    pickupService.getPickupConfig()
      .then(res => {
        if (res.data) {
          setForm({
            enabled:             res.data.enabled             || false,
            venueName:           res.data.venueName           || '',
            venueAddress:        res.data.venueAddress        || '',
            // Format ISO date → YYYY-MM-DD for the date input
            pickupDate:          res.data.pickupDate
              ? new Date(res.data.pickupDate).toISOString().split('T')[0]
              : '',
            pickupHours:         res.data.pickupHours         || '',
            specialInstructions: res.data.specialInstructions || '',
          });
        }
      })
      .catch(() => setMessage({ type: 'error', text: 'Failed to load current configuration' }))
      .finally(() => setLoading(false));
  }, []);

  const set = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await pickupService.updatePickupConfig(form);
      setMessage({ type: 'success', text: 'Venue pick-up settings saved successfully.' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to save settings.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">Loading…</div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Venue Pick-Up</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure a venue pick-up option at checkout. Automatically hidden when the
          pick-up date has passed or when the buyer's country is not Philippines.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* ── Enable / Disable toggle ── */}
        <div className="card p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Enable Venue Pick-Up</p>
              <p className="text-xs text-gray-500 mt-0.5">
                When ON, buyers in Philippines can choose pick-up at checkout
              </p>
            </div>
            <Toggle
              checked={form.enabled}
              onChange={() => setForm((f) => ({ ...f, enabled: !f.enabled }))}
            />
          </div>
        </div>

        {/* ── Venue details ── */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Venue Details</h2>

          {/* fieldset disables all inputs when toggle is off */}
          <fieldset
            disabled={!form.enabled}
            className={`space-y-4 transition-opacity ${!form.enabled ? 'opacity-50' : ''}`}
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Venue Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.venueName}
                onChange={set('venueName')}
                required={form.enabled}
                placeholder="e.g. Smart Araneta Coliseum"
                className="input-field disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Venue Address <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.venueAddress}
                onChange={set('venueAddress')}
                required={form.enabled}
                rows={2}
                placeholder="e.g. Araneta City, Cubao, Quezon City"
                className="input-field disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pick-Up Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.pickupDate}
                  onChange={set('pickupDate')}
                  required={form.enabled}
                  className="input-field disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pick-Up Hours <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.pickupHours}
                  onChange={set('pickupHours')}
                  required={form.enabled}
                  placeholder="e.g. 3:00 PM – 9:00 PM"
                  className="input-field disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Special Instructions <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={form.specialInstructions}
                onChange={set('specialInstructions')}
                rows={2}
                placeholder="e.g. Please bring your order confirmation email."
                className="input-field disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
          </fieldset>
        </div>

        {/* ── Live preview ── */}
        <div className="card p-6">
          <PickupPreviewCard form={form} />
        </div>

        {/* ── Status message ── */}
        {message && (
          <div
            className={`px-4 py-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* ── Save ── */}
        <div>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminPickup;
