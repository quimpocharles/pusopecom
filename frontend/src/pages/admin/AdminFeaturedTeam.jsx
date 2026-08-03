import { useState, useEffect, useCallback } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import featuredTeamService from '../../services/featuredTeamService';
import ImageField from '../../components/admin/ImageField';

const emptyForm = {
  team: '',
  headline: '',
  description: '',
  backgroundColor: '#0A2463',
  textColor: '',
  featuredImage: '',
  featuredImageAlt: '',
  ctaLabel: '',
  ctaUrl: '',
  displayMonth: '',
  startDate: '',
  endDate: '',
  active: true,
};

const AdminFeaturedTeam = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await featuredTeamService.getTeams();
      setTeams(res.data);
    } catch (err) {
      console.error('Failed to load featured teams:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const toDateInput = (iso) => (iso ? iso.slice(0, 10) : '');

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (team) => {
    setEditingId(team._id);
    setForm({
      team: team.team,
      headline: team.headline || '',
      description: team.description || '',
      backgroundColor: team.backgroundColor || '#0A2463',
      textColor: team.textColor || '',
      featuredImage: team.featuredImage || '',
      featuredImageAlt: team.featuredImageAlt || '',
      ctaLabel: team.ctaLabel || '',
      ctaUrl: team.ctaUrl || '',
      displayMonth: team.displayMonth || '',
      startDate: toDateInput(team.startDate),
      endDate: toDateInput(team.endDate),
      active: team.active,
    });
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = { ...form, startDate: form.startDate || null, endDate: form.endDate || null };
      if (editingId) {
        await featuredTeamService.updateTeam(editingId, payload);
      } else {
        await featuredTeamService.createTeam(payload);
      }
      setModalOpen(false);
      fetchTeams();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save featured team');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await featuredTeamService.deleteTeam(id);
      setDeleteConfirm(null);
      fetchTeams();
    } catch (err) {
      console.error('Failed to delete featured team:', err);
    }
  };

  const handleToggleActive = async (team) => {
    try {
      await featuredTeamService.updateTeam(team._id, { active: !team.active });
      fetchTeams();
    } catch (err) {
      console.error('Failed to toggle featured team:', err);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Featured Team</h1>
          <p className="text-sm text-gray-500 mt-1">Only one active, in-window entry shows on the homepage at a time.</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          <PlusIcon className="w-4 h-4" />
          Add Featured Team
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                <th className="px-6 py-3">Team</th>
                <th className="px-6 py-3">Display Month</th>
                <th className="px-6 py-3">Schedule</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center"><div className="w-6 h-6 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
              ) : teams.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">No featured teams yet</td></tr>
              ) : (
                teams.map((team) => (
                  <tr key={team._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{team.team}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{team.displayMonth || '—'}</td>
                    <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                      {team.startDate || team.endDate ? `${toDateInput(team.startDate) || 'any'} → ${toDateInput(team.endDate) || 'any'}` : 'Always'}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(team)}
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${team.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                      >
                        {team.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(team)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteConfirm(team._id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
              <h3 className="text-lg font-semibold text-gray-900">{editingId ? 'Edit Featured Team' : 'Add Featured Team'}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
                <input
                  type="text"
                  value={form.team}
                  onChange={(e) => setForm({ ...form, team: e.target.value })}
                  required
                  placeholder="Ateneo de Manila University"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-400 mt-1">Also used for the "Shop {'{Team}'} Gear" link filter.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Headline (optional)</label>
                <input
                  type="text"
                  value={form.headline}
                  onChange={(e) => setForm({ ...form, headline: e.target.value })}
                  placeholder="Defaults to the team name"
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

              <ImageField label="Featured Image" value={form.featuredImage} onChange={(v) => setForm({ ...form, featuredImage: v })} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image Alt Text</label>
                <input
                  type="text"
                  value={form.featuredImageAlt}
                  onChange={(e) => setForm({ ...form, featuredImageAlt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Background Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.backgroundColor || '#0A2463'} onChange={(e) => setForm({ ...form, backgroundColor: e.target.value })} className="w-10 h-9 border border-gray-300 rounded-lg cursor-pointer" />
                    <input type="text" value={form.backgroundColor} onChange={(e) => setForm({ ...form, backgroundColor: e.target.value })} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Text Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.textColor || '#ffffff'} onChange={(e) => setForm({ ...form, textColor: e.target.value })} className="w-10 h-9 border border-gray-300 rounded-lg cursor-pointer" />
                    <input type="text" value={form.textColor} onChange={(e) => setForm({ ...form, textColor: e.target.value })} placeholder="Defaults to white" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CTA Label</label>
                  <input type="text" value={form.ctaLabel} onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })} placeholder='Defaults to "Shop {Team} Gear"' className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CTA URL</label>
                  <input type="text" value={form.ctaUrl} onChange={(e) => setForm({ ...form, ctaUrl: e.target.value })} placeholder="Defaults to a team shop filter" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Month</label>
                <input
                  type="text"
                  value={form.displayMonth}
                  onChange={(e) => setForm({ ...form, displayMonth: e.target.value })}
                  placeholder="Defaults to the current month, e.g. August 2026"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <p className="text-xs text-gray-400 -mt-2">Leave either blank for no bound on that side.</p>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                Active
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Featured Team</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure? This will deactivate it. You can reactivate it later by toggling the status.</p>
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

export default AdminFeaturedTeam;
