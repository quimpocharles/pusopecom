import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import AdminPromoCodes from '../AdminPromoCodes';

vi.mock('../../../services/promoCodeService', () => ({
  default: {
    getAll: vi.fn(),
    getEvents: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock('../../../services/productService', () => ({
  default: { getSearchSuggestions: vi.fn(), getProductBySlug: vi.fn() },
}));

const promoCodeService = (await import('../../../services/promoCodeService')).default;
const productService = (await import('../../../services/productService')).default;

const EVENT_A = { _id: 'evt-a', name: 'Ateneo vs College of St. Benilde', venueName: 'Blue Eagle Gym', startsAt: '2026-08-24T00:00:00.000Z' };
const EVENT_B = { _id: 'evt-b', name: 'FEU vs UST', venueName: 'Araneta Coliseum', startsAt: '2026-09-01T00:00:00.000Z' };

beforeEach(() => {
  vi.clearAllMocks();
  promoCodeService.getAll.mockResolvedValue({ data: [] });
  promoCodeService.getEvents.mockResolvedValue({ data: [EVENT_A, EVENT_B] });
});

async function openAddModal() {
  render(<AdminPromoCodes />);
  await waitFor(() => expect(promoCodeService.getAll).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: /add code/i }));
}

// The Discount kind <select> is always present; the event picker's own
// <select> only mounts once EVENT scope is chosen, so once both exist the
// picker is reliably the second combobox.
function getEventPickerSelect() {
  return screen.getAllByRole('combobox')[1];
}

describe('AdminPromoCodes — EVENT scope picker', () => {
  it('19. selecting an event-scoped discount kind displays the event picker as a dropdown of active events, grouped as "Events & Passes"', async () => {
    await openAddModal();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'PERCENT_EVENTS' } });

    expect(await screen.findByText('Events & Passes')).toBeInTheDocument();
    await waitFor(() => expect(promoCodeService.getEvents).toHaveBeenCalledTimes(1));
    const picker = getEventPickerSelect();
    expect(within(picker).getByText(/Ateneo vs College of St\. Benilde/)).toBeInTheDocument();
    expect(within(picker).getByText(/FEU vs UST/)).toBeInTheDocument();
    // The product picker must not also render for this scope.
    expect(screen.queryByPlaceholderText(/search products to add/i)).not.toBeInTheDocument();
  });

  it('20. picking an event from the dropdown adds it and removes it from further options (no re-fetch per pick)', async () => {
    await openAddModal();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'PERCENT_EVENTS' } });
    await waitFor(() => expect(promoCodeService.getEvents).toHaveBeenCalledTimes(1));

    fireEvent.change(getEventPickerSelect(), { target: { value: EVENT_B._id } });

    expect(await screen.findByText('FEU vs UST')).toBeInTheDocument(); // now shown as a chip
    // Picked event no longer appears among the dropdown's own options.
    expect(within(getEventPickerSelect()).queryByText(/FEU vs UST/)).not.toBeInTheDocument();
    // Still fetched only once — the dropdown reuses the one list already loaded.
    expect(promoCodeService.getEvents).toHaveBeenCalledTimes(1);
  });

  it('21. selected events display as removable chips', async () => {
    await openAddModal();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'PERCENT_EVENTS' } });
    await waitFor(() => expect(promoCodeService.getEvents).toHaveBeenCalledTimes(1));

    fireEvent.change(getEventPickerSelect(), { target: { value: EVENT_A._id } });
    const chip = await screen.findByText('Ateneo vs College of St. Benilde');
    expect(chip).toBeInTheDocument();

    // Remove it via the chip's own remove button.
    fireEvent.click(chip.closest('span').querySelector('button'));
    await waitFor(() => expect(screen.queryByText('Ateneo vs College of St. Benilde')).not.toBeInTheDocument());
    // Removing puts it back among the dropdown's pickable options.
    expect(within(getEventPickerSelect()).getByText(/Ateneo vs College of St\. Benilde/)).toBeInTheDocument();
  });

  it('22. the merchandise product picker still works unchanged for PRODUCT scope', async () => {
    productService.getSearchSuggestions.mockResolvedValue({ data: [{ name: 'Gilas Jersey', slug: 'gilas-jersey', image: null }] });
    await openAddModal();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'PERCENT_ITEMS' } });

    expect(await screen.findByText('Merchandise')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/search products to add/i), { target: { value: 'Gilas' } });
    await waitFor(() => expect(productService.getSearchSuggestions).toHaveBeenCalledWith('Gilas'));
    // The event picker must not render for this scope.
    expect(screen.queryByText('Events & Passes')).not.toBeInTheDocument();
  });

  it('23. default ORDER-scoped kind shows neither picker — existing behavior unchanged', async () => {
    await openAddModal();
    // Default kind is "Percent off order" — no Applies To picker at all, and
    // only the Discount kind combobox exists.
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    expect(screen.queryByPlaceholderText(/search products to add/i)).not.toBeInTheDocument();
    expect(promoCodeService.getEvents).not.toHaveBeenCalled();
  });
});
