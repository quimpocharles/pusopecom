import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminHelpArticle from '../AdminHelpArticle';

vi.mock('../../../services/helpService', () => ({
  default: { getArticle: vi.fn() },
}));

const helpService = (await import('../../../services/helpService')).default;

const ARTICLE = {
  slug: 'recording-and-adjusting-refunds',
  categoryId: 'returns-refunds',
  title: 'Recording and Adjusting a Refund',
  summary: 'How refunds actually move money.',
  sourceRef: 'docs/REFUNDS_RUNBOOK.md §1-§3',
  verified: true,
  correction: 'The written guide says Maya/Xendit; the real gateway is ePayGames.',
  body: [
    { type: 'warning', text: 'Never record before the money has actually moved.' },
    { type: 'p', text: 'A refund is completed out-of-band first.' },
    { type: 'steps', items: ['Complete the refund with the provider first.', 'Record it here.'] },
    { type: 'list', items: ['Recompute', 'Explicit amount', 'Already sent'] },
    { type: 'note', text: 'A pending refund older than 24h triggers a reminder.' },
    { type: 'image', src: null, alt: 'not yet extracted' },
  ],
};

function renderAt(slug) {
  render(
    <MemoryRouter initialEntries={[`/admin/help/${slug}`]}>
      <Routes>
        <Route path="/admin/help/:slug" element={<AdminHelpArticle />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AdminHelpArticle', () => {
  it('renders the title, summary, correction banner, every body block, and the source footer', async () => {
    helpService.getArticle.mockResolvedValue({ data: ARTICLE });
    renderAt('recording-and-adjusting-refunds');

    expect(await screen.findByText('Recording and Adjusting a Refund')).toBeTruthy();
    expect(screen.getByText('How refunds actually move money.')).toBeTruthy();
    expect(screen.getByText(/Corrected from the written training guide:/)).toBeTruthy();
    expect(screen.getByText(/Maya\/Xendit; the real gateway is ePayGames\./)).toBeTruthy();

    expect(screen.getByText('Never record before the money has actually moved.')).toBeTruthy();
    expect(screen.getByText('A refund is completed out-of-band first.')).toBeTruthy();
    expect(screen.getByText('Complete the refund with the provider first.')).toBeTruthy();
    expect(screen.getByText('Recompute')).toBeTruthy();
    expect(screen.getByText('A pending refund older than 24h triggers a reminder.')).toBeTruthy();

    // Image block with no src renders nothing — never a broken img or fake placeholder.
    expect(screen.queryByRole('img')).toBeNull();

    expect(screen.getByText(/docs\/REFUNDS_RUNBOOK\.md/)).toBeTruthy();
    expect(screen.getByText(/verified against the live implementation/)).toBeTruthy();
  });

  it('does not render a correction banner when the article has none', async () => {
    helpService.getArticle.mockResolvedValue({ data: { ...ARTICLE, correction: undefined } });
    renderAt('recording-and-adjusting-refunds');

    await screen.findByText('Recording and Adjusting a Refund');
    expect(screen.queryByText(/Corrected from the written training guide:/)).toBeNull();
  });

  it('shows a not-found message on a 404', async () => {
    helpService.getArticle.mockRejectedValue({ response: { status: 404 } });
    renderAt('does-not-exist');

    await waitFor(() => {
      expect(screen.getByText('This article could not be found.')).toBeTruthy();
    });
  });

  it('shows a generic error message on any other failure', async () => {
    helpService.getArticle.mockRejectedValue(new Error('network error'));
    renderAt('recording-and-adjusting-refunds');

    await waitFor(() => {
      expect(screen.getByText('Failed to load this article.')).toBeTruthy();
    });
  });

  it('links back to the Help Center index', async () => {
    helpService.getArticle.mockResolvedValue({ data: ARTICLE });
    renderAt('recording-and-adjusting-refunds');

    await screen.findByText('Recording and Adjusting a Refund');
    expect(screen.getByText('Back to Help Center').closest('a').getAttribute('href')).toBe('/admin/help');
  });
});
