import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProductDetail from '../ProductDetail';

// Heavy deps stubbed so the test can reach the breadcrumb branch without
// pulling in stores/virtual-try-on/reviews machinery.
vi.mock('../../components/layout/Layout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../../components/common/SEO', () => ({ default: () => null }));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => <div>loading</div> }));
vi.mock('../../components/products/VirtualTryOn', () => ({ default: () => null }));
vi.mock('../../components/products/ShareButton', () => ({ default: () => null }));
vi.mock('../../components/products/tryOn/tryOnButtonStyles', () => ({ TRYON_PRIMARY_BTN: '' }));

vi.mock('../../store/cartStore', () => ({ default: (sel) => sel({ addItem: vi.fn() }) }));
vi.mock('../../store/authStore', () => ({ default: () => ({ user: null, isAuthenticated: false }) }));

vi.mock('../../services/productService', () => ({
  default: {
    getProductBySlug: vi.fn(),
    getReviews: vi.fn().mockResolvedValue({ data: [] }),
    createReview: vi.fn(),
  },
}));
vi.mock('../../services/fitCheckCampaignService', () => ({
  default: { getActiveForProduct: vi.fn().mockResolvedValue(null), recordView: vi.fn() },
}));
vi.mock('../../services/activityService', () => ({
  default: { trackView: vi.fn() },
  getSessionId: vi.fn(() => 's'),
}));

const productService = (await import('../../services/productService')).default;

function renderWithProduct(product) {
  productService.getProductBySlug.mockResolvedValue({ data: product });
  render(
    <MemoryRouter initialEntries={['/products/gilas-test']}>
      <Routes>
        <Route path="/products/:slug" element={<ProductDetail />} />
      </Routes>
    </MemoryRouter>
  );
  return waitFor(() => expect(productService.getProductBySlug).toHaveBeenCalled());
}

const baseProduct = {
  _id: 'p1', name: 'Gilas Jersey', slug: 'gilas-test',
  price: 500, category: 'jersey', sport: 'basketball', gender: 'unisex',
  images: ['https://res.cloudinary.com/x.jpg'],
  sizes: [{ size: 'M', stock: 5 }], colors: [], active: true, tryOnEnabled: false,
  description: 'desc', reviews: [], reviewCount: 0, avgRating: 0,
};

describe('ProductDetail — team/league breadcrumb navigation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders a team breadcrumb link that scopes to ?team=<name>', async () => {
    const product = { ...baseProduct, team: 'Gilas Pilipinas' };
    await renderWithProduct(product);
    const link = await screen.findByRole('link', { name: 'Gilas Pilipinas' });
    expect(link.getAttribute('href')).toBe('/products?team=Gilas%20Pilipinas');
  });

  it('renders a league breadcrumb link that scopes to ?league=<name>', async () => {
    const product = { ...baseProduct, league: 'Team Pilipinas', team: 'Gilas Pilipinas' };
    await renderWithProduct(product);
    const leagueLink = await screen.findByRole('link', { name: 'Team Pilipinas' });
    expect(leagueLink.getAttribute('href')).toBe('/products?league=Team%20Pilipinas');
    const teamLink = await screen.findByRole('link', { name: 'Gilas Pilipinas' });
    expect(teamLink.getAttribute('href')).toBe('/products?team=Gilas%20Pilipinas');
  });
});
