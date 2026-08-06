import { Link } from 'react-router-dom';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { SETTINGS_CATEGORIES } from '../../../components/admin/settings/SettingsLayout';

// The Settings landing page. Deliberately not a "General" category with
// invented Site Name/Branding fields — no such settings exist anywhere in
// the platform today, and Homepage Hero / Featured Fit Check already have
// a full, working admin surface of their own (Homepage / Campaigns). This
// page is a map, same pattern AdminHomepageBuilder.jsx already uses for
// its own hub: cards in, cards out, nothing owned here twice.
const SettingsOverview = () => {
  const categories = SETTINGS_CATEGORIES.filter((c) => c.to !== '/admin/settings');

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Overview</h2>
      <p className="text-sm text-gray-500 mb-6">Everything configurable on the platform, organized by what it actually governs.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <Link
              key={category.to}
              to={category.to}
              className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl hover:border-primary-300 hover:bg-primary-50/30 transition-colors"
            >
              <Icon className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-900">{category.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{category.description}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="pt-6 border-t border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Looking for homepage content?</h3>
        <p className="text-xs text-gray-500 mb-3">Hero banners, the Featured Fit Check teaser, and everything else on the homepage live in their own dedicated area — not duplicated here.</p>
        <div className="flex flex-wrap gap-3">
          <Link to="/admin/campaigns" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:text-primary-800">
            Homepage Hero & Featured Fit Check
            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
          </Link>
          <Link to="/admin/homepage" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:text-primary-800">
            All Homepage Content
            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SettingsOverview;
