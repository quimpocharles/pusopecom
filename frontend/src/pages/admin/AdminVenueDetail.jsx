import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeftIcon, PlusIcon, PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import venueService from '../../services/venueService';

const emptySectionForm = { name: '', seatingType: 'GENERAL_ADMISSION' };

// A visual preview only — grouped by row, plain colored squares. This is
// the admin's confirmation that the grid it generated looks right, not a
// live availability map (that's per-PassEvent, via PassEventSeat, on the
// customer-facing seat map — Stage 3, not this page).
const SeatGridPreview = ({ seats }) => {
  if (!seats.length) return <p className="text-sm text-gray-400">No seats generated yet.</p>;

  const rows = {};
  for (const seat of seats) {
    (rows[seat.row] ??= []).push(seat);
  }
  for (const row of Object.values(rows)) {
    row.sort((a, b) => Number(a.seatNumber) - Number(b.seatNumber));
  }

  return (
    <div className="space-y-1.5">
      {Object.entries(rows).map(([row, rowSeats]) => (
        <div key={row} className="flex items-center gap-1.5">
          <span className="w-6 text-xs font-medium text-gray-500 flex-shrink-0">{row}</span>
          <div className="flex flex-wrap gap-1">
            {rowSeats.map((seat) => (
              <span
                key={seat._id}
                title={seat.label}
                className="w-7 h-7 flex items-center justify-center bg-white border border-ink-200 text-[10px] font-medium text-ink-700"
              >
                {seat.seatNumber}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

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
  const [gridInputs, setGridInputs] = useState({}); // sectionId -> { rows, seatsPerRow }
  const [generating, setGenerating] = useState(null); // sectionId currently generating

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
    setSectionForm({ name: section.name, seatingType: section.seatingType });
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

  const handleGenerateGrid = async (sectionId) => {
    const { rows, seatsPerRow } = gridInputs[sectionId] || {};
    if (!rows || !seatsPerRow) return;
    setGenerating(sectionId);
    try {
      await venueService.generateSeatGrid(sectionId, { rows: Number(rows), seatsPerRow: Number(seatsPerRow) });
      fetchVenue();
    } catch (err) {
      console.error('Failed to generate seat grid:', err);
    } finally {
      setGenerating(null);
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
          No sections yet — add one to start building this venue's seating.
        </div>
      ) : (
        <div className="space-y-4">
          {venue.sections.map((section) => (
            <div key={section._id} className="card p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{section.name}</h2>
                  <span className={`block text-xs font-semibold uppercase tracking-wide mt-1 ${
                    section.seatingType === 'RESERVED_SEAT' ? 'text-blue-700' : 'text-purple-700'
                  }`}>
                    {section.seatingType === 'RESERVED_SEAT' ? 'Reserved Seating' : 'General Admission'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEditSection(section)} className="p-1.5 text-ink-500 hover:text-ink-900 hover:bg-ink-200 transition-colors">
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteConfirm(section._id)} className="p-1.5 text-ink-500 hover:text-red-600 hover:bg-red-50 transition-colors">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {section.seatingType === 'RESERVED_SEAT' ? (
                <div>
                  <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-paper border border-ink-200">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Rows</label>
                      <input
                        type="number"
                        min="1"
                        defaultValue={section.rows || ''}
                        onChange={(e) => setGridInputs((prev) => ({ ...prev, [section._id]: { ...prev[section._id], rows: e.target.value } }))}
                        className="w-24 px-2 py-1.5 border border-gray-300 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Seats per row</label>
                      <input
                        type="number"
                        min="1"
                        defaultValue={section.seatsPerRow || ''}
                        onChange={(e) => setGridInputs((prev) => ({ ...prev, [section._id]: { ...prev[section._id], seatsPerRow: e.target.value } }))}
                        className="w-28 px-2 py-1.5 border border-gray-300 text-sm"
                      />
                    </div>
                    <button
                      onClick={() => handleGenerateGrid(section._id)}
                      disabled={generating === section._id}
                      className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                      {generating === section._id ? 'Generating...' : section.seats?.length ? 'Regenerate Grid' : 'Generate Grid'}
                    </button>
                    {section.seats?.length > 0 && (
                      <span className="text-xs text-gray-400">Regenerating replaces every seat in this section.</span>
                    )}
                  </div>
                  <SeatGridPreview seats={section.seats || []} />
                </div>
              ) : (
                <p className="text-sm text-gray-500">General admission — capacity is set per Pass Event tier, not here.</p>
              )}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Seating Type</label>
                <select
                  value={sectionForm.seatingType}
                  onChange={(e) => setSectionForm({ ...sectionForm, seatingType: e.target.value })}
                  className="input-field text-sm bg-white"
                >
                  <option value="GENERAL_ADMISSION">General Admission</option>
                  <option value="RESERVED_SEAT">Reserved Seating</option>
                </select>
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
            <p className="text-sm text-gray-600 mb-6">This also removes every seat in this section. This cannot be undone.</p>
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
