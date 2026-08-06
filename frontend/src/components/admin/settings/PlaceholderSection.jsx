// The one component every "not yet configurable" item in the new Settings
// IA renders through — deliberately not an interactive control. A toggle
// or input that doesn't actually do anything is worse than admitting it
// doesn't exist yet: it invites someone to trust a setting that has no
// effect. See docs/decisions — this codebase's own convention is to name
// what's missing, not fake it.
const PlaceholderSection = ({ title, description }) => (
  <div className="border border-dashed border-gray-300 rounded-lg p-5 bg-gray-50">
    <p className="text-sm font-semibold text-gray-500">{title}</p>
    <p className="text-xs text-gray-400 mt-1">{description || 'Not yet configurable.'}</p>
  </div>
);

export default PlaceholderSection;
