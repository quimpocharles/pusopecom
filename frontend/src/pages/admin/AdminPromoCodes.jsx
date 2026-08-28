import { useState, useEffect, useCallback, useRef } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import promoCodeService from '../../services/promoCodeService';
import productService from '../../services/productService';

// Maps the admin-facing "kind" dropdown (one thing to pick) onto the two
// underlying schema fields (discountType + scope) — keeps an admin from ever
// assembling an invalid combination, like FREE_SHIPPING scoped to PRODUCT.
const KINDS = [
  { value: 'PERCENT_ORDER', label: 'Percent off order', discountType: 'PERCENTAGE', scope: 'ORDER' },
  { value: 'FIXED_ORDER', label: 'Fixed amount off order', discountType: 'FIXED_AMOUNT', scope: 'ORDER' },
  { value: 'PERCENT_ITEMS', label: 'Percent off specific items', discountType: 'PERCENTAGE', scope: 'PRODUCT' },
  { value: 'FIXED_ITEMS', label: 'Fixed amount off specific items', discountType: 'FIXED_AMOUNT', scope: 'PRODUCT' },
  // EVENT scope — no FREE_SHIPPING pairing, same as PRODUCT above: free
  // shipping only ever makes sense paired with ORDER scope, and a Pass
  // order's shippingFee is always 0 regardless (orders.js).
  { value: 'PERCENT_EVENTS', label: 'Percent off specific events', discountType: 'PERCENTAGE', scope: 'EVENT' },
  { value: 'FIXED_EVENTS', label: 'Fixed amount off specific events', discountType: 'FIXED_AMOUNT', scope: 'EVENT' },
  { value: 'FREE_SHIPPING', label: 'Free shipping', discountType: 'FREE_SHIPPING', scope: 'ORDER' },
];

const kindFor = (discountType, scope) =>
  KINDS.find((k) => k.discountType === discountType && k.scope === scope)?.value || 'PERCENT_ORDER';

const scopeLabel = (scope) => (scope === 'PRODUCT' ? 'items' : scope === 'EVENT' ? 'events' : 'order');

const emptyForm = {
  code: '',
  description: '',
  kind: 'PERCENT_ORDER',
  percentOff: '',
  amountOff: '',
  startsAt: '',
  endsAt: '',
  maxRedemptions: '',
  perCustomerLimit: '',
  minOrderValue: '',
  active: true,
};

const toDateInput = (iso) => (iso ? iso.slice(0, 10) : '');
const numOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

/**
 * Multi-select variant of AdminCampaigns.jsx's FeaturedProductPicker — same
 * search-suggestions + resolve-by-slug flow, but accumulates a list of
 * products instead of replacing a single value. Kept colocated with this
 * page rather than pulled into a shared component, same precedent
 * FeaturedProductPicker itself already set.
 */
const PromoProductPicker = ({ value, onChange }) => {
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
      const picked = { id: res.data._id, name: res.data.name, slug: res.data.slug };
      if (!value.some((p) => p.id === picked.id)) onChange([...value, picked]);
      setQuery('');
      setSuggestions([]);
    } catch {
      // leave the field as-is if the lookup fails — no partial/wrong id added
    }
  };

  const remove = (id) => onChange(value.filter((p) => p.id !== id));

  const alreadyPickedSlugs = new Set(value.map((p) => p.slug));
  const filteredSuggestions = suggestions.filter((s) => !alreadyPickedSlugs.has(s.slug));

  return (
    <div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {value.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-full text-xs text-gray-800"
            >
              {p.name}
              <button type="button" onClick={() => remove(p.id)} className="text-gray-400 hover:text-red-600">
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
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
        {filteredSuggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
            {filteredSuggestions.map((s) => (
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
    </div>
  );
};

const formatEventDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Event-targeting counterpart to PromoProductPicker above — a plain dropdown
 * of every active event rather than a type-to-search box. Unlike Merchandise,
 * the active-event list is small enough on this platform to just show in
 * full (backend already scopes it to `active: true`, soonest first), so a
 * search box only added friction (a stray typo silently produced zero
 * matches with no feedback) for no real benefit at this volume.
 */
const PromoEventPicker = ({ value, onChange }) => {
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    promoCodeService.getEvents()
      .then((res) => { if (!cancelled) setAllEvents(res.data || []); })
      .catch(() => { if (!cancelled) setAllEvents([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handlePick = (eventId) => {
    const event = allEvents.find((e) => e._id === eventId);
    if (event && !value.some((e) => e.id === event._id)) {
      onChange([...value, { id: event._id, name: event.name, venueName: event.venueName, startsAt: event.startsAt }]);
    }
  };

  const remove = (id) => onChange(value.filter((e) => e.id !== id));

  const alreadyPickedIds = new Set(value.map((e) => e.id));
  const pickableEvents = allEvents.filter((e) => !alreadyPickedIds.has(e._id));

  return (
    <div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {value.map((e) => (
            <span
              key={e.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-full text-xs text-gray-800"
            >
              {e.name}
              <button type="button" onClick={() => remove(e.id)} className="text-gray-400 hover:text-red-600">
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <select
        value=""
        onChange={(e) => handlePick(e.target.value)}
        disabled={loading || pickableEvents.length === 0}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white disabled:bg-gray-50"
      >
        <option value="" disabled>
          {loading
            ? 'Loading events...'
            : pickableEvents.length === 0
            ? (allEvents.length === 0 ? 'No active events' : 'All active events added')
            : 'Add an event...'}
        </option>
        {pickableEvents.map((event) => (
          <option key={event._id} value={event._id}>
            {event.name} — {formatEventDate(event.startsAt)}
            {event.venueName ? ` · ${event.venueName}` : ''}
          </option>
        ))}
      </select>
    </div>
  );
};

const AdminPromoCodes = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [products, setProducts] = useState([]);
  const [events, setEvents] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await promoCodeService.getAll();
      setItems(res.data);
    } catch (err) {
      console.error('Failed to load promo codes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setProducts([]);
    setEvents([]);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingId(item._id);
    setForm({
      code: item.code,
      description: item.description || '',
      kind: kindFor(item.discountType, item.scope),
      percentOff: item.percentOff ?? '',
      amountOff: item.amountOff ?? '',
      startsAt: toDateInput(item.startsAt),
      endsAt: toDateInput(item.endsAt),
      maxRedemptions: item.maxRedemptions ?? '',
      perCustomerLimit: item.perCustomerLimit ?? '',
      minOrderValue: item.minOrderValue ?? '',
      active: item.active,
    });
    setProducts((item.products || []).map((p) => ({ id: p.productId, name: p.product?.name || 'Product', slug: p.product?.slug })));
    setEvents((item.passEvents || []).map((e) => ({
      id: e.passEventId,
      name: e.passEvent?.name || 'Event',
      venueName: e.passEvent?.venueName,
      startsAt: e.passEvent?.startsAt,
    })));
    setError('');
    setModalOpen(true);
  };

  const selectedKind = KINDS.find((k) => k.value === form.kind) || KINDS[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        code: form.code,
        description: form.description || null,
        discountType: selectedKind.discountType,
        scope: selectedKind.scope,
        percentOff: selectedKind.discountType === 'PERCENTAGE' ? numOrNull(form.percentOff) : null,
        amountOff: selectedKind.discountType === 'FIXED_AMOUNT' ? numOrNull(form.amountOff) : null,
        productIds: selectedKind.scope === 'PRODUCT' ? products.map((p) => p.id) : [],
        passEventIds: selectedKind.scope === 'EVENT' ? events.map((e) => e.id) : [],
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        maxRedemptions: numOrNull(form.maxRedemptions),
        perCustomerLimit: numOrNull(form.perCustomerLimit),
        minOrderValue: numOrNull(form.minOrderValue),
        active: form.active,
      };

      if (editingId) {
        await promoCodeService.update(editingId, payload);
      } else {
        await promoCodeService.create(payload);
      }
      setModalOpen(false);
      fetchItems();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save promo code');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await promoCodeService.remove(id);
      setDeleteConfirm(null);
      fetchItems();
    } catch (err) {
      console.error('Failed to delete promo code:', err);
    }
  };

  const handleToggleActive = async (item) => {
    try {
      await promoCodeService.update(item._id, { active: !item.active });
      fetchItems();
    } catch (err) {
      console.error('Failed to toggle promo code:', err);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Promo Codes</h1>
          <p className="text-sm text-gray-500 mt-1">Platform-wide codes fans can apply at checkout for a discount.</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          <PlusIcon className="w-4 h-4" />
          Add Code
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                <th className="px-6 py-3">Code</th>
                <th className="px-6 py-3">Discount</th>
                <th className="px-6 py-3">Usage</th>
                <th className="px-6 py-3">Window</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="w-6 h-6 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                    No promo codes yet
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-mono font-medium text-gray-900">{item.code}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {item.discountType === 'PERCENTAGE' && `${item.percentOff}% off ${scopeLabel(item.scope)}`}
                      {item.discountType === 'FIXED_AMOUNT' && `₱${item.amountOff} off ${scopeLabel(item.scope)}`}
                      {item.discountType === 'FREE_SHIPPING' && 'Free shipping'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {item.redemptionCount} / {item.maxRedemptions ?? '∞'}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                      {item.startsAt || item.endsAt
                        ? `${toDateInput(item.startsAt) || 'any'} → ${toDateInput(item.endsAt) || 'any'}`
                        : 'Always'}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(item)}
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                          item.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {item.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(item)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteConfirm(item._id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{editingId ? 'Edit Promo Code' : 'Add Promo Code'}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

              {editingId && (
                <p className="text-xs text-gray-400">
                  Used {items.find((i) => i._id === editingId)?.redemptionCount ?? 0} / {items.find((i) => i._id === editingId)?.maxRedemptions ?? '∞'}
                </p>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  required
                  placeholder="WELCOME10"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-400 mt-1">What fans type at checkout. Case-insensitive.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Internal Note</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. August launch push"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-400 mt-1">For telling codes apart in this list — not shown to fans.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discount</label>
                <select
                  value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  {KINDS.map((k) => (
                    <option key={k.value} value={k.value}>{k.label}</option>
                  ))}
                </select>
              </div>

              {selectedKind.discountType === 'PERCENTAGE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Percent Off</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={form.percentOff}
                    onChange={(e) => setForm({ ...form, percentOff: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}

              {selectedKind.discountType === 'FIXED_AMOUNT' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount Off (₱)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={form.amountOff}
                    onChange={(e) => setForm({ ...form, amountOff: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}

              {selectedKind.scope === 'PRODUCT' && (
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                    Applies To
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-blue-100 text-blue-700">
                      Merchandise
                    </span>
                  </label>
                  <PromoProductPicker value={products} onChange={setProducts} />
                </div>
              )}

              {selectedKind.scope === 'EVENT' && (
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                    Applies To
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700">
                      Events &amp; Passes
                    </span>
                  </label>
                  <PromoEventPicker value={events} onChange={setEvents} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Starts</label>
                  <input
                    type="date"
                    value={form.startsAt}
                    onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ends</label>
                  <input
                    type="date"
                    value={form.endsAt}
                    onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400 -mt-2">Leave blank on either side for no bound.</p>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Uses</label>
                  <input
                    type="number"
                    min="1"
                    value={form.maxRedemptions}
                    onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
                    placeholder="Unlimited"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Per Customer</label>
                  <input
                    type="number"
                    min="1"
                    value={form.perCustomerLimit}
                    onChange={(e) => setForm({ ...form, perCustomerLimit: e.target.value })}
                    placeholder="Unlimited"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Order (₱)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.minOrderValue}
                    onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })}
                    placeholder="None"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Active (redeemable at checkout)
              </label>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50">
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </button>
                <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Promo Code</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure? This deactivates it immediately; you can restore it by editing it again.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPromoCodes;
