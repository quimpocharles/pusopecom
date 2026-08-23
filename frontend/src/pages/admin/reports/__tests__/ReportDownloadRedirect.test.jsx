import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ReportDownloadRedirect from '../ReportDownloadRedirect';

vi.mock('../../../../services/reportService', () => ({
  default: { downloadArchiveRun: vi.fn() },
}));

const reportService = (await import('../../../../services/reportService')).default;

function renderPage(query) {
  render(
    <MemoryRouter initialEntries={[`/admin/reports/exports/download${query}`]}>
      <Routes>
        <Route path="/admin/reports/exports/download" element={<ReportDownloadRedirect />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ReportDownloadRedirect — the landing page a scheduled-report email\'s download link points at', () => {
  beforeEach(() => vi.clearAllMocks());

  it('triggers the same authenticated download the Archive tab\'s own button uses, with runId/format from the URL', async () => {
    reportService.downloadArchiveRun.mockResolvedValue(undefined);

    renderPage('?runId=run-123&format=csv');

    expect(await screen.findByText('Your download has started.')).toBeTruthy();
    expect(reportService.downloadArchiveRun).toHaveBeenCalledWith('run-123', 'csv');
  });

  it('defaults to xlsx when no format is specified', async () => {
    reportService.downloadArchiveRun.mockResolvedValue(undefined);

    renderPage('?runId=run-123');

    await screen.findByText('Your download has started.');
    expect(reportService.downloadArchiveRun).toHaveBeenCalledWith('run-123', 'xlsx');
  });

  it('shows a friendly error, not a raw failure, when the download fails (deleted run, stale link)', async () => {
    reportService.downloadArchiveRun.mockRejectedValue(new Error('Request failed with status code 404'));

    renderPage('?runId=missing-run&format=pdf');

    expect(await screen.findByText(/could not be downloaded/i)).toBeTruthy();
    expect(screen.getByText('Go to Report Archive')).toBeTruthy();
  });

  it('shows a friendly error and never calls the API when runId is missing from the link entirely', async () => {
    renderPage('');

    expect(await screen.findByText(/missing a report reference/i)).toBeTruthy();
    expect(reportService.downloadArchiveRun).not.toHaveBeenCalled();
  });
});
