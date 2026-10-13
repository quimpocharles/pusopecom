import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MagnifyingGlassIcon, LifebuoyIcon } from '@heroicons/react/24/outline';
import helpService from '../../services/helpService';

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

  useEffect(() => {
    helpService.getCategories()
      .then((res) => setCategories(res.data))
      .catch(() => setError('Failed to load help categories.'));
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
          {articles.map((article) => (
            <Link
              key={article.slug}
              to={`/admin/help/${article.slug}`}
              className="block p-4 bg-white border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between gap-3">
                {/* Global h2 styling (index.css) is an uppercase display font at
                    0.025em tracking, sized for a single page heading — too tight
                    to read comfortably repeated down a dense list of card titles,
                    so this one card-title heading widens it further. */}
                <h2 className="font-semibold text-gray-900 tracking-wider">{article.title}</h2>
                <span className="text-xs text-gray-400 whitespace-nowrap">{categoryLabel(article.categoryId)}</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">{article.summary}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminHelpCenter;
