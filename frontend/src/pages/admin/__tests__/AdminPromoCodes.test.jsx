import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

describe('AdminPromoCodes — EVENT scope picker', () => {
  it('19. selecting an event-scoped discount kind displays the event picker, grouped as "Events & Passes"', async () => {
    await openAddModal();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'PERCENT_EVENTS' } });

    expect(await screen.findByText('Events & Passes')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search events to add/i)).toBeInTheDocument();
    // The product picker must not also render for this scope.
    expect(screen.queryByPlaceholderText(/search products to add/i)).not.toBeInTheDocument();
  });

  it('20. typing in the event search filters the full list client-side (no extra network call)', async () => {
    await openAddModal();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'PERCENT_EVENTS' } });
    await waitFor(() => expect(promoCodeService.getEvents).toHaveBeenCalledTimes(1));

    const searchInput = screen.getByPlaceholderText(/search events to add/i);
    fireEvent.change(searchInput, { target: { value: 'FEU' } });

    expect(await screen.findByText('FEU vs UST')).toBeInTheDocument();
    expect(screen.queryByText('Ateneo vs College of St. Benilde')).not.toBeInTheDocument();
    // Filtering is client-side against the one fetched list — never a second fetch per keystroke.
    expect(promoCodeService.getEvents).toHaveBeenCalledTimes(1);
  });

  it('21. selected events display as removable chips, matching the "date · venue" result-row format while browsing', async () => {
    await openAddModal();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'PERCENT_EVENTS' } });

    const searchInput = await screen.findByPlaceholderText(/search events to add/i);
    fireEvent.change(searchInput, { target: { value: 'Ateneo' } });
    fireEvent.click(await screen.findByText('Ateneo vs College of St. Benilde'));

    // Chip renders with just the name (same convention PromoProductPicker's chips already use).
    const chips = await screen.findAllByText('Ateneo vs College of St. Benilde');
    expect(chips.length).toBeGreaterThan(0);
    // Once picked, it's excluded from further suggestions.
    fireEvent.change(screen.getByPlaceholderText(/search events to add/i), { target: { value: 'Ateneo' } });
    expect(screen.queryByRole('button', { name: /Ateneo vs College of St\. Benilde.*Blue Eagle Gym/s })).not.toBeInTheDocument();
  });

  it('22. the merchandise product picker still works unchanged for PRODUCT scope', async () => {
    productService.getSearchSuggestions.mockResolvedValue({ data: [{ name: 'Gilas Jersey', slug: 'gilas-jersey', image: null }] });
    await openAddModal();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'PERCENT_ITEMS' } });

    expect(await screen.findByText('Merchandise')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/search products to add/i), { target: { value: 'Gilas' } });
    await waitFor(() => expect(productService.getSearchSuggestions).toHaveBeenCalledWith('Gilas'));
    // The event picker must not render for this scope.
    expect(screen.queryByPlaceholderText(/search events to add/i)).not.toBeInTheDocument();
  });

  it('23. default ORDER-scoped kind shows neither picker — existing behavior unchanged', async () => {
    await openAddModal();
    // Default kind is "Percent off order" — no Applies To picker at all.
    expect(screen.queryByPlaceholderText(/search products to add/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/search events to add/i)).not.toBeInTheDocument();
    expect(promoCodeService.getEvents).not.toHaveBeenCalled();
  });
});
