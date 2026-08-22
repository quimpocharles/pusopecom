import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import Products from '../Products';
import productService from '../../services/productService';

// Layout pulls in Header/Footer/CartDrawer/QuickAddModal/AnnouncementBar,
// each with their own store dependencies unrelated to this test — passthrough.
vi.mock('../../components/layout/Layout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../../components/common/SEO', () => ({ default: () => null }));
vi.mock('../../components/products/ProductCard', () => ({ default: () => <div>card</div> }));
vi.mock('../../components/products/ProductCardSkeleton', () => ({ default: () => <div data-testid="card-skeleton" /> }));
vi.mock('../../components/ui/Pagination', () => ({ default: () => null }));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => <div>loading</div> }));

vi.mock('../../store/cartStore', () => ({
  default: () => ({ openQuickAdd: vi.fn() }),
}));

vi.mock('../../services/activityService', () => ({
  default: { trackSearch: vi.fn() },
  getSessionId: vi.fn(() => 'sess-1'),
}));

vi.mock('../../services/productService', () => ({
  default: {
    getProducts: vi.fn().mockResolvedValue({
      data: [],
      pagination: { page: 1, totalPages: 1, total: 0, limit: 24 },
    }),
    getSearchSuggestions: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

// Records the current location.search so tests can assert the URL params the
// top tabs actually navigate to (setSearchParams writes here).
function LocationProbe({ onChange }) {
  onChange(useLocation().search);
  return null;
}

function renderProducts(initialEntry) {
  let currentSearch = '';
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/products" element={<Products />} />
      </Routes>
      <LocationProbe onChange={(s) => { currentSearch = s; }} />
    </MemoryRouter>
  );
  return {
    getSearch: () => currentSearch,
    waitForTabs: () => waitFor(
      () => expect(screen.getByTestId('product-top-tabs')).toBeInTheDocument()
    ),
    tab: (label) => within(screen.getByTestId('product-top-tabs')).getByRole('button', { name: label }),
  };
}

describe('Products — top tabs are global collection navigation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('UAAP + Men → only gender=men, league=UAAP cleared', async () => {
    const { getSearch, waitForTabs, tab } = renderProducts('/products?league=UAAP');
    await waitForTabs();
    fireEvent.click(tab('Men'));
    await waitFor(() => {
      expect(getSearch()).not.toContain('league=');
      expect(getSearch()).toContain('gender=men');
    });
  });

  it('UAAP + Women → clears the UAAP context', async () => {
    const { getSearch, waitForTabs, tab } = renderProducts('/products?league=UAAP');
    await waitForTabs();
    fireEvent.click(tab('Women'));
    await waitFor(() => {
      expect(getSearch()).not.toContain('league=');
      expect(getSearch()).toContain('gender=women');
    });
  });

  it('UAAP + Shop All → clears league/team/gender/sale', async () => {
    const { getSearch, waitForTabs, tab } = renderProducts('/products?league=UAAP&team=Gilas%20Pilipinas&gender=men&sale=true');
    await waitForTabs();
    fireEvent.click(tab('Shop All'));
    await waitFor(() => {
      expect(getSearch()).not.toMatch(/(league|team|gender|sale)=/);
    });
  });

  it('a team-scoped navigation keeps the team/league context as an explicit combined query', async () => {
    // Selecting a specific UAAP team (via the nav/team filter) must keep team
    // AND league — those come from the URL, not the top tabs.
    const { getSearch, waitForTabs, tab } = renderProducts('/products?league=UAAP&team=Gilas%20Pilipinas');
    await waitForTabs();
    expect(getSearch()).toContain('league=UAAP');
    expect(getSearch()).toContain('team=Gilas%20Pilipinas');
  });

  it('direct /products?league=UAAP&gender=men works as a combined filter', async () => {
    const { getSearch, waitForTabs, tab } = renderProducts('/products?league=UAAP&gender=men');
    await waitForTabs();
    expect(getSearch()).toContain('league=UAAP');
    expect(getSearch()).toContain('gender=men');
  });

  it('keeps sort and resets page when switching top tabs (existing behaviors preserved)', async () => {
    const { getSearch, waitForTabs, tab } = renderProducts('/products?league=UAAP&sort=most-bought&page=2');
    await waitForTabs();
    fireEvent.click(tab('Men'));
    await waitFor(() => {
      expect(getSearch()).toContain('gender=men');
      expect(getSearch()).not.toContain('league=');
      expect(getSearch()).toContain('sort=most-bought');
      expect(getSearch()).toContain('page=1'); // page resets to 1 on navigation
    });
  });

  it('a league/team context exposes a working Clear Filters control (hasFilters includes league/team)', async () => {
    const { getSearch, waitForTabs } = renderProducts('/products?league=UAAP&team=Gilas%20Pilipinas');
    await waitForTabs();

    // The Filters button is highlighted because a league/team filter is active.
    const filtersButton = screen.getAllByRole('button').find((b) => b.textContent.trim() === 'Filters');
    expect(filtersButton.className).toMatch(/bg-ink-900/);

    // Opening the Filters drawer shows a "Clear all" control.
    fireEvent.click(filtersButton);
    const clearAll = await screen.findByRole('button', { name: /Clear all/i });
    fireEvent.click(clearAll);
    await waitFor(() => {
      expect(getSearch()).not.toMatch(/(league|team|gender|sport|category|sale)=/);
    });
  });

  it('search input syncs with the URL search param on a fresh/direct ?search= load', async () => {
    renderProducts('/products?search=jersey&league=UAAP');
    await waitFor(() => expect(screen.getByTestId('product-top-tabs')).toBeInTheDocument());

    // The search box auto-opens (URL has ?search=) and the input reflects it.
    const input = await screen.findByLabelText(/Search products/i);
    expect(input).toHaveValue('jersey');
  });

  it('shows a skeleton card grid (not a blank page) while products are loading', async () => {
    // Hold the products request open so the grid stays in its loading state.
    vi.mocked(productService.getProducts).mockImplementationOnce(() => new Promise(() => {}));

    render(
      <MemoryRouter initialEntries={['/products']}>
        <Routes><Route path="/products" element={<Products />} /></Routes>
      </MemoryRouter>
    );

    // The top tabs render immediately, and the grid shows skeletons —
    // an immediate, stable structure rather than a blank page + spinner.
    await waitFor(() => expect(screen.getByTestId('product-top-tabs')).toBeInTheDocument());
    const skeletons = screen.getAllByTestId('card-skeleton');
    expect(skeletons.length).toBe(8); // matches the rendered grid count
  });
});
