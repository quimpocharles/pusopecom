import { useState, useEffect, useCallback } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import navigationLinkService from '../../services/navigationLinkService';

const emptyForm = { label: '', destination: '', openInNewTab: false, highlight: false, active: true };

const AdminNavigation = () => {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Top-level links only — dropdown children aren't editable here yet (the
  // dropdown UI itself doesn't exist on the frontend; see the schema's own
  // comment on NavigationLink.parentId).
  const fetchLinks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await navigationLinkService.getAllLinks();
      setLinks(res.data.filter((l) => !l.parentId));
    } catch (err) {
      console.error('Failed to load navigation links:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (link) => {
    setEditingId(link._id);
    setForm({
      label: link.label,
      destination: link.destination,
      openInNewTab: link.openInNewTab,
      highlight: link.highlight,
      active: link.active,
    });
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editingId) {
        await navigationLinkService.updateLink(editingId, form);
      } else {
        await navigationLinkService.createLink({ ...form, displayOrder: links.length });
      }
      setModalOpen(false);
      fetchLinks();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save navigation link');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await navigationLinkService.deleteLink(id);
      setDeleteConfirm(null);
      fetchLinks();
    } catch (err) {
      console.error('Failed to delete navigation link:', err);
    }
  };

  const handleToggleActive = async (link) => {
    try {
      await navigationLinkService.updateLink(link._id, { active: !link.active });
      fetchLinks();
    } catch (err) {
      console.error('Failed to toggle navigation link:', err);
    }
  };

  const move = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= links.length) return;
    const a = links[index];
    const b = links[target];
    const next = [...links];
    [next[index], next[target]] = [next[target], next[index]];
    setLinks(next);
    try {
      await Promise.all([
        navigationLinkService.updateLink(a._id, { displayOrder: b.displayOrder }),
        navigationLinkService.updateLink(b._id, { displayOrder: a.displayOrder }),
      ]);
      fetchLinks();
    } catch (err) {
      console.error('Failed to reorder navigation links:', err);
      fetchLinks();
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Navigation</h1>
          <p className="text-sm text-gray-500 mt-1">Controls the site header's nav menu.</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          <PlusIcon className="w-4 h-4" />
          Add Link
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="px-6 py-12 text-center"><div className="w-6 h-6 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : links.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-gray-500">No navigation links yet</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {links.map((link, index) => (
              <li key={link._id} className="flex items-center gap-3 px-6 py-4">
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => move(index, -1)} disabled={index === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed">
                    <ChevronUpIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => move(index, 1)} disabled={index === links.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed">
                    <ChevronDownIcon className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{link.label} {link.highlight && <span className="text-xs text-primary-600">(highlighted)</span>}</p>
                  <p className="text-xs text-gray-500 truncate">{link.destination}{link.openInNewTab && ' · opens in new tab'}</p>
                </div>
                <button
                  onClick={() => handleToggleActive(link)}
                  className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer flex-shrink-0 ${link.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                >
                  {link.active ? 'Active' : 'Inactive'}
                </button>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => openEdit(link)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteConfirm(link._id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{editingId ? 'Edit Link' : 'Add Link'}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                <input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
                <input type="text" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} required placeholder="/products?sport=basketball" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                <p className="text-xs text-gray-400 mt-1">An internal path (e.g. /products) or a full https:// URL.</p>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.openInNewTab} onChange={(e) => setForm({ ...form, openInNewTab: e.target.checked })} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                Open in new tab
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.highlight} onChange={(e) => setForm({ ...form, highlight: e.target.checked })} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                Highlight
              </label>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Link</h3>
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

export default AdminNavigation;
