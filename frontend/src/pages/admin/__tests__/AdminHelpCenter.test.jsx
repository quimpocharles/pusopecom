import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminHelpCenter from '../AdminHelpCenter';
import { recordArticleVisit } from '../../../utils/helpReadHistory';

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
  localStorage.clear();
  helpService.getCategories.mockResolvedValue({ data: CATEGORIES });
  helpService.getArticles.mockResolvedValue({ data: ARTICLES });
});

afterEach(() => {
  vi.useRealTimers();
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

  describe('read history indicators', () => {
    function cardFor(title) {
      return screen.getByText(title).closest('a');
    }

    it('a never-opened article shows "New" and no "Last opened" line', async () => {
      renderPage();
      await screen.findByText('Platform Overview');

      const card = cardFor('Platform Overview');
      expect(within(card).getByText('New')).toBeTruthy();
      expect(within(card).queryByText(/Last opened/)).toBeNull();
    });

    it('a previously opened article shows "✓ Read" and a relative "Last opened" time', async () => {
      recordArticleVisit('platform-overview'); // real "now" — comfortably under a minute by assertion time
      renderPage();
      await screen.findByText('Platform Overview');

      const card = cardFor('Platform Overview');
      expect(within(card).getByText('✓ Read')).toBeTruthy();
      expect(within(card).getByText(/Last opened just now/)).toBeTruthy();
    });

    it('the most recently opened article gets the accent-border highlight, and an older one does not', async () => {
      // Seeded directly with explicit, unambiguously-ordered timestamps —
      // avoids relying on two real-time calls landing in different
      // milliseconds, which isn't guaranteed.
      localStorage.setItem('pusoHelpCenterReadHistory', JSON.stringify({
        'platform-overview': '2026-10-01T00:00:00.000Z',
        'admin-dashboard-overview': '2026-10-05T00:00:00.000Z',
      }));
      renderPage();
      await screen.findByText('Platform Overview');

      expect(cardFor('Admin Dashboard Overview').className).toContain('border-primary-200');
      expect(cardFor('Platform Overview').className).not.toContain('border-primary-200');
    });

    it('opening a different article moves the highlight to it', async () => {
      localStorage.setItem('pusoHelpCenterReadHistory', JSON.stringify({ 'platform-overview': '2026-10-01T00:00:00.000Z' }));
      renderPage();
      await screen.findByText('Platform Overview');
      expect(cardFor('Platform Overview').className).toContain('border-primary-200');

      recordArticleVisit('recording-and-adjusting-refunds'); // real "now" — after the seeded Oct 1 date either way
      document.dispatchEvent(new Event('visibilitychange'));

      await waitFor(() => {
        expect(cardFor('Recording and Adjusting a Refund').className).toContain('border-primary-200');
      });
      expect(cardFor('Platform Overview').className).not.toContain('border-primary-200');
    });

    it('read/new status and the highlight are independent of each other', async () => {
      // Both read, but only one is "most recent" — the other stays Read
      // without the highlight, proving the two indicators aren't coupled.
      localStorage.setItem('pusoHelpCenterReadHistory', JSON.stringify({
        'platform-overview': '2026-10-01T00:00:00.000Z',
        'admin-dashboard-overview': '2026-10-05T00:00:00.000Z',
      }));
      renderPage();
      await screen.findByText('Platform Overview');

      const olderCard = cardFor('Platform Overview');
      expect(within(olderCard).getByText('✓ Read')).toBeTruthy();
      expect(olderCard.className).not.toContain('border-primary-200');
    });

    it('search and category filtering still work correctly alongside the indicators', async () => {
      recordArticleVisit('recording-and-adjusting-refunds');
      renderPage();
      await screen.findByText('Platform Overview');

      helpService.getArticles.mockResolvedValue({ data: [ARTICLES[2]] });
      fireEvent.click(screen.getByText('Returns & Refunds (1)'));

      await waitFor(() => {
        expect(screen.queryByText('Platform Overview')).toBeNull();
        expect(screen.getByText('Recording and Adjusting a Refund')).toBeTruthy();
      });
      expect(within(cardFor('Recording and Adjusting a Refund')).getByText('✓ Read')).toBeTruthy();
    });

    it('does not crash when localStorage is inaccessible', async () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      renderPage();
      await screen.findByText('Platform Overview');
      expect(within(cardFor('Platform Overview')).getByText('New')).toBeTruthy();
      spy.mockRestore();
    });

    it('does not crash when stored history contains malformed JSON', async () => {
      localStorage.setItem('pusoHelpCenterReadHistory', '{not valid json');
      renderPage();
      await screen.findByText('Platform Overview');
      expect(within(cardFor('Platform Overview')).getByText('New')).toBeTruthy();
    });

    it('does not crash when a stored timestamp is invalid, and shows no relative time for it', async () => {
      localStorage.setItem('pusoHelpCenterReadHistory', JSON.stringify({ 'platform-overview': 'not-a-real-date' }));
      renderPage();
      await screen.findByText('Platform Overview');

      const card = cardFor('Platform Overview');
      // Still recorded as visited (shows Read), but no bogus relative-time text is rendered.
      expect(within(card).getByText('✓ Read')).toBeTruthy();
      expect(within(card).queryByText(/Last opened/)).toBeNull();
    });

    it('picks up a visit recorded elsewhere when the component remounts', async () => {
      const { unmount } = render(<MemoryRouter><AdminHelpCenter /></MemoryRouter>);
      await screen.findByText('Platform Overview');
      expect(within(cardFor('Platform Overview')).getByText('New')).toBeTruthy();
      unmount();

      recordArticleVisit('platform-overview'); // simulates visiting the article, then navigating back
      render(<MemoryRouter><AdminHelpCenter /></MemoryRouter>);
      await screen.findByText('Platform Overview');
      expect(within(cardFor('Platform Overview')).getByText('✓ Read')).toBeTruthy();
    });
  });
});
