import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, TicketIcon } from '@heroicons/react/24/outline';
import passEventService from '../../services/passEventService';
import venueService from '../../services/venueService';
import organizationService from '../../services/organizationService';

const emptyForm = {
  name: '', slug: '', description: '', organizationId: '', teamId: '', venueId: '',
  startsAt: '', endsAt: '', salesStartAt: '', salesEndAt: '', active: true,
};

const generateSlug = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// datetime-local inputs need "YYYY-MM-DDTHH:mm", ISO strings have seconds/Z
const toDateTimeLocal = (iso) => (iso ? iso.slice(0, 16) : '');

const AdminPassEvents = () => {
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await passEventService.getAll();
      setEvents(res.data);
    } catch (err) {
      console.error('Failed to load pass events:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    venueService.getAll().then((res) => setVenues(res.data)).catch((err) => console.error('Failed to load venues:', err));
    organizationService.getAll().then((res) => setOrganizations(res.data)).catch((err) => console.error('Failed to load organizations:', err));
  }, [fetchEvents]);

  useEffect(() => {
    if (!form.organizationId) {
      setTeams([]);
      return;
    }
    organizationService.getTeams(form.organizationId).then((res) => setTeams(res.data)).catch(() => setTeams([]));
  }, [form.organizationId]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (event) => {
    setEditingId(event._id);
    setForm({
      name: event.name,
      slug: event.slug,
      description: event.description || '',
      organizationId: event.organizationId || event.organization?._id || '',
      teamId: event.teamId || event.team?._id || '',
      venueId: event.venueId || event.venue?._id || '',
      startsAt: toDateTimeLocal(event.startsAt),
      endsAt: toDateTimeLocal(event.endsAt),
      salesStartAt: toDateTimeLocal(event.salesStartAt),
      salesEndAt: toDateTimeLocal(event.salesEndAt),
      active: event.active,
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
      const payload = {
        ...form,
        teamId: form.teamId || null,
        salesStartAt: form.salesStartAt || null,
        salesEndAt: form.salesEndAt || null,
      };
      if (editingId) {
        await passEventService.update(editingId, payload);
      } else {
        await passEventService.create(payload);
      }
      setModalOpen(false);
      fetchEvents();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await passEventService.remove(id);
      setDeleteConfirm(null);
      fetchEvents();
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pass Events</h1>
          <p className="text-sm text-gray-500 mt-1">Ticketed events fans can buy admission Passes for.</p>
        </div>
        <button
          onClick={openAdd}
          className="btn-primary inline-flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          Add Event
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                <th className="px-6 py-3">Event</th>
                <th className="px-6 py-3">Venue</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Tiers</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="w-6 h-6 border-4 border-ink-900 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                    No events yet
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{event.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{event.venue?.name}</td>
                    <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">{new Date(event.startsAt).toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{event.tiers?.length ?? 0}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-semibold uppercase tracking-wide ${event.active ? 'text-green-700' : 'text-ink-500'}`}>
                        {event.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/admin/pass-events/${event._id}`}
                          className="p-1.5 text-ink-500 hover:text-ink-900 hover:bg-ink-200 transition-colors"
                          title="Manage tiers"
                        >
                          <TicketIcon className="w-4 h-4" />
                        </Link>
                        <button onClick={() => openEdit(event)} className="p-1.5 text-ink-500 hover:text-ink-900 hover:bg-ink-200 transition-colors">
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteConfirm(event._id)} className="p-1.5 text-ink-500 hover:text-red-600 hover:bg-red-50 transition-colors">
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
              <h3 className="text-lg font-semibold text-gray-900">{editingId ? 'Edit Event' : 'Add Event'}</h3>
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
                  placeholder="Gilas Pilipinas vs. Australia"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="input-field text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
                  <select
                    value={form.organizationId}
                    onChange={(e) => setForm({ ...form, organizationId: e.target.value, teamId: '' })}
                    required
                    className="input-field text-sm bg-white"
                  >
                    <option value="">Select...</option>
                    {organizations.map((org) => (
                      <option key={org._id} value={org._id}>{org.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Team (optional)</label>
                  <select
                    value={form.teamId}
                    onChange={(e) => setForm({ ...form, teamId: e.target.value })}
                    disabled={!form.organizationId}
                    className="input-field text-sm bg-white disabled:bg-gray-50"
                  >
                    <option value="">None</option>
                    {teams.map((team) => (
                      <option key={team._id} value={team._id}>{team.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                <select
                  value={form.venueId}
                  onChange={(e) => setForm({ ...form, venueId: e.target.value })}
                  required
                  className="input-field text-sm bg-white"
                >
                  <option value="">Select...</option>
                  {venues.map((venue) => (
                    <option key={venue._id} value={venue._id}>{venue.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Starts</label>
                  <input
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                    required
                    className="input-field text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ends</label>
                  <input
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                    required
                    className="input-field text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sales Start</label>
                  <input
                    type="datetime-local"
                    value={form.salesStartAt}
                    onChange={(e) => setForm({ ...form, salesStartAt: e.target.value })}
                    className="input-field text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sales End</label>
                  <input
                    type="datetime-local"
                    value={form.salesEndAt}
                    onChange={(e) => setForm({ ...form, salesEndAt: e.target.value })}
                    className="input-field text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400 -mt-2">Leave blank on either side for no bound.</p>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="border-gray-300 text-ink-900 focus:ring-ink-700"
                />
                Active (visible to fans)
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Event</h3>
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

export default AdminPassEvents;
