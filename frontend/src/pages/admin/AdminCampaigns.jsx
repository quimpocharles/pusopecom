import { useState, useEffect, useCallback, useRef } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import campaignService from '../../services/campaignService';
import productService from '../../services/productService';
import ImageField from '../../components/admin/ImageField';

const PLACEMENTS = [
  { value: 'hero', label: 'Hero (landing statement)' },
  { value: 'tryOn', label: 'Fit Check (before/after section)' },
];

const emptyForm = {
  placement: 'tryOn',
  name: '',
  eyebrow: '',
  headline: '',
  subheadline: '',
  description: '',
  ctaLabel: '',
  ctaLink: '',
  image: '',
  beforeImage: '',
  afterImage: '',
  accentColor: '',
  featuredOnHomepage: false,
  startDate: '',
  endDate: '',
  active: true,
};

// Resolves a chosen search-suggestion (name/slug only) to a full product —
// campaigns store a real featuredProductId (FK), and the suggestions
// endpoint deliberately doesn't expose raw ids (it's the same one the
// public search bar uses), so the id is fetched via the existing
// GET /products/:slug the moment an admin picks a result.
const FeaturedProductPicker = ({ value, onChange }) => {
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
        setSuggestions(res.data || []);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handlePick = async (suggestion) => {
    try {
      const res = await productService.getProductBySlug(suggestion.slug);
      onChange({ id: res.data._id, name: res.data.name, slug: res.data.slug });
      setQuery('');
      setSuggestions([]);
    } catch {
      // leave the field as-is if the lookup fails — no partial/wrong id set
    }
  };

  if (value) {
    return (
      <div className="flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50">
        <span className="text-gray-900 truncate">{value.name}</span>
        <button type="button" onClick={() => onChange(null)} className="text-gray-400 hover:text-red-600 flex-shrink-0 ml-2">
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products by name..."
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      {searching && <p className="text-xs text-gray-400 mt-1">Searching...</p>}
      {suggestions.length > 0 && (
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
      )}
    </div>
  );
};

const AdminCampaigns = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [featuredProduct, setFeaturedProduct] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [filterPlacement, setFilterPlacement] = useState('');

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await campaignService.getCampaigns();
      setCampaigns(res.data);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
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
    setFeaturedProduct(null);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (campaign) => {
    setEditingId(campaign._id);
    setForm({
      placement: campaign.placement,
      name: campaign.name,
      eyebrow: campaign.eyebrow || '',
      headline: campaign.headline || '',
      subheadline: campaign.subheadline || '',
      description: campaign.description || '',
      ctaLabel: campaign.ctaLabel || '',
      ctaLink: campaign.ctaLink || '',
      image: campaign.image || '',
      beforeImage: campaign.beforeImage || '',
      afterImage: campaign.afterImage || '',
      accentColor: campaign.accentColor || '',
      featuredOnHomepage: campaign.featuredOnHomepage,
      startDate: toDateInput(campaign.startDate),
      endDate: toDateInput(campaign.endDate),
      active: campaign.active,
    });
    setFeaturedProduct(
      campaign.featuredProduct ? { id: campaign.featuredProduct._id, name: campaign.featuredProduct.name } : null
    );
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const payload = {
        ...form,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        featuredProductId: featuredProduct?.id || null,
      };

      if (editingId) {
        await campaignService.updateCampaign(editingId, payload);
      } else {
        await campaignService.createCampaign(payload);
      }

      setModalOpen(false);
      fetchCampaigns();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save campaign');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await campaignService.deleteCampaign(id);
      setDeleteConfirm(null);
      fetchCampaigns();
    } catch (err) {
      console.error('Failed to delete campaign:', err);
    }
  };

  const handleToggleActive = async (campaign) => {
    try {
      await campaignService.updateCampaign(campaign._id, { active: !campaign.active });
      fetchCampaigns();
    } catch (err) {
      console.error('Failed to toggle campaign:', err);
    }
  };

  const filtered = filterPlacement ? campaigns.filter((c) => c.placement === filterPlacement) : campaigns;

  const placementLabel = (value) => PLACEMENTS.find((p) => p.value === value)?.label || value;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          <PlusIcon className="w-4 h-4" />
          Add Campaign
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <select
          value={filterPlacement}
          onChange={(e) => setFilterPlacement(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
        >
          <option value="">All Placements</option>
          {PLACEMENTS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Placement</th>
                <th className="px-6 py-3">Headline</th>
                <th className="px-6 py-3">Homepage</th>
                <th className="px-6 py-3">Schedule</th>
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
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                    No campaigns found
                  </td>
                </tr>
              ) : (
                filtered.map((campaign) => (
                  <tr key={campaign._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{campaign.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{placementLabel(campaign.placement)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{campaign.headline}</td>
                    <td className="px-6 py-4 text-sm">
                      {campaign.featuredOnHomepage ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Featured
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                      {campaign.startDate || campaign.endDate
                        ? `${toDateInput(campaign.startDate) || 'any'} → ${toDateInput(campaign.endDate) || 'any'}`
                        : 'Always'}
                    </td>
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
                {editingId ? 'Edit Campaign' : 'Add Campaign'}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Placement</label>
                <select
                  value={form.placement}
                  onChange={(e) => setForm({ ...form, placement: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  {PLACEMENTS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Internal Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="e.g. August Gilas Restock"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-400 mt-1">For telling campaigns apart in this list — not shown to fans.</p>
              </div>

              {form.placement === 'hero' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Eyebrow</label>
                  <input
                    type="text"
                    value={form.eyebrow}
                    onChange={(e) => setForm({ ...form, eyebrow: e.target.value })}
                    placeholder="New Collection"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Small label shown above the headline.</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Headline</label>
                <input
                  type="text"
                  value={form.headline}
                  onChange={(e) => setForm({ ...form, headline: e.target.value })}
                  required
                  placeholder="WEAR THE PUSO."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subheadline</label>
                <input
                  type="text"
                  value={form.subheadline}
                  onChange={(e) => setForm({ ...form, subheadline: e.target.value })}
                  placeholder="See yourself wearing your team's official merchandise before you buy."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Body Copy</label>
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
                    placeholder="Try Fit Check"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CTA Destination</label>
                  <input
                    type="text"
                    value={form.ctaLink}
                    onChange={(e) => setForm({ ...form, ctaLink: e.target.value })}
                    placeholder="Leave blank to use the featured product"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {form.placement === 'hero' && (
                <>
                  <ImageField label="Image" value={form.image} onChange={(v) => setForm({ ...form, image: v })} />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Accent Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.accentColor || '#ffffff'}
                        onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                        className="w-10 h-9 border border-gray-300 rounded-lg cursor-pointer"
                      />
                      <input
                        type="text"
                        value={form.accentColor}
                        onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                        placeholder="Leave blank for the default white"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">CTA button hover color for this campaign.</p>
                  </div>
                </>
              )}

              {form.placement === 'tryOn' && (
                <>
                  <ImageField
                    label="Before Image"
                    value={form.beforeImage}
                    onChange={(v) => setForm({ ...form, beforeImage: v })}
                  />
                  <ImageField
                    label="After Image"
                    value={form.afterImage}
                    onChange={(v) => setForm({ ...form, afterImage: v })}
                  />
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Featured Product</label>
                <FeaturedProductPicker value={featuredProduct} onChange={setFeaturedProduct} />
                <p className="text-xs text-gray-400 mt-1">
                  Also used as the CTA destination (with Fit Check opened automatically) when CTA Destination is left blank.
                </p>
              </div>

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

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.featuredOnHomepage}
                  onChange={(e) => setForm({ ...form, featuredOnHomepage: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Feature on homepage (only one campaign per placement should be active at a time)
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Campaign</h3>
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
    </div>
  );
};

export default AdminCampaigns;
