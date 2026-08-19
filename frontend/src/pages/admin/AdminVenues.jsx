import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, MapIcon } from '@heroicons/react/24/outline';
import venueService from '../../services/venueService';

const emptyForm = { name: '', slug: '', address: '', city: '', capacity: '', mapImageUrl: '', active: true };

const generateSlug = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const AdminVenues = () => {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchVenues = useCallback(async () => {
    setLoading(true);
    try {
      const res = await venueService.getAll();
      setVenues(res.data);
    } catch (err) {
      console.error('Failed to load venues:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVenues();
  }, [fetchVenues]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (venue) => {
    setEditingId(venue._id);
    setForm({
      name: venue.name,
      slug: venue.slug,
      address: venue.address,
      city: venue.city,
      capacity: venue.capacity ?? '',
      mapImageUrl: venue.mapImageUrl || '',
      active: venue.active,
    });
    setError('');
    setModalOpen(true);
  };

  const handleNameChange = (e) => {
    const name = e.target.value;
    setForm((prev) => ({ ...prev, name, ...(editingId ? {} : { slug: generateSlug(name) }) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = { ...form, capacity: form.capacity === '' ? null : Number(form.capacity) };
      if (editingId) {
        await venueService.update(editingId, payload);
      } else {
        await venueService.create(payload);
      }
      setModalOpen(false);
      fetchVenues();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save venue');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await venueService.remove(id);
      setDeleteConfirm(null);
      fetchVenues();
    } catch (err) {
      console.error('Failed to delete venue:', err);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Venues</h1>
          <p className="text-sm text-gray-500 mt-1">Physical locations a Pass Event can be held at — see each venue's seating for section/seat setup.</p>
        </div>
        <button
          onClick={openAdd}
          className="btn-primary inline-flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          Add Venue
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">City</th>
                <th className="px-6 py-3">Capacity</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="w-6 h-6 border-4 border-ink-900 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : venues.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">
                    No venues yet
                  </td>
                </tr>
              ) : (
                venues.map((venue) => (
                  <tr key={venue._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{venue.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{venue.city}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{venue.capacity ?? '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-semibold uppercase tracking-wide ${venue.active ? 'text-green-700' : 'text-ink-500'}`}>
                        {venue.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/admin/venues/${venue._id}`}
                          className="p-1.5 text-ink-500 hover:text-ink-900 hover:bg-ink-200 transition-colors"
                          title="Manage seating"
                        >
                          <MapIcon className="w-4 h-4" />
                        </Link>
                        <button onClick={() => openEdit(venue)} className="p-1.5 text-ink-500 hover:text-ink-900 hover:bg-ink-200 transition-colors">
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteConfirm(venue._id)} className="p-1.5 text-ink-500 hover:text-red-600 hover:bg-red-50 transition-colors">
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
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{editingId ? 'Edit Venue' : 'Add Venue'}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1.5 hover:bg-ink-200">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={handleNameChange}
                  required
                  placeholder="Smart Araneta Coliseum"
                  className="input-field text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  required
                  className="input-field text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  required
                  className="input-field text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    required
                    className="input-field text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                  <input
                    type="number"
                    min="1"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                    placeholder="Informational only"
                    className="input-field text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Map Image URL</label>
                <input
                  type="text"
                  value={form.mapImageUrl}
                  onChange={(e) => setForm({ ...form, mapImageUrl: e.target.value })}
                  placeholder="Background for the seat-map builder (optional)"
                  className="input-field text-sm"
                />
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="border-gray-300 text-ink-900 focus:ring-ink-700"
                />
                Active
              </label>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Venue</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure? This deactivates it immediately; you can restore it by editing it again.</p>
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

export default AdminVenues;
