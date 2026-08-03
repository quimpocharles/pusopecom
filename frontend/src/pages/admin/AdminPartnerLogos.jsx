import { useState, useEffect, useCallback } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import partnerLogoService from '../../services/partnerLogoService';
import ImageField from '../../components/admin/ImageField';

const emptyForm = {
  name: '',
  organization: '',
  league: '',
  logoUrl: '',
  destinationUrl: '',
  priority: 0,
  active: true,
};

const AdminPartnerLogos = () => {
  const [logos, setLogos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchLogos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await partnerLogoService.getAllLogos();
      setLogos(res.data);
    } catch (err) {
      console.error('Failed to load partner logos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogos();
  }, [fetchLogos]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm, displayOrder: logos.length });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (logo) => {
    setEditingId(logo._id);
    setForm({
      name: logo.name,
      organization: logo.organization || '',
      league: logo.league || '',
      logoUrl: logo.logoUrl,
      destinationUrl: logo.destinationUrl || '',
      priority: logo.priority,
      active: logo.active,
    });
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = { ...form, priority: Number(form.priority) || 0 };
      if (editingId) {
        await partnerLogoService.updateLogo(editingId, payload);
      } else {
        await partnerLogoService.createLogo({ ...payload, displayOrder: logos.length });
      }
      setModalOpen(false);
      fetchLogos();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save partner logo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await partnerLogoService.deleteLogo(id);
      setDeleteConfirm(null);
      fetchLogos();
    } catch (err) {
      console.error('Failed to delete partner logo:', err);
    }
  };

  const handleToggleActive = async (logo) => {
    try {
      await partnerLogoService.updateLogo(logo._id, { active: !logo.active });
      fetchLogos();
    } catch (err) {
      console.error('Failed to toggle partner logo:', err);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partner Logos</h1>
          <p className="text-sm text-gray-500 mt-1">Shown in the homepage's scrolling partner strip. Higher priority logos appear more prominently.</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          <PlusIcon className="w-4 h-4" />
          Add Logo
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                <th className="px-6 py-3">Logo</th>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Organization / League</th>
                <th className="px-6 py-3">Priority</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center"><div className="w-6 h-6 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
              ) : logos.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">No partner logos yet</td></tr>
              ) : (
                logos.map((logo) => (
                  <tr key={logo._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="w-16 h-10 bg-gray-900 rounded flex items-center justify-center p-1">
                        <img src={logo.logoUrl} alt="" className="max-w-full max-h-full object-contain" />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{logo.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{[logo.organization, logo.league].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{logo.priority}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(logo)}
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${logo.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                      >
                        {logo.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(logo)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteConfirm(logo._id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
              <h3 className="text-lg font-semibold text-gray-900">{editingId ? 'Edit Partner Logo' : 'Add Partner Logo'}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Gilas Pilipinas" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
                  <input type="text" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">League</label>
                  <input type="text" value={form.league} onChange={(e) => setForm({ ...form, league: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <ImageField label="Logo" value={form.logoUrl} onChange={(v) => setForm({ ...form, logoUrl: v })} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Destination URL (optional)</label>
                <input type="text" value={form.destinationUrl} onChange={(e) => setForm({ ...form, destinationUrl: e.target.value })} placeholder="https://..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                <p className="text-xs text-gray-400 mt-1">Higher numbers appear more prominently in the scrolling strip.</p>
              </div>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Partner Logo</h3>
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

export default AdminPartnerLogos;
