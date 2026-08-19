import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeftIcon, PlusIcon, PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import passEventService from '../../services/passEventService';
import venueService from '../../services/venueService';

const emptyTierForm = { venueSectionId: '', name: '', price: '', capacity: '' };

const AdminPassEventDetail = () => {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [venue, setVenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTierId, setEditingTierId] = useState(null);
  const [form, setForm] = useState(emptyTierForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const eventRes = await passEventService.getByIdAdmin(id);
      setEvent(eventRes.data);
      if (eventRes.data?.venueId || eventRes.data?.venue?._id) {
        const venueRes = await venueService.getById(eventRes.data.venueId || eventRes.data.venue._id);
        setVenue(venueRes.data);
      }
    } catch (err) {
      console.error('Failed to load event:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sectionById = (sectionId) => venue?.sections?.find((s) => s._id === sectionId);

  const openAdd = () => {
    setEditingTierId(null);
    setForm(emptyTierForm);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (tier) => {
    setEditingTierId(tier._id);
    setForm({
      venueSectionId: tier.venueSectionId || tier.venueSection?._id || '',
      name: tier.name,
      price: tier.price,
      capacity: tier.capacity ?? '',
    });
    setError('');
    setModalOpen(true);
  };

  const selectedSection = sectionById(form.venueSectionId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        venueSectionId: form.venueSectionId,
        name: form.name,
        price: Number(form.price),
        ...(selectedSection?.seatingType === 'GENERAL_ADMISSION' && { capacity: Number(form.capacity), sold: 0 }),
      };
      if (editingTierId) {
        await passEventService.updateTier(editingTierId, { name: payload.name, price: payload.price, ...(payload.capacity != null && { capacity: payload.capacity }) });
      } else {
        await passEventService.createTier(id, payload);
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save tier');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tierId) => {
    try {
      await passEventService.removeTier(tierId);
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      console.error('Failed to delete tier:', err);
    }
  };

  if (loading) {
    return (
      <div className="px-6 py-12 text-center">
        <div className="w-6 h-6 border-4 border-ink-900 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (!event) {
    return <p className="text-sm text-gray-500">Event not found.</p>;
  }

  return (
    <div>
      <Link to="/admin/pass-events" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeftIcon className="w-4 h-4" />
        Back to Pass Events
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
          <p className="text-sm text-gray-500">{venue?.name} · {new Date(event.startsAt).toLocaleString()}</p>
        </div>
        <button
          onClick={openAdd}
          disabled={!venue?.sections?.length}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
        >
          <PlusIcon className="w-4 h-4" />
          Add Tier
        </button>
      </div>

      {!venue?.sections?.length && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-sm text-amber-800">
          This venue has no sections yet — <Link to={`/admin/venues/${venue?._id}`} className="underline font-medium">add sections and seating</Link> before creating tiers.
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                <th className="px-6 py-3">Tier</th>
                <th className="px-6 py-3">Section</th>
                <th className="px-6 py-3">Price</th>
                <th className="px-6 py-3">Availability</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(event.tiers || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">
                    No tiers yet
                  </td>
                </tr>
              ) : (
                event.tiers.map((tier) => (
                  <tr key={tier._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{tier.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {tier.venueSection?.name}
                      <span className={`ml-2 text-xs font-semibold uppercase tracking-wide ${
                        tier.venueSection?.seatingType === 'RESERVED_SEAT' ? 'text-blue-700' : 'text-purple-700'
                      }`}>
                        {tier.venueSection?.seatingType === 'RESERVED_SEAT' ? 'Reserved' : 'GA'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">₱{Number(tier.price).toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {tier.venueSection?.seatingType === 'GENERAL_ADMISSION'
                        ? `${tier.sold ?? 0} / ${tier.capacity ?? '∞'}`
                        : `${sectionById(tier.venueSectionId || tier.venueSection?._id)?.seats?.length ?? '—'} seats`}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(tier)} className="p-1.5 text-ink-500 hover:text-ink-900 hover:bg-ink-200 transition-colors">
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteConfirm(tier._id)} className="p-1.5 text-ink-500 hover:text-red-600 hover:bg-red-50 transition-colors">
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
          <div className="card w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{editingTierId ? 'Edit Tier' : 'Add Tier'}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1.5 hover:bg-ink-200">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                <select
                  value={form.venueSectionId}
                  onChange={(e) => setForm({ ...form, venueSectionId: e.target.value })}
                  required
                  disabled={!!editingTierId}
                  className="input-field text-sm bg-white disabled:bg-gray-50"
                >
                  <option value="">Select...</option>
                  {venue?.sections?.map((s) => (
                    <option key={s._id} value={s._id}>{s.name} ({s.seatingType === 'RESERVED_SEAT' ? 'Reserved' : 'GA'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tier Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="Lower Box A"
                  className="input-field text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (₱)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  required
                  className="input-field text-sm"
                />
              </div>

              {selectedSection?.seatingType === 'GENERAL_ADMISSION' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                  <input
                    type="number"
                    min="1"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                    required
                    className="input-field text-sm"
                  />
                </div>
              )}
              {selectedSection?.seatingType === 'RESERVED_SEAT' && (
                <p className="text-xs text-gray-400">Availability comes from this section's generated seats — no separate capacity needed.</p>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
                  {saving ? 'Saving...' : editingTierId ? 'Update' : 'Create'}
                </button>
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Tier</h3>
            <p className="text-sm text-gray-600 mb-6">This cannot be undone. Existing Passes already sold for this tier are unaffected.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPassEventDetail;
