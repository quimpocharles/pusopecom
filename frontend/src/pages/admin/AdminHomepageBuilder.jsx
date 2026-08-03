import { Link } from 'react-router-dom';
import {
  RectangleGroupIcon,
  SparklesIcon,
  UserGroupIcon,
  BuildingStorefrontIcon,
  QuestionMarkCircleIcon,
  MegaphoneIcon,
  Bars3BottomLeftIcon,
  DocumentTextIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';

// The central hub for everything that makes up the public homepage (and
// the site chrome around it) — every card here is a real, fully wired CMS
// surface, not a placeholder. Nothing on this page can be edited itself;
// it only routes to the section that can.
const SECTIONS = [
  { label: 'Hero', description: 'The landing statement — headline, image, CTA.', to: '/admin/campaigns', icon: RectangleGroupIcon },
  { label: 'AI Try-On', description: 'The homepage before/after teaser section.', to: '/admin/campaigns', icon: SparklesIcon },
  { label: 'Featured Team', description: 'The rotating team spotlight.', to: '/admin/homepage/featured-team', icon: UserGroupIcon },
  { label: 'Partners', description: 'Logos in the scrolling partner strip.', to: '/admin/homepage/partners', icon: BuildingStorefrontIcon },
  { label: 'FAQ', description: 'Questions shown on the homepage.', to: '/admin/homepage/faq', icon: QuestionMarkCircleIcon },
  { label: 'Announcement Bar', description: 'The top bar and homepage marquee strip.', to: '/admin/homepage/announcements', icon: MegaphoneIcon },
  { label: 'Navigation', description: 'The site header’s nav menu.', to: '/admin/homepage/navigation', icon: Bars3BottomLeftIcon },
  { label: 'Footer', description: 'Company info, links, social, payment methods.', to: '/admin/homepage/footer', icon: DocumentTextIcon },
  { label: 'Section Order', description: 'Which homepage sections show, and in what order.', to: '/admin/homepage/sections', icon: Squares2X2Icon },
];

const AdminHomepageBuilder = () => {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Homepage</h1>
        <p className="text-sm text-gray-500 mt-1">
          Everything a marketing employee needs to manage the homepage, without touching code.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SECTIONS.map((section) => (
          <Link
            key={section.label}
            to={section.to}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:border-primary-300 hover:shadow-sm transition-all"
          >
            <section.icon className="w-6 h-6 text-primary-600 mb-3" />
            <h2 className="text-sm font-semibold text-gray-900">{section.label}</h2>
            <p className="text-xs text-gray-500 mt-1">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default AdminHomepageBuilder;
