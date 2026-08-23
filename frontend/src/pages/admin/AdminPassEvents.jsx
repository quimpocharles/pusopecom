import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, TicketIcon } from '@heroicons/react/24/outline';
import passEventService from '../../services/passEventService';
import venueService from '../../services/venueService';
import organizationService from '../../services/organizationService';
import leagueService from '../../services/leagueService';
import ImageField from '../../components/admin/ImageField';

const emptyForm = {
  name: '', slug: '', description: '', organizationId: '', leagueId: '', teamNames: [], venueId: '',
  startsAt: '', endsAt: '', salesStartAt: '', salesEndAt: '', active: true, image: '',
};

const generateSlug = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Institutions/Athletes only — Leagues are sourced straight from the
// existing League model (below), not re-entered here as a second,
// separately-managed Organization. See the League optgroup in the picker.
const ORG_KIND_GROUPS = [
  { kind: 'institution', label: 'Institutions' },
  { kind: 'athlete', label: 'Athletes' },
];

// datetime-local inputs need "YYYY-MM-DDTHH:mm", ISO strings have seconds/Z
const toDateTimeLocal = (iso) => (iso ? iso.slice(0, 16) : '');

// Start-of-day "today" in the same reference frame the browser's
// datetime-local value and `new Date(value)` already use — comparing by
// calendar day, not exact instant, so an event starting later today is
// still valid (only a start strictly before today is rejected). Also used
// as the <input min> so the native picker can't select a past date at all.
const startOfTodayDateTimeLocal = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T00:00`;
};

// `originalStartsAt` is the event's persisted value at the moment Edit was
// opened (unset when creating). An edit that leaves the start date exactly
// as it already was is exempt from the "not before today" rule — an
// existing historical event must stay editable (e.g. to fix its
// description, or deactivate it) without forcing its start date forward
// just to pass validation. The moment the admin actually changes it to a
// *different* value, that new value is held to the normal rule like any
// other start date — including a different past date, which is still
// rejected.
function validateStartsAt(startsAt, originalStartsAt) {
  if (!startsAt) return '';
  if (originalStartsAt && startsAt === originalStartsAt) return '';
  const start = new Date(startsAt);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (start < startOfToday) return 'Start date cannot be before today.';
  return '';
}

function validateEndsAt(startsAt, endsAt) {
  if (!endsAt || !startsAt) return '';
  if (new Date(endsAt) < new Date(startsAt)) return 'End date must be on or after the start date.';
  return '';
}

const AdminPassEvents = () => {
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ startsAt: '', endsAt: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [teamsLoading, setTeamsLoading] = useState(false);
  // The raw event being hydrated into the edit form, and whether reference
  // data (leagues, in particular) has finished loading — see the hydration
  // effect below for why these are split from `form` instead of resolving
  // organizationId/leagueId synchronously inside openEdit.
  const [referenceDataLoaded, setReferenceDataLoaded] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  // The event's own persisted start date, snapshotted when Edit opens — see
  // validateStartsAt's comment for why this needs to be tracked separately
  // from `form.startsAt` (which changes as the admin edits).
  const [originalStartsAt, setOriginalStartsAt] = useState('');

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
    const venuesLoaded = venueService.getAll().then((res) => setVenues(res.data)).catch((err) => console.error('Failed to load venues:', err));
    const orgsLoaded = organizationService.getAll().then((res) => setOrganizations(res.data)).catch((err) => console.error('Failed to load organizations:', err));
    const leaguesLoaded = leagueService.getLeagues().then((res) => setLeagues(res.data)).catch((err) => console.error('Failed to load leagues:', err));
    Promise.all([venuesLoaded, orgsLoaded, leaguesLoaded]).then(() => setReferenceDataLoaded(true));
  }, [fetchEvents]);

  const selectedLeague = leagues.find((l) => l._id === form.leagueId);

  // Edit-form hydration for Organization/League — deliberately NOT done
  // synchronously inside openEdit, because matching a League-sourced
  // event's Organization back to its League picker option requires
  // `leagues` to already be loaded (a name lookup, not just a stable id —
  // see the comment on the League optgroup below). If openEdit ran that
  // match immediately, a admin opening Edit before the mount-time
  // leagues fetch resolves would permanently see "Select..." (the exact
  // organization/team persistence bug this fixes). Waiting for
  // `referenceDataLoaded` and re-running once it flips true fixes that
  // race without guessing at a fetch-completion order. This effect never
  // touches `form.teamNames` — that's set directly in openEdit and must
  // survive this hydration untouched (see openEdit's own comment).
  useEffect(() => {
    if (!editingEvent || !referenceDataLoaded) return;
    const matchedLeague = editingEvent.organization?.kind === 'league'
      ? leagues.find((l) => l.name === editingEvent.organization.name)
      : null;
    setForm((prev) => ({
      ...prev,
      organizationId: matchedLeague ? '' : (editingEvent.organizationId || editingEvent.organization?._id || ''),
      leagueId: matchedLeague?._id || '',
    }));
    // Hydration is a one-time thing per edit session — clearing this
    // prevents a later leagues/organizations refetch from re-running the
    // match and clobbering a subsequent intentional org change the admin
    // made via handleOrgPickerChange.
    setEditingEvent(null);
  }, [editingEvent, referenceDataLoaded, leagues]);

  // Institution/Athlete-sourced events pick from real Team rows. League-
  // sourced ones use league.teams directly (see handleOrgPickerChange's own
  // comment) — this fetch only ever matters for the former. teamsLoading
  // gates the "No teams available" message so it never renders as a false
  // negative while this request is still in flight (including right after
  // openEdit sets organizationId during hydration).
  useEffect(() => {
    if (!form.organizationId) {
      setTeams([]);
      setTeamsLoading(false);
      return;
    }
    setTeamsLoading(true);
    organizationService.getTeams(form.organizationId)
      .then((res) => setTeams(res.data))
      .catch(() => setTeams([]))
      .finally(() => setTeamsLoading(false));
  }, [form.organizationId]);

  // League-sourced options are the flat League.teams roster (the same data
  // AdminLeagues.jsx already manages — not re-entered here); Organization-
  // sourced options are real Team.name values. Either way, a Pass Event just
  // records which display names were picked (teamNames), not a Team
  // relation — see the schema comment on PassEvent.teamNames for why.
  const teamNameOptions = form.leagueId ? (selectedLeague?.teams || []) : teams.map((t) => t.name);

  const orgPickerValue = form.leagueId ? `league:${form.leagueId}` : form.organizationId ? `org:${form.organizationId}` : '';

  // The <input min> floor: normally today, but relaxed down to the event's
  // own original start date when that's earlier — so the browser's native
  // range check doesn't flag an unchanged historical value as invalid and
  // block submission before validateStartsAt ever gets a chance to allow
  // it. The picker still can't go any earlier than that.
  const minStartsAt = originalStartsAt && originalStartsAt < startOfTodayDateTimeLocal()
    ? originalStartsAt
    : startOfTodayDateTimeLocal();

  const handleOrgPickerChange = (e) => {
    const [kind, id] = e.target.value.split(':');
    setForm({
      ...form,
      leagueId: kind === 'league' ? id : '',
      organizationId: kind === 'org' ? id : '',
      teamNames: [],
    });
  };

  const toggleTeamName = (name) => {
    setForm((prev) => ({
      ...prev,
      teamNames: prev.teamNames.includes(name)
        ? prev.teamNames.filter((n) => n !== name)
        : [...prev.teamNames, name],
    }));
  };

  const closeModal = () => {
    setModalOpen(false);
    // Prevents a still-in-flight hydration (referenceDataLoaded flipping
    // true after this edit session was abandoned) from later applying
    // this event's organization/league onto whatever the admin opens next.
    setEditingEvent(null);
  };

  const openAdd = () => {
    setEditingId(null);
    setEditingEvent(null);
    setOriginalStartsAt('');
    setForm(emptyForm);
    setError('');
    setFieldErrors({ startsAt: '', endsAt: '' });
    setModalOpen(true);
  };

  const openEdit = (event) => {
    setEditingId(event._id);
    // Organization/League matching is deferred to the hydration effect
    // above (it needs `leagues` loaded first) — everything else, including
    // teamNames, is the event's own persisted data and can be applied
    // immediately, independent of that race.
    setEditingEvent(event);
    const startsAt = toDateTimeLocal(event.startsAt);
    setOriginalStartsAt(startsAt);
    setForm({
      name: event.name,
      slug: event.slug,
      description: event.description || '',
      organizationId: '',
      leagueId: '',
      teamNames: event.teamNames || [],
      venueId: event.venueId || event.venue?._id || '',
      startsAt,
      endsAt: toDateTimeLocal(event.endsAt),
      salesStartAt: toDateTimeLocal(event.salesStartAt),
      salesEndAt: toDateTimeLocal(event.salesEndAt),
      active: event.active,
      image: event.images?.[0] || '',
    });
    setError('');
    setFieldErrors({ startsAt: '', endsAt: '' });
    setModalOpen(true);
  };

  const handleNameChange = (e) => {
    const name = e.target.value;
    setForm((prev) => ({ ...prev, name, ...(editingId ? {} : { slug: generateSlug(name) }) }));
  };

  const handleStartsAtChange = (e) => {
    const startsAt = e.target.value;
    setForm((prev) => ({ ...prev, startsAt }));
    setFieldErrors((prev) => ({
      ...prev,
      startsAt: validateStartsAt(startsAt, originalStartsAt),
      // The start date changed — re-check whatever end date is already
      // selected against it, rather than leaving a now-stale error (or lack
      // of one) in place. The end date value itself is never touched here.
      endsAt: validateEndsAt(startsAt, form.endsAt),
    }));
  };

  const handleEndsAtChange = (e) => {
    const endsAt = e.target.value;
    setForm((prev) => ({ ...prev, endsAt }));
    setFieldErrors((prev) => ({ ...prev, endsAt: validateEndsAt(form.startsAt, endsAt) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const startsAtError = validateStartsAt(form.startsAt, originalStartsAt);
    const endsAtError = validateEndsAt(form.startsAt, form.endsAt);
    if (startsAtError || endsAtError) {
      setFieldErrors({ startsAt: startsAtError, endsAt: endsAtError });
      setError('Please fix the highlighted date fields before saving.');
      return;
    }

    setSaving(true);
    try {
      const { image, ...rest } = form;
      const payload = {
        ...rest,
        salesStartAt: form.salesStartAt || null,
        salesEndAt: form.salesEndAt || null,
        images: image ? [image] : [],
      };
      if (editingId) {
        await passEventService.update(editingId, payload);
      } else {
        await passEventService.create(payload);
      }
      closeModal();
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
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <div className="flex items-center gap-3">
                        {event.images?.[0] ? (
                          <img src={event.images[0]} alt="" className="w-8 h-8 object-cover border border-ink-200 flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 bg-ink-200 flex-shrink-0" />
                        )}
                        {event.name}
                      </div>
                    </td>
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
              <button onClick={closeModal} className="p-1.5 hover:bg-ink-200">
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

              <ImageField label="Event Image" value={form.image} onChange={(v) => setForm({ ...form, image: v })} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
                  <select
                    value={orgPickerValue}
                    onChange={handleOrgPickerChange}
                    required
                    className="input-field text-sm bg-white"
                  >
                    <option value="">Select...</option>
                    {leagues.length > 0 && (
                      <optgroup label="Leagues">
                        {leagues.map((league) => (
                          <option key={league._id} value={`league:${league._id}`}>{league.name}</option>
                        ))}
                      </optgroup>
                    )}
                    {ORG_KIND_GROUPS.map(({ kind, label }) => {
                      const inGroup = organizations.filter((org) => org.kind === kind);
                      if (inGroup.length === 0) return null;
                      return (
                        <optgroup key={kind} label={label}>
                          {inGroup.map((org) => (
                            <option key={org._id} value={`org:${org._id}`}>{org.name}</option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teams (optional)</label>
                  {!orgPickerValue ? (
                    <p className="text-xs text-gray-400 border border-ink-200 px-3 py-2">Select an organization first</p>
                  ) : !form.leagueId && teamsLoading ? (
                    // League-sourced options come from `leagues` (already
                    // loaded by now) with no extra request, so this only
                    // ever applies to the real Team-row fetch below —
                    // without it, this briefly (and wrongly) read as "No
                    // teams available" while that fetch was still in
                    // flight, including right after edit-form hydration.
                    <p className="text-xs text-gray-400 border border-ink-200 px-3 py-2">Loading teams…</p>
                  ) : teamNameOptions.length === 0 ? (
                    <p className="text-xs text-gray-400 border border-ink-200 px-3 py-2">No teams available</p>
                  ) : (
                    <div className="border border-ink-200 max-h-32 overflow-y-auto px-3 py-2 space-y-1.5">
                      {teamNameOptions.map((name) => (
                        <label key={name} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.teamNames.includes(name)}
                            onChange={() => toggleTeamName(name)}
                            className="border-gray-300 text-ink-900 focus:ring-ink-700 flex-shrink-0"
                          />
                          {name}
                        </label>
                      ))}
                    </div>
                  )}
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
                    onChange={handleStartsAtChange}
                    min={minStartsAt}
                    required
                    aria-invalid={!!fieldErrors.startsAt}
                    className="input-field text-sm"
                  />
                  {fieldErrors.startsAt && <p className="text-red-600 text-sm mt-1">{fieldErrors.startsAt}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ends</label>
                  <input
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={handleEndsAtChange}
                    min={form.startsAt || startOfTodayDateTimeLocal()}
                    required
                    aria-invalid={!!fieldErrors.endsAt}
                    className="input-field text-sm"
                  />
                  {fieldErrors.endsAt && <p className="text-red-600 text-sm mt-1">{fieldErrors.endsAt}</p>}
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
                <button type="button" onClick={closeModal} className="btn-secondary">
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
