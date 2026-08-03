import { useState, useEffect, useCallback } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import promoMessageService from '../../services/promoMessageService';

const PLACEMENTS = [
  { value: 'announcement', label: 'Announcement Bar (top of every page)' },
  { value: 'marquee', label: 'Marquee (homepage scrolling strip)' },
];

const emptyForm = {
  placement: 'announcement',
  text: '',
  link: '',
  pinned: false,
  startDate: '',
  endDate: '',
  active: true,
};

const AdminPromoMessages = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [filterPlacement, setFilterPlacement] = useState('');

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await promoMessageService.getAllMessages();
      setMessages(res.data);
    } catch (err) {
      console.error('Failed to load promo messages:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const toDateInput = (iso) => (iso ? iso.slice(0, 10) : '');

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (msg) => {
    setEditingId(msg._id);
    setForm({
      placement: msg.placement,
      text: msg.text,
      link: msg.link || '',
      pinned: msg.pinned,
      startDate: toDateInput(msg.startDate),
      endDate: toDateInput(msg.endDate),
      active: msg.active,
    });
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
        link: form.link || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
      };
      if (editingId) {
        await promoMessageService.updateMessage(editingId, payload);
      } else {
        await promoMessageService.createMessage({ ...payload, displayOrder: messages.length });
      }
      setModalOpen(false);
      fetchMessages();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save message');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await promoMessageService.deleteMessage(id);
      setDeleteConfirm(null);
      fetchMessages();
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const handleToggleActive = async (msg) => {
    try {
      await promoMessageService.updateMessage(msg._id, { active: !msg.active });
      fetchMessages();
    } catch (err) {
      console.error('Failed to toggle message:', err);
    }
  };

  const filtered = filterPlacement ? messages.filter((m) => m.placement === filterPlacement) : messages;
  const placementLabel = (value) => PLACEMENTS.find((p) => p.value === value)?.label || value;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="text-sm text-gray-500 mt-1">Powers both the top announcement bar and the homepage marquee strip.</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          <PlusIcon className="w-4 h-4" />
          Add Message
        </button>
      </div>

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

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                <th className="px-6 py-3">Message</th>
                <th className="px-6 py-3">Placement</th>
                <th className="px-6 py-3">Pinned</th>
                <th className="px-6 py-3">Schedule</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center"><div className="w-6 h-6 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">No messages found</td></tr>
              ) : (
                filtered.map((msg) => (
                  <tr key={msg._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{msg.text}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{placementLabel(msg.placement)}</td>
                    <td className="px-6 py-4 text-sm">{msg.pinned ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Pinned</span> : <span className="text-gray-400">—</span>}</td>
                    <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                      {msg.startDate || msg.endDate ? `${toDateInput(msg.startDate) || 'any'} → ${toDateInput(msg.endDate) || 'any'}` : 'Always'}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(msg)}
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${msg.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                      >
                        {msg.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(msg)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteConfirm(msg._id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
              <h3 className="text-lg font-semibold text-gray-900">{editingId ? 'Edit Message' : 'Add Message'}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Text</label>
                <input
                  type="text"
                  value={form.text}
                  onChange={(e) => setForm({ ...form, text: e.target.value })}
                  required
                  placeholder="FREE shipping on orders ₱2,000 and above"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link (optional)</label>
                <input
                  type="text"
                  value={form.link}
                  onChange={(e) => setForm({ ...form, link: e.target.value })}
                  placeholder="/products or https://..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
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
                  checked={form.pinned}
                  onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Pin (always shows first within its placement)
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Message</h3>
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

export default AdminPromoMessages;
