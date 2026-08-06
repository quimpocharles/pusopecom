// Sticky within the right content panel (not the whole viewport) — only
// renders once a category page actually has unsaved changes, per the
// request. updatedAt/updatedBy are optional since not every settings
// source (e.g. Venue Pickup's own repository) tracks an editor today.
const SettingsSaveBar = ({ dirty, saving, onSave, onCancel, updatedAt, updatedBy }) => {
  if (!dirty) {
    if (!updatedAt) return null;
    return (
      <p className="text-xs text-gray-400 mt-6">
        Last updated {new Date(updatedAt).toLocaleString('en-PH')}
        {updatedBy && ` by ${updatedBy.firstName} ${updatedBy.lastName}`.trim()}
      </p>
    );
  }

  return (
    <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 px-6 py-4 bg-white/95 backdrop-blur border-t border-gray-200 flex items-center justify-between gap-4 rounded-b-xl">
      <p className="text-sm text-amber-700">You have unsaved changes.</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default SettingsSaveBar;
