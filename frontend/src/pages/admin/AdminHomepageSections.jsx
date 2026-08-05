import { useState, useEffect, useCallback } from 'react';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import homepageSectionService from '../../services/homepageSectionService';

const SECTION_LABELS = {
  hero: 'Hero',
  aiTryOn: 'Fit Check',
  marquee: 'Marquee Bar',
  featuredProducts: 'Featured Products',
  trendingFitChecks: 'Trending Fit Checks',
  featuredTeam: 'Featured Team',
  partners: 'Our Partners',
  faq: 'FAQ',
};

const AdminHomepageSections = () => {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await homepageSectionService.getSections();
      setSections(res.data);
    } catch (err) {
      console.error('Failed to load homepage sections:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  const handleToggle = async (section) => {
    setSections((prev) => prev.map((s) => (s.key === section.key ? { ...s, active: !s.active } : s)));
    try {
      await homepageSectionService.setSectionActive(section.key, !section.active);
    } catch (err) {
      setError('Failed to update section visibility');
      fetchSections();
    }
  };

  // Swap displayOrder with the neighbor above/below, then persist both.
  const move = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const a = sections[index];
    const b = sections[target];
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    setSections(next);
    try {
      await homepageSectionService.reorderSections([
        { key: a.key, displayOrder: b.displayOrder },
        { key: b.key, displayOrder: a.displayOrder },
      ]);
      fetchSections();
    } catch (err) {
      setError('Failed to reorder sections');
      fetchSections();
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Homepage Sections</h1>
        <p className="text-sm text-gray-500 mt-1">
          Controls which sections appear on the homepage, and in what order. Hidden sections are skipped entirely, not just visually hidden.
        </p>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="px-6 py-12 text-center">
            <div className="w-6 h-6 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sections.map((section, index) => (
              <li key={section.key} className="flex items-center gap-3 px-6 py-4">
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed"
                  >
                    <ChevronUpIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => move(index, 1)}
                    disabled={index === sections.length - 1}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed"
                  >
                    <ChevronDownIcon className="w-4 h-4" />
                  </button>
                </div>
                <span className="flex-1 text-sm font-medium text-gray-900">{SECTION_LABELS[section.key] || section.key}</span>
                <button
                  role="switch"
                  aria-checked={section.active}
                  onClick={() => handleToggle(section)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    section.active ? 'bg-primary-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      section.active ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AdminHomepageSections;
