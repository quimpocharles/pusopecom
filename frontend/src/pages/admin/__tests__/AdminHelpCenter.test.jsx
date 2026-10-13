import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminHelpCenter from '../AdminHelpCenter';

vi.mock('../../../services/helpService', () => ({
  default: { getCategories: vi.fn(), getArticles: vi.fn() },
}));

const helpService = (await import('../../../services/helpService')).default;

const CATEGORIES = [
  { id: 'getting-started', label: 'Getting Started', description: 'Basics', articleCount: 2 },
  { id: 'returns-refunds', label: 'Returns & Refunds', description: 'Refunds', articleCount: 1 },
];

const ARTICLES = [
  { slug: 'platform-overview', categoryId: 'getting-started', title: 'Platform Overview', summary: 'What Puso Shop is.' },
  { slug: 'admin-dashboard-overview', categoryId: 'getting-started', title: 'Admin Dashboard Overview', summary: 'What you see on login.' },
  { slug: 'recording-and-adjusting-refunds', categoryId: 'returns-refunds', title: 'Recording and Adjusting a Refund', summary: 'How refunds move money.' },
];

function renderPage() {
  render(
    <MemoryRouter>
      <AdminHelpCenter />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  helpService.getCategories.mockResolvedValue({ data: CATEGORIES });
  helpService.getArticles.mockResolvedValue({ data: ARTICLES });
});

describe('AdminHelpCenter', () => {
  it('renders the welcome header, category chips with counts, and the full article list', async () => {
    renderPage();

    expect(await screen.findByText('Help Center')).toBeTruthy();
    expect(screen.getByText('All topics')).toBeTruthy();
    expect(screen.getByText('Getting Started (2)')).toBeTruthy();
    expect(screen.getByText('Returns & Refunds (1)')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('Platform Overview')).toBeTruthy();
      expect(screen.getByText('Admin Dashboard Overview')).toBeTruthy();
      expect(screen.getByText('Recording and Adjusting a Refund')).toBeTruthy();
    });
  });

  it('clicking a category chip re-fetches with that category filter', async () => {
    renderPage();
    await screen.findByText('Platform Overview');

    helpService.getArticles.mockResolvedValue({
      data: [ARTICLES[2]],
    });

    fireEvent.click(screen.getByText('Returns & Refunds (1)'));

    await waitFor(() => {
      expect(helpService.getArticles).toHaveBeenLastCalledWith({ category: 'returns-refunds' });
    });
    await waitFor(() => {
      expect(screen.queryByText('Platform Overview')).toBeNull();
      expect(screen.getByText('Recording and Adjusting a Refund')).toBeTruthy();
    });
  });

  it('typing in the search box re-fetches with a q param', async () => {
    renderPage();
    await screen.findByText('Platform Overview');

    helpService.getArticles.mockResolvedValue({ data: [ARTICLES[2]] });

    fireEvent.change(screen.getByLabelText('Search help articles'), { target: { value: 'refund' } });

    await waitFor(() => {
      expect(helpService.getArticles).toHaveBeenLastCalledWith({ q: 'refund' });
    });
  });

  it('shows an empty state when no articles match', async () => {
    helpService.getArticles.mockResolvedValue({ data: [] });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No articles match your search.')).toBeTruthy();
    });
  });

  it('shows an error message if the category fetch fails', async () => {
    helpService.getCategories.mockRejectedValue(new Error('network error'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Failed to load help categories.')).toBeTruthy();
    });
  });

  it('shows an error message if the article fetch fails', async () => {
    helpService.getArticles.mockRejectedValue(new Error('network error'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Failed to load help articles.')).toBeTruthy();
    });
  });

  it('each article links to its own detail route', async () => {
    renderPage();
    await screen.findByText('Platform Overview');

    const link = screen.getByText('Platform Overview').closest('a');
    expect(link.getAttribute('href')).toBe('/admin/help/platform-overview');
  });
});
