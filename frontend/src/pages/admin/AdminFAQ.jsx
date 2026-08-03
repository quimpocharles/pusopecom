import { useState, useEffect, useCallback } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import faqService from '../../services/faqService';

const emptyForm = { question: '', answer: '', active: true };

const AdminFAQ = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await faqService.getAllFaqs();
      setItems(res.data);
    } catch (err) {
      console.error('Failed to load FAQ items:', err);
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
    setError('');
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingId(item._id);
    setForm({ question: item.question, answer: item.answer, active: item.active });
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editingId) {
        await faqService.updateFaq(editingId, form);
      } else {
        await faqService.createFaq({ ...form, displayOrder: items.length });
      }
      setModalOpen(false);
      fetchItems();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save FAQ item');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await faqService.deleteFaq(id);
      setDeleteConfirm(null);
      fetchItems();
    } catch (err) {
      console.error('Failed to delete FAQ item:', err);
    }
  };

  const handleToggleActive = async (item) => {
    try {
      await faqService.updateFaq(item._id, { active: !item.active });
      fetchItems();
    } catch (err) {
      console.error('Failed to toggle FAQ item:', err);
    }
  };

  // Swap displayOrder with the neighbor above/below, then persist both —
  // same lightweight reorder approach as the dashboard widget config.
  const move = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const a = items[index];
    const b = items[target];
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    try {
      await Promise.all([
        faqService.updateFaq(a._id, { displayOrder: b.displayOrder }),
        faqService.updateFaq(b._id, { displayOrder: a.displayOrder }),
      ]);
      fetchItems();
    } catch (err) {
      console.error('Failed to reorder FAQ items:', err);
      fetchItems();
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">FAQ</h1>
          <p className="text-sm text-gray-500 mt-1">Shown on the homepage, in this order. Only active items are visible to fans.</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          <PlusIcon className="w-4 h-4" />
          Add Question
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="px-6 py-12 text-center">
            <div className="w-6 h-6 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : items.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-gray-500">No FAQ items yet</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((item, index) => (
              <li key={item._id} className="flex items-start gap-3 px-6 py-4">
                <div className="flex flex-col gap-0.5 pt-0.5">
                  <button
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed"
                  >
                    <ChevronUpIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed"
                  >
                    <ChevronDownIcon className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{item.question}</p>
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{item.answer}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggleActive(item)}
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                      item.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {item.active ? 'Active' : 'Hidden'}
                  </button>
                  <button onClick={() => openEdit(item)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteConfirm(item._id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{editingId ? 'Edit Question' : 'Add Question'}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                <input
                  type="text"
                  value={form.question}
                  onChange={(e) => setForm({ ...form, question: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Answer</label>
                <textarea
                  value={form.answer}
                  onChange={(e) => setForm({ ...form, answer: e.target.value })}
                  required
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Active (visible on the homepage)
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Question</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure? This hides it from the homepage; you can restore it by editing it again.</p>
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

export default AdminFAQ;
