import { useState, useEffect, useCallback, useRef } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, MagnifyingGlassIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import fitCheckCampaignService from '../../services/fitCheckCampaignService';
import productService from '../../services/productService';
import ImageField from '../../components/admin/ImageField';

const CATEGORIES = ['jersey', 'tshirt', 'cap', 'shorts', 'accessories', 'jacket', 'sweatshirt', 'hoodie'];

const emptyForm = {
  name: '',
  sponsorName: '',
  category: '',
  headline: '',
  description: '',
  ctaLabel: '',
  ctaLink: '',
  landingPageUrl: '',
  bannerImage: '',
  unlimitedFitChecks: true,
  startDate: '',
  endDate: '',
  priority: 0,
  active: true,
};

// Same shape as AdminCampaigns.jsx's FeaturedProductPicker, extended to a
// multi-select — a Sponsored Fit Check campaign can cover many products at
// once, not just one CTA destination.
const ProductMultiPicker = ({ value, onChange }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await productService.getSearchSuggestions(query);
        setSuggestions((res.data || []).filter((s) => !value.some((v) => v.slug === s.slug)));
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, value]);

  const handlePick = async (suggestion) => {
    try {
      const res = await productService.getProductBySlug(suggestion.slug);
      onChange([...value, { id: res.data._id, name: res.data.name, slug: res.data.slug }]);
      setQuery('');
      setSuggestions([]);
    } catch {
      // leave the list as-is if the lookup fails — no partial/wrong id added
    }
  };

  const handleRemove = (id) => onChange(value.filter((v) => v.id !== id));

  return (
    <div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {value.map((v) => (
            <span
              key={v.id}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-700"
            >
              {v.name}
              <button type="button" onClick={() => handleRemove(v.id)} className="text-gray-400 hover:text-red-600">
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products to add..."
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      {searching && <p className="text-xs text-gray-400 mt-1">Searching...</p>}
      {suggestions.length > 0 && (
        <div className="relative">
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
            {suggestions.map((s) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => handlePick(s)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50"
              >
                {s.image && <img src={s.image} alt="" className="w-8 h-8 object-cover rounded" />}
                <span className="truncate">{s.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const AdminFitCheckCampaigns = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [analyticsCampaign, setAnalyticsCampaign] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const openAnalytics = async (campaign) => {
    setAnalyticsCampaign(campaign);
    setAnalytics(null);
    setAnalyticsLoading(true);
    try {
      const res = await fitCheckCampaignService.getAnalytics(campaign._id);
      setAnalytics(res.data);
    } catch (err) {
      console.error('Failed to load Fit Check campaign analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fitCheckCampaignService.getCampaigns();
      setCampaigns(res.data);
    } catch (err) {
      console.error('Failed to load Fit Check campaigns:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const toDateInput = (iso) => (iso ? iso.slice(0, 10) : '');

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setProducts([]);
    setError('');
    setModalOpen(true);
  };

  const openEdit = async (campaign) => {
    setEditingId(campaign._id);
    setForm({
      name: campaign.name,
      sponsorName: campaign.sponsorName,
      category: campaign.category || '',
      headline: campaign.headline || '',
      description: campaign.description || '',
      ctaLabel: campaign.ctaLabel || '',
      ctaLink: campaign.ctaLink || '',
      landingPageUrl: campaign.landingPageUrl || '',
      bannerImage: campaign.bannerImage || '',
      unlimitedFitChecks: campaign.unlimitedFitChecks,
      startDate: toDateInput(campaign.startDate),
      endDate: toDateInput(campaign.endDate),
      priority: campaign.priority,
      active: campaign.active,
    });
    setError('');
    setModalOpen(true);

    // Resolve real names for the chips — productIds only stores raw ids.
    const ids = campaign.productIds || [];
    setProducts(ids.map((id) => ({ id, name: '...', slug: id })));
    const resolved = await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await productService.getProductById(id);
          return { id, name: res.data.name, slug: res.data.slug };
        } catch {
          return { id, name: id, slug: id }; // deleted/unresolvable product — fall back to the raw id
        }
      })
    );
    setProducts(resolved);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const payload = {
        ...form,
        category: form.category || null,
        priority: Number(form.priority) || 0,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        productIds: products.map((p) => p.id),
      };

      if (editingId) {
        await fitCheckCampaignService.updateCampaign(editingId, payload);
      } else {
        await fitCheckCampaignService.createCampaign(payload);
      }

      setModalOpen(false);
      fetchCampaigns();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save Fit Check campaign');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await fitCheckCampaignService.deleteCampaign(id);
      setDeleteConfirm(null);
      fetchCampaigns();
    } catch (err) {
      console.error('Failed to delete Fit Check campaign:', err);
    }
  };

  const handleToggleActive = async (campaign) => {
    try {
      await fitCheckCampaignService.updateCampaign(campaign._id, { active: !campaign.active });
      fetchCampaigns();
    } catch (err) {
      console.error('Failed to toggle Fit Check campaign:', err);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Fit Check Campaigns</h1>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          <PlusIcon className="w-4 h-4" />
          Add Campaign
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Sponsors give unlimited Fit Checks for specific products or an entire category — separate from the homepage Campaigns above.
      </p>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Sponsor</th>
                <th className="px-6 py-3">Coverage</th>
                <th className="px-6 py-3">Schedule</th>
                <th className="px-6 py-3">Priority</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="w-6 h-6 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                    No Fit Check campaigns found
                  </td>
                </tr>
              ) : (
                campaigns.map((campaign) => (
                  <tr key={campaign._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{campaign.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{campaign.sponsorName}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {campaign.category
                        ? `Category: ${campaign.category}`
                        : `${(campaign.productIds || []).length} product${(campaign.productIds || []).length === 1 ? '' : 's'}`}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                      {campaign.startDate || campaign.endDate
                        ? `${toDateInput(campaign.startDate) || 'any'} → ${toDateInput(campaign.endDate) || 'any'}`
                        : 'Always'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{campaign.priority}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(campaign)}
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                          campaign.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {campaign.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openAnalytics(campaign)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Analytics"
                        >
                          <ChartBarIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEdit(campaign)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(campaign._id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Edit Fit Check Campaign' : 'Add Fit Check Campaign'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Internal Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="e.g. Playtime.ph August Jersey Drop"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sponsor Name</label>
                <input
                  type="text"
                  value={form.sponsorName}
                  onChange={(e) => setForm({ ...form, sponsorName: e.target.value })}
                  required
                  placeholder="e.g. Playtime.ph"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-400 mt-1">Shown to fans as "Sponsored by {'{'}Sponsor Name{'}'}"</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Products</label>
                <ProductMultiPicker value={products} onChange={setProducts} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Or an entire category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="">No category — products above only</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">A product is covered if it's in the list above OR matches this category.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Headline</label>
                <input
                  type="text"
                  value={form.headline}
                  onChange={(e) => setForm({ ...form, headline: e.target.value })}
                  required
                  placeholder="Unlimited Fit Checks — on us"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CTA Label</label>
                  <input
                    type="text"
                    value={form.ctaLabel}
                    onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })}
                    placeholder="Try It On"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CTA Link</label>
                  <input
                    type="text"
                    value={form.ctaLink}
                    onChange={(e) => setForm({ ...form, ctaLink: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Landing Page URL</label>
                <input
                  type="text"
                  value={form.landingPageUrl}
                  onChange={(e) => setForm({ ...form, landingPageUrl: e.target.value })}
                  placeholder="Optional — a dedicated campaign page, if there is one"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <ImageField label="Banner Image" value={form.bannerImage} onChange={(v) => setForm({ ...form, bannerImage: v })} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400 -mt-2">Leave either blank for no bound on that side.</p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-400 mt-1">Higher wins when more than one campaign covers the same product.</p>
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.unlimitedFitChecks}
                  onChange={(e) => setForm({ ...form, unlimitedFitChecks: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Unlimited Fit Checks (bypasses the daily allowance for covered products)
              </label>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Active
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Fit Check Campaign</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure? This will deactivate the campaign. You can reactivate it later by toggling the status.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analytics */}
      {analyticsCampaign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{analyticsCampaign.name}</h3>
              <button onClick={() => setAnalyticsCampaign(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {analyticsLoading ? (
                <div className="w-6 h-6 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
              ) : !analytics ? (
                <p className="text-sm text-gray-500">Failed to load analytics.</p>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xl font-bold text-gray-900">{analytics.views}</p>
                      <p className="text-xs text-gray-500">Views</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xl font-bold text-gray-900">{analytics.generations}</p>
                      <p className="text-xs text-gray-500">Generations</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xl font-bold text-gray-900">{analytics.uniqueFans}</p>
                      <p className="text-xs text-gray-500">Unique Fans</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xl font-bold text-gray-900">{Math.round(analytics.successRate * 100)}%</p>
                      <p className="text-xs text-gray-500">Success Rate</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xl font-bold text-gray-900">{(analytics.avgGenerationMs / 1000).toFixed(1)}s</p>
                      <p className="text-xs text-gray-500">Avg. Time</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xl font-bold text-gray-900">{analytics.purchases}</p>
                      <p className="text-xs text-gray-500">Purchases</p>
                    </div>
                  </div>

                  <div className="bg-primary-50 border border-primary-100 rounded-lg px-4 py-3">
                    <p className="text-sm text-gray-600">Revenue attributed</p>
                    <p className="text-2xl font-bold text-primary-700">₱{analytics.revenue.toLocaleString()}</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Top Products</h4>
                    {analytics.topProducts.length === 0 ? (
                      <p className="text-sm text-gray-500">No Fit Checks generated yet.</p>
                    ) : (
                      <ul className="space-y-1">
                        {analytics.topProducts.map((p) => (
                          <li key={p.id} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700 truncate">{p.name}</span>
                            <span className="text-gray-500 font-medium">{p.count}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFitCheckCampaigns;
