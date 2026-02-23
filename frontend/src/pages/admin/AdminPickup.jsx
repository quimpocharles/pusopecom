import { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import pickupService from '../../services/pickupService';

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatSlotDate = (dateStr) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Compute whether the slot deadline has passed (mirrors backend isSlotActive)
const computeDeadlineLabel = (slot, deadlineHours) => {
  if (!slot.pickupDate || !slot.pickupStartTime) return null;
  const [year, month, day] = slot.pickupDate.split('-').map(Number);
  const [h, m] = slot.pickupStartTime.split(':').map(Number);
  const slotStartUtcMs = Date.UTC(year, month - 1, day, h - 8, m);
  const deadlineMs = slotStartUtcMs - deadlineHours * 3_600_000;
  const deadlineDate = new Date(deadlineMs);
  // Convert UTC deadline back to PHT for display
  const phtOffset = 8 * 60;
  const phtMs = deadlineMs + phtOffset * 60_000;
  const phtDate = new Date(phtMs);
  const label = phtDate.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const isPast = Date.now() >= deadlineMs;
  return { label, isPast };
};

// ── Toggle Switch ─────────────────────────────────────────────────────────────

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

// ── Slot Card ─────────────────────────────────────────────────────────────────

const SlotCard = ({ slot, index, deadlineHours, onChange, onRemove }) => {
  const deadline = computeDeadlineLabel(slot, deadlineHours);

  const set = (field) => (e) => onChange(index, { ...slot, [field]: e.target.value });
  const setEnabled = () => onChange(index, { ...slot, enabled: !slot.enabled });

  return (
    <div className={`border rounded-xl p-5 space-y-4 transition-opacity ${!slot.enabled ? 'opacity-60' : ''}`}>
      {/* Slot header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Toggle checked={slot.enabled} onChange={setEnabled} />
          <span className="text-sm font-semibold text-gray-900">
            Slot {index + 1}
            {slot.pickupDate && (
              <span className="ml-2 text-gray-500 font-normal">
                — {formatSlotDate(slot.pickupDate)}
                {slot.pickupHours ? ` · ${slot.pickupHours}` : ''}
              </span>
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="Remove slot"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Deadline badge */}
      {deadline && (
        <p className={`text-xs rounded-lg px-3 py-2 ${
          deadline.isPast
            ? 'bg-red-50 text-red-600 border border-red-200'
            : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          {deadline.isPast
            ? `⛔ Deadline passed — hidden from buyers (was ${deadline.label} PHT)`
            : `⏰ Deadline: ${deadline.label} PHT (${deadlineHours}h before start)`}
        </p>
      )}

      <fieldset disabled={!slot.enabled} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pick-Up Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={slot.pickupDate}
              onChange={set('pickupDate')}
              required={slot.enabled}
              className="input-field disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Time (PHT) <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              value={slot.pickupStartTime}
              onChange={set('pickupStartTime')}
              required={slot.enabled}
              className="input-field disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">Used to compute the deadline</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Display Hours <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={slot.pickupHours}
            onChange={set('pickupHours')}
            required={slot.enabled}
            placeholder="e.g. 3:00 PM – 9:00 PM"
            className="input-field disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-gray-400 mt-1">Shown to buyers at checkout</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Special Instructions <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={slot.specialInstructions}
            onChange={set('specialInstructions')}
            rows={2}
            placeholder="e.g. Please bring your order confirmation email."
            className="input-field disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>
      </fieldset>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const BLANK_SLOT = () => ({
  pickupDate:          '',
  pickupHours:         '',
  pickupStartTime:     '',
  specialInstructions: '',
  enabled:             true,
});

const AdminPickup = () => {
  const [form, setForm] = useState({
    enabled:       false,
    venueName:     '',
    venueAddress:  '',
    deadlineHours: 6,
    slots:         [],
  });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    pickupService.getPickupConfig()
      .then(res => {
        if (res.data) {
          setForm({
            enabled:       res.data.enabled       ?? false,
            venueName:     res.data.venueName     || '',
            venueAddress:  res.data.venueAddress  || '',
            deadlineHours: res.data.deadlineHours ?? 6,
            slots:         (res.data.slots || []).map(s => ({
              pickupDate:          s.pickupDate          || '',
              pickupHours:         s.pickupHours         || '',
              pickupStartTime:     s.pickupStartTime     || '',
              specialInstructions: s.specialInstructions || '',
              enabled:             s.enabled             ?? true,
            })),
          });
        }
      })
      .catch(() => setMessage({ type: 'error', text: 'Failed to load current configuration' }))
      .finally(() => setLoading(false));
  }, []);

  const setRoot = (field) => (e) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const addSlot = () =>
    setForm(f => ({ ...f, slots: [...f.slots, BLANK_SLOT()] }));

  const updateSlot = (i, updated) =>
    setForm(f => ({ ...f, slots: f.slots.map((s, idx) => idx === i ? updated : s) }));

  const removeSlot = (i) =>
    setForm(f => ({ ...f, slots: f.slots.filter((_, idx) => idx !== i) }));

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
    return <div className="flex items-center justify-center py-20 text-gray-400">Loading…</div>;
  }

  const activeSlotCount = form.slots.filter(s => {
    if (!s.enabled) return false;
    const d = computeDeadlineLabel(s, form.deadlineHours);
    return d && !d.isPast;
  }).length;

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Venue Pick-Up</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure pick-up slots at checkout. Each slot has its own date and time.
          A slot is automatically hidden when its deadline passes.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* ── Enable / Disable toggle ── */}
        <div className="card p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Enable Venue Pick-Up</p>
              <p className="text-xs text-gray-500 mt-0.5">
                When ON, buyers in Philippines see active slots at checkout
                {activeSlotCount > 0 && (
                  <span className="ml-1 text-green-600 font-medium">
                    · {activeSlotCount} active slot{activeSlotCount !== 1 ? 's' : ''}
                  </span>
                )}
              </p>
            </div>
            <Toggle
              checked={form.enabled}
              onChange={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
            />
          </div>
        </div>

        {/* ── Venue-level details ── */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Venue Details</h2>
          <p className="text-xs text-gray-500 -mt-2">Shared across all slots</p>

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
                onChange={setRoot('venueName')}
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
                onChange={setRoot('venueAddress')}
                required={form.enabled}
                rows={2}
                placeholder="e.g. Araneta City, Cubao, Quezon City"
                className="input-field disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Slot Deadline
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="72"
                  value={form.deadlineHours}
                  onChange={(e) => setForm(f => ({ ...f, deadlineHours: Number(e.target.value) || 6 }))}
                  className="input-field w-24 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <span className="text-sm text-gray-600">hours before slot start time</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Slots are automatically hidden from buyers this many hours before they start.
              </p>
            </div>
          </fieldset>
        </div>

        {/* ── Slots ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Pick-Up Slots ({form.slots.length})</h2>
            <button
              type="button"
              onClick={addSlot}
              disabled={!form.enabled}
              className="flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:text-primary-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <PlusIcon className="w-4 h-4" />
              Add Slot
            </button>
          </div>

          {form.slots.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400">
              <p className="text-sm">No pick-up slots yet.</p>
              <p className="text-xs mt-1">Click "Add Slot" to create one.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {form.slots.map((slot, i) => (
                <SlotCard
                  key={i}
                  slot={slot}
                  index={i}
                  deadlineHours={form.deadlineHours}
                  onChange={updateSlot}
                  onRemove={removeSlot}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Status message ── */}
        {message && (
          <div className={`px-4 py-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* ── Save ── */}
        <div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminPickup;
