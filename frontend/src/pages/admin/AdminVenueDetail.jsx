import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeftIcon, PlusIcon, PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import venueService from '../../services/venueService';

const emptySectionForm = { name: '' };

const AdminVenueDetail = () => {
  const { id } = useParams();
  const [venue, setVenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [sectionForm, setSectionForm] = useState(emptySectionForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchVenue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await venueService.getById(id);
      setVenue(res.data);
    } catch (err) {
      console.error('Failed to load venue:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchVenue();
  }, [fetchVenue]);

  const openAddSection = () => {
    setEditingSectionId(null);
    setSectionForm(emptySectionForm);
    setError('');
    setSectionModalOpen(true);
  };

  const openEditSection = (section) => {
    setEditingSectionId(section._id);
    setSectionForm({ name: section.name });
    setError('');
    setSectionModalOpen(true);
  };

  const handleSectionSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editingSectionId) {
        await venueService.updateSection(editingSectionId, sectionForm);
      } else {
        await venueService.createSection(id, sectionForm);
      }
      setSectionModalOpen(false);
      fetchVenue();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save section');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSection = async (sectionId) => {
    try {
      await venueService.removeSection(sectionId);
      setDeleteConfirm(null);
      fetchVenue();
    } catch (err) {
      console.error('Failed to delete section:', err);
    }
  };

  if (loading) {
    return (
      <div className="px-6 py-12 text-center">
        <div className="w-6 h-6 border-4 border-ink-900 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (!venue) {
    return <p className="text-sm text-gray-500">Venue not found.</p>;
  }

  return (
    <div>
      <Link to="/admin/venues" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeftIcon className="w-4 h-4" />
        Back to Venues
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{venue.name}</h1>
          <p className="text-sm text-gray-500">{venue.address}, {venue.city}</p>
        </div>
        <button
          onClick={openAddSection}
          className="btn-primary inline-flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          Add Section
        </button>
      </div>

      {(venue.sections || []).length === 0 ? (
        <div className="card px-6 py-12 text-center text-sm text-gray-500">
          No sections yet — add one, then attach priced tiers to it from a Pass Event.
        </div>
      ) : (
        <div className="space-y-4">
          {venue.sections.map((section) => (
            <div key={section._id} className="card p-6 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-gray-900">{section.name}</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => openEditSection(section)} className="p-1.5 text-ink-500 hover:text-ink-900 hover:bg-ink-200 transition-colors">
                  <PencilIcon className="w-4 h-4" />
                </button>
                <button onClick={() => setDeleteConfirm(section._id)} className="p-1.5 text-ink-500 hover:text-red-600 hover:bg-red-50 transition-colors">
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sectionModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{editingSectionId ? 'Edit Section' : 'Add Section'}</h3>
              <button onClick={() => setSectionModalOpen(false)} className="p-1.5 hover:bg-ink-200">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSectionSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={sectionForm.name}
                  onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                  required
                  placeholder="Lower Box A"
                  className="input-field text-sm"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
                  {saving ? 'Saving...' : editingSectionId ? 'Update' : 'Create'}
                </button>
                <button type="button" onClick={() => setSectionModalOpen(false)} className="btn-secondary">
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Section</h3>
            <p className="text-sm text-gray-600 mb-6">This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => handleDeleteSection(deleteConfirm)} className="px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminVenueDetail;
