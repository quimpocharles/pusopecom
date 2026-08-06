import PlaceholderSection from '../../../components/admin/settings/PlaceholderSection';

// No feature-flag system, maintenance-mode flag, or experimentation
// framework exists anywhere in the codebase today — confirmed by search,
// not assumed. This category exists in the IA so it has somewhere to land
// the moment any of these becomes real, without another reorganization.
const AdvancedSettings = () => {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Advanced</h2>
      <p className="text-sm text-gray-500 mb-6">Nothing here is real yet — reserved so it has somewhere to go when it is.</p>

      <div className="space-y-3">
        <PlaceholderSection title="Feature Flags" description="No feature-flag system exists yet." />
        <PlaceholderSection title="Maintenance Mode" description="No maintenance-mode toggle exists yet." />
        <PlaceholderSection title="Experimental Features" description="No experimentation framework exists yet." />
      </div>
    </div>
  );
};

export default AdvancedSettings;
