import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminPassEvents from '../AdminPassEvents';

vi.mock('../../../services/passEventService', () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));
vi.mock('../../../services/venueService', () => ({
  default: { getAll: vi.fn() },
}));
vi.mock('../../../services/organizationService', () => ({
  default: { getAll: vi.fn(), getTeams: vi.fn() },
}));
vi.mock('../../../services/leagueService', () => ({
  default: { getLeagues: vi.fn() },
}));

const passEventService = (await import('../../../services/passEventService')).default;
const venueService = (await import('../../../services/venueService')).default;
const organizationService = (await import('../../../services/organizationService')).default;
const leagueService = (await import('../../../services/leagueService')).default;

function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

const VENUE = { _id: 'venue-1', name: 'Mall of Asia Arena' };
const INSTITUTION_ORG = { _id: 'org-feu', name: 'FEU', kind: 'institution' };
const LEAGUE_BRIDGE_ORG = { _id: 'org-uaap-bridge', name: 'UAAP', kind: 'league' };
const LEAGUE = { _id: 'league-uaap', name: 'UAAP', teams: ['FEU Tamaraws', 'Ateneo Blue Eagles'] };
const REAL_TEAMS = [{ _id: 't1', name: 'FEU Tamaraws' }, { _id: 't2', name: 'FEU Lady Tamaraws' }];

const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const dayAfterTomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

const institutionEvent = {
  _id: 'evt-institution', name: 'FEU Scrimmage', slug: 'feu-scrimmage', description: '',
  organizationId: INSTITUTION_ORG._id, organization: INSTITUTION_ORG,
  teamNames: ['FEU Tamaraws'], venueId: VENUE._id, venue: VENUE,
  startsAt: tomorrow, endsAt: dayAfterTomorrow, salesStartAt: null, salesEndAt: null,
  active: true, images: [], tiers: [],
};

// Already happened — startsAt/endsAt are both in the past.
const historicalEvent = {
  _id: 'evt-historical', name: 'UAAP Prelims (Past)', slug: 'uaap-prelims-past', description: '',
  organizationId: INSTITUTION_ORG._id, organization: INSTITUTION_ORG,
  teamNames: ['FEU Tamaraws'], venueId: VENUE._id, venue: VENUE,
  startsAt: twoWeeksAgo, endsAt: oneWeekAgo, salesStartAt: null, salesEndAt: null,
  active: true, images: [], tiers: [],
};

const leagueEvent = {
  _id: 'evt-league', name: 'UAAP Finals', slug: 'uaap-finals', description: '',
  organizationId: LEAGUE_BRIDGE_ORG._id, organization: LEAGUE_BRIDGE_ORG,
  teamNames: ['FEU Tamaraws'], venueId: VENUE._id, venue: VENUE,
  startsAt: tomorrow, endsAt: dayAfterTomorrow, salesStartAt: null, salesEndAt: null,
  active: true, images: [], tiers: [],
};

function setupServices({ events = [], leaguesPromise, teamsPromise } = {}) {
  passEventService.getAll.mockResolvedValue({ data: events });
  passEventService.create.mockResolvedValue({ data: {} });
  passEventService.update.mockResolvedValue({ data: {} });
  venueService.getAll.mockResolvedValue({ data: [VENUE] });
  organizationService.getAll.mockResolvedValue({ data: [INSTITUTION_ORG, LEAGUE_BRIDGE_ORG] });
  leagueService.getLeagues.mockReturnValue(leaguesPromise ?? Promise.resolve({ data: [LEAGUE] }));
  organizationService.getTeams.mockReturnValue(teamsPromise ?? Promise.resolve({ data: REAL_TEAMS }));
}

function renderPage() {
  render(<MemoryRouter><AdminPassEvents /></MemoryRouter>);
}

// This form's <label> elements aren't wired to their control via
// htmlFor/id (a pre-existing pattern, unrelated to this fix's scope), so
// getByLabelText can't find them — the label's next sibling is the actual
// input/select in every one of this form's fields.
function fieldByLabel(text) {
  return screen.getByText(text, { selector: 'label' }).nextElementSibling;
}

async function openAddModal() {
  fireEvent.click(await screen.findByRole('button', { name: /add event/i }));
}

// Row buttons are [Pencil (edit), Trash (delete)] — the "Manage tiers" icon
// is a <Link> (role="link"), not a button, so it's not in this list.
async function openEditModalFor(eventName) {
  const row = (await screen.findByText(eventName)).closest('tr');
  fireEvent.click(within(row).getAllByRole('button')[0]);
  await screen.findByText('Edit Event');
}

async function fillMinimalRequiredFields() {
  fireEvent.change(screen.getByPlaceholderText(/gilas pilipinas/i), { target: { value: 'Test Event' } });
  fireEvent.change(fieldByLabel('Venue'), { target: { value: VENUE._id } });
  fireEvent.change(fieldByLabel('Organization'), { target: { value: `org:${INSTITUTION_ORG._id}` } });
}

describe('AdminPassEvents — Event Create/Edit form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('date validation', () => {
    it('1. rejects a start date before today on create', async () => {
      setupServices();
      renderPage();
      await openAddModal();
      await fillMinimalRequiredFields();

      fireEvent.change(fieldByLabel('Starts'), { target: { value: yesterday.slice(0, 16) } });
      fireEvent.change(fieldByLabel('Ends'), { target: { value: dayAfterTomorrow.slice(0, 16) } });
      fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

      expect(await screen.findByText('Start date cannot be before today.')).toBeTruthy();
      expect(passEventService.create).not.toHaveBeenCalled();
    });

    it('2. accepts a valid (future) start date on create', async () => {
      setupServices();
      renderPage();
      await openAddModal();
      await fillMinimalRequiredFields();

      fireEvent.change(fieldByLabel('Starts'), { target: { value: tomorrow.slice(0, 16) } });
      fireEvent.change(fieldByLabel('Ends'), { target: { value: dayAfterTomorrow.slice(0, 16) } });
      fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() => expect(passEventService.create).toHaveBeenCalledTimes(1));
    });

    it('3. rejects an end date before the start date on create', async () => {
      setupServices();
      renderPage();
      await openAddModal();
      await fillMinimalRequiredFields();

      fireEvent.change(fieldByLabel('Starts'), { target: { value: dayAfterTomorrow.slice(0, 16) } });
      fireEvent.change(fieldByLabel('Ends'), { target: { value: tomorrow.slice(0, 16) } });
      fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

      expect(await screen.findByText('End date must be on or after the start date.')).toBeTruthy();
      expect(passEventService.create).not.toHaveBeenCalled();
    });

    it('4. accepts an end date equal to the start date on create', async () => {
      setupServices();
      renderPage();
      await openAddModal();
      await fillMinimalRequiredFields();

      fireEvent.change(fieldByLabel('Starts'), { target: { value: tomorrow.slice(0, 16) } });
      fireEvent.change(fieldByLabel('Ends'), { target: { value: tomorrow.slice(0, 16) } });
      fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() => expect(passEventService.create).toHaveBeenCalledTimes(1));
    });

    it('5. applies the same date validation on edit', async () => {
      setupServices({ events: [institutionEvent] });
      renderPage();
      await openEditModalFor('FEU Scrimmage');

      fireEvent.change(fieldByLabel('Starts'), { target: { value: yesterday.slice(0, 16) } });
      fireEvent.click(screen.getByRole('button', { name: /^update$/i }));

      expect(await screen.findByText('Start date cannot be before today.')).toBeTruthy();
      expect(passEventService.update).not.toHaveBeenCalled();
    });

    it('5b. editing an existing historical event WITHOUT changing its start date is allowed', async () => {
      setupServices({ events: [historicalEvent] });
      renderPage();
      await openEditModalFor('UAAP Prelims (Past)');

      // Start/End are left exactly as loaded — untouched historical dates.
      fireEvent.click(screen.getByRole('button', { name: /^update$/i }));

      await waitFor(() => expect(passEventService.update).toHaveBeenCalledTimes(1));
      expect(screen.queryByText('Start date cannot be before today.')).toBeNull();
    });

    it('5c. editing a historical event and changing its start date to ANOTHER past date is rejected', async () => {
      setupServices({ events: [historicalEvent] });
      renderPage();
      await openEditModalFor('UAAP Prelims (Past)');

      // Still in the past, but a different value than what was persisted.
      fireEvent.change(fieldByLabel('Starts'), { target: { value: yesterday.slice(0, 16) } });
      fireEvent.click(screen.getByRole('button', { name: /^update$/i }));

      expect(await screen.findByText('Start date cannot be before today.')).toBeTruthy();
      expect(passEventService.update).not.toHaveBeenCalled();
    });

    it('5d. editing a historical event and changing its start date to today/future is allowed', async () => {
      setupServices({ events: [historicalEvent] });
      renderPage();
      await openEditModalFor('UAAP Prelims (Past)');

      fireEvent.change(fieldByLabel('Starts'), { target: { value: tomorrow.slice(0, 16) } });
      fireEvent.change(fieldByLabel('Ends'), { target: { value: dayAfterTomorrow.slice(0, 16) } });
      fireEvent.click(screen.getByRole('button', { name: /^update$/i }));

      await waitFor(() => expect(passEventService.update).toHaveBeenCalledTimes(1));
    });

    it('rejects an end date before the start date on edit', async () => {
      setupServices({ events: [institutionEvent] });
      renderPage();
      await openEditModalFor('FEU Scrimmage');

      fireEvent.change(fieldByLabel('Ends'), { target: { value: yesterday.slice(0, 16) } });
      fireEvent.click(screen.getByRole('button', { name: /^update$/i }));

      expect(await screen.findByText('End date must be on or after the start date.')).toBeTruthy();
      expect(passEventService.update).not.toHaveBeenCalled();
    });

    it('6. a manually-entered invalid (past) date produces an inline validation error immediately, not just on submit', async () => {
      setupServices();
      renderPage();
      await openAddModal();

      fireEvent.change(fieldByLabel('Starts'), { target: { value: yesterday.slice(0, 16) } });

      expect(await screen.findByText('Start date cannot be before today.')).toBeTruthy();
    });

    it('7. changing the start date revalidates an already-selected end date', async () => {
      setupServices();
      renderPage();
      await openAddModal();

      fireEvent.change(fieldByLabel('Starts'), { target: { value: tomorrow.slice(0, 16) } });
      fireEvent.change(fieldByLabel('Ends'), { target: { value: tomorrow.slice(0, 16) } });
      expect(screen.queryByText('End date must be on or after the start date.')).toBeNull();

      // Push start past the already-chosen end, without touching Ends directly.
      fireEvent.change(fieldByLabel('Starts'), { target: { value: dayAfterTomorrow.slice(0, 16) } });

      expect(await screen.findByText('End date must be on or after the start date.')).toBeTruthy();
      // The end date value itself is never silently modified.
      expect(fieldByLabel('Ends').value).toBe(tomorrow.slice(0, 16));
    });
  });

  describe('organization / team persistence on edit', () => {
    it('8. populates the existing organization when editing an institution-sourced event', async () => {
      setupServices({ events: [institutionEvent] });
      renderPage();
      await openEditModalFor('FEU Scrimmage');
      await waitFor(() => {
        expect(fieldByLabel('Organization').value).toBe(`org:${INSTITUTION_ORG._id}`);
      });
    });

    it('8b. populates the existing League when editing a league-sourced event (the organization.kind fix)', async () => {
      setupServices({ events: [leagueEvent] });
      renderPage();
      await openEditModalFor('UAAP Finals');
      await waitFor(() => {
        expect(fieldByLabel('Organization').value).toBe(`league:${LEAGUE._id}`);
      });
    });

    it('9. loads and selects the existing teams when editing', async () => {
      setupServices({ events: [institutionEvent] });
      renderPage();
      await openEditModalFor('FEU Scrimmage');
      const checkbox = await screen.findByRole('checkbox', { name: 'FEU Tamaraws' });
      expect(checkbox.checked).toBe(true);
      expect(screen.getByRole('checkbox', { name: 'FEU Lady Tamaraws' }).checked).toBe(false);
    });

    it('10. does not show "No teams available" while the teams request is still loading, and does not lose the persisted selection once it resolves', async () => {
      const teamsDeferred = deferred();
      setupServices({ events: [institutionEvent], teamsPromise: teamsDeferred.promise });
      renderPage();
      await openEditModalFor('FEU Scrimmage');
      await screen.findByText('Loading teams…');
      expect(screen.queryByText('No teams available')).toBeNull();

      teamsDeferred.resolve({ data: REAL_TEAMS });

      const checkbox = await screen.findByRole('checkbox', { name: 'FEU Tamaraws' });
      expect(checkbox.checked).toBe(true);
    });

    it('11. changing the organization intentionally clears the old (now-incompatible) teams', async () => {
      setupServices({ events: [institutionEvent] });
      renderPage();
      await openEditModalFor('FEU Scrimmage');
      expect((await screen.findByRole('checkbox', { name: 'FEU Tamaraws' })).checked).toBe(true);

      fireEvent.change(fieldByLabel('Organization'), { target: { value: `league:${LEAGUE._id}` } });

      await waitFor(() => {
        expect(screen.queryByRole('checkbox', { name: 'FEU Tamaraws', checked: true })).toBeNull();
      });
    });

    it('12. the newly selected organization\'s teams can then be selected normally', async () => {
      setupServices({ events: [institutionEvent] });
      renderPage();
      await openEditModalFor('FEU Scrimmage');
      await screen.findByRole('checkbox', { name: 'FEU Tamaraws' });

      fireEvent.change(fieldByLabel('Organization'), { target: { value: `league:${LEAGUE._id}` } });

      const newCheckbox = await screen.findByRole('checkbox', { name: 'Ateneo Blue Eagles' });
      expect(newCheckbox.checked).toBe(false);
      fireEvent.click(newCheckbox);
      expect(newCheckbox.checked).toBe(true);
    });

    it('13. saving an unchanged event preserves the existing organization/team relationships', async () => {
      setupServices({ events: [institutionEvent] });
      renderPage();
      await openEditModalFor('FEU Scrimmage');
      await waitFor(() => expect(fieldByLabel('Organization').value).toBe(`org:${INSTITUTION_ORG._id}`));
      await screen.findByRole('checkbox', { name: 'FEU Tamaraws' });

      fireEvent.click(screen.getByRole('button', { name: /^update$/i }));

      await waitFor(() => expect(passEventService.update).toHaveBeenCalledTimes(1));
      const [, payload] = passEventService.update.mock.calls[0];
      expect(payload.organizationId).toBe(INSTITUTION_ORG._id);
      expect(payload.teamNames).toEqual(['FEU Tamaraws']);
    });
  });
});
