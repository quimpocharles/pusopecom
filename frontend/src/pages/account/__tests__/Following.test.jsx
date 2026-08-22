import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Following from '../Following';

vi.mock('../../../services/accountService', () => ({
  default: {
    getFollowing: vi.fn(),
    unfollowOrganization: vi.fn().mockResolvedValue({}),
  },
}));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: () => <div>loading</div> }));
vi.mock('../../../components/ui', () => ({
  default: undefined,
  Panel: ({ children }) => <div>{children}</div>,
  Pagination: () => null,
  EmptyState: () => null,
  ErrorState: () => null,
}));

const accountService = (await import('../../../services/accountService')).default;

function renderFollowing(items) {
  accountService.getFollowing.mockResolvedValue({ data: items, pagination: { page: 1, pages: 1 } });
  render(
    <MemoryRouter initialEntries={['/account/following']}>
      <Routes>
        <Route path="/account/following" element={<Following />} />
      </Routes>
    </MemoryRouter>
  );
  return waitFor(() => expect(accountService.getFollowing).toHaveBeenCalled());
}

describe('Following — kind-aware shop links', () => {
  beforeEach(() => vi.clearAllMocks());

  it('links a followed League to ?league=<name>', async () => {
    await renderFollowing([
      { _id: 'f1', organization: { _id: 'o1', name: 'UAAP', kind: 'league' } },
    ]);
    const link = screen.getByRole('link', { name: 'UAAP' });
    expect(link.getAttribute('href')).toBe('/products?league=UAAP');
  });

  it('links a followed "Team Pilipinas" league to ?league=Team%20Pilipinas', async () => {
    await renderFollowing([
      { _id: 'f4', organization: { _id: 'o4', name: 'Team Pilipinas', kind: 'league' } },
    ]);
    const link = screen.getByRole('link', { name: 'Team Pilipinas' });
    expect(link.getAttribute('href')).toBe('/products?league=Team%20Pilipinas');
  });

  it('links a followed institution (team/school) to ?team=<name>', async () => {
    await renderFollowing([
      { _id: 'f2', organization: { _id: 'o2', name: 'Gilas Pilipinas', kind: 'institution' } },
    ]);
    const link = screen.getByRole('link', { name: 'Gilas Pilipinas' });
    expect(link.getAttribute('href')).toBe('/products?team=Gilas%20Pilipinas');
  });

  it('links a followed athlete to the full catalog (no product filter exists)', async () => {
    await renderFollowing([
      { _id: 'f3', organization: { _id: 'o3', name: 'Carlos Yulo', kind: 'athlete' } },
    ]);
    const link = screen.getByRole('link', { name: 'Carlos Yulo' });
    expect(link.getAttribute('href')).toBe('/products');
  });
});
