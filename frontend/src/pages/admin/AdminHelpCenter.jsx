import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MagnifyingGlassIcon, LifebuoyIcon, ClockIcon } from '@heroicons/react/24/outline';
import helpService from '../../services/helpService';
import { getReadHistory, getMostRecentSlug } from '../../utils/helpReadHistory';
import { formatRelativeTime } from '../../utils/relativeTime';

/**
 * Staff Help Center — browse/search landing page. Gated only by AdminRoute
 * (role === 'admin'), the same as the Dashboard: every department sees the
 * same content here. See backend/routes/help.js and docs/HELP_CENTER.md.
 */
const AdminHelpCenter = () => {
  const [categories, setCategories] = useState([]);
  const [articles, setArticles] = useState([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [readHistory, setReadHistory] = useState({});

  useEffect(() => {
    helpService.getCategories()
      .then((res) => setCategories(res.data))
      .catch(() => setError('Failed to load help categories.'));
  }, []);

  // Read history is per-viewer, browser-local (see helpReadHistory.js) —
  // reload it on mount (covers navigating back from an article, since this
  // page remounts on route change) and whenever the tab becomes visible
  // again (covers switching back from another tab without navigating), so
  // "Read"/"New" status and relative "Last opened" times stay current
  // without a background timer re-rendering the page every few seconds.
  useEffect(() => {
    const reload = () => setReadHistory(getReadHistory());
    reload();
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (activeCategory) params.category = activeCategory;
      if (search.trim()) params.q = search.trim();
      const res = await helpService.getArticles(params);
      setArticles(res.data);
    } catch (err) {
      console.error('Failed to load help articles:', err);
      setError('Failed to load help articles.');
    } finally {
      setLoading(false);
    }
  }, [activeCategory, search]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const categoryLabel = (categoryId) => categories.find((c) => c.id === categoryId)?.label || categoryId;
  // Derived from the full history map, not just the currently filtered/
  // visible articles — search and category filters only decide what's on
  // screen, never which article "most recent" actually refers to.
  const mostRecentSlug = getMostRecentSlug(readHistory);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <LifebuoyIcon className="w-7 h-7 text-primary-600" />
        <h1 className="text-2xl font-bold text-gray-900">Help Center</h1>
      </div>
      <p className="text-sm text-gray-600 mb-6">
        Staff onboarding and how-to guides for Puso Shop. Every account can read every article here,
        regardless of department — search for a task, or browse by category.
      </p>

      <div className="relative mb-6">
        <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search the guide — try &quot;refund&quot;, &quot;shipment&quot;, or &quot;check-in&quot;"
          aria-label="Search help articles"
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveCategory('')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            activeCategory === '' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All topics
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            title={category.description}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeCategory === category.id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {category.label} ({category.articleCount})
          </button>
        ))}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : articles.length === 0 ? (
        <p className="text-sm text-gray-500">No articles match your search.</p>
      ) : (
        <div className="space-y-3">
          {articles.map((article) => {
            const visitedAt = readHistory[article.slug];
            const relativeLabel = visitedAt ? formatRelativeTime(visitedAt) : null;
            const isMostRecent = article.slug === mostRecentSlug;
            return (
              <Link
                key={article.slug}
                to={`/admin/help/${article.slug}`}
                className={`block p-4 bg-white rounded-lg hover:border-primary-300 hover:shadow-sm transition-all ${
                  isMostRecent ? 'border-2 border-primary-200' : 'border border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Global h2 styling (index.css) is an uppercase display font at
                      0.025em tracking, sized for a single page heading — too tight
                      to read comfortably repeated down a dense list of card titles,
                      so this one card-title heading widens it further. */}
                  <h2 className="font-semibold text-gray-900 tracking-wider">{article.title}</h2>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded ${
                        visitedAt ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {visitedAt ? '✓ Read' : 'New'}
                    </span>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{categoryLabel(article.categoryId)}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-1">{article.summary}</p>
                {relativeLabel && (
                  <p className="flex items-center gap-1 text-xs text-gray-400 mt-1.5">
                    <ClockIcon className="w-3.5 h-3.5" />
                    Last opened {relativeLabel}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminHelpCenter;
