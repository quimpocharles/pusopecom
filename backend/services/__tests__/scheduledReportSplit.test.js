import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import prisma from '../../lib/prisma.js';

// Integration-style, like routes/__tests__/reports.test.js — the six
// compute functions this wires together already have full correctness
// coverage there against the real test DB. This file only tests the new
// plumbing: does the daily slot actually fan out into six emails, each
// with correct download links referencing a real archived run, and does
// the skip path behave when there are no recipients — without re-mocking
// every repository each of the six computeXReport functions touches.
vi.mock('../emailService.js', () => ({
  sendDailyBusinessReportEmail: vi.fn().mockResolvedValue(undefined),
  sendScheduledReportEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../repositories/reportRecipientRepository.js', () => ({
  findActiveEmails: vi.fn(),
}));

const emailService = await import('../emailService.js');
const reportRecipientRepository = await import('../../repositories/reportRecipientRepository.js');
const { generateAndSendDailyBusinessReport } = await import('../dailyBusinessReportService.js');

const MARKER_EMAIL = `scheduled-split-test-${Date.now()}@test.local`;

const EXPECTED_TYPES = [
  'executive_daily_report',
  'sales_report',
  'inventory_report',
  'fulfillment_report',
  'fit_check_analytics_report',
  'organization_performance_report',
];

afterAll(async () => {
  await prisma.reportRun.deleteMany({ where: { recipients: { has: MARKER_EMAIL } } });
});

beforeEach(() => {
  emailService.sendScheduledReportEmail.mockClear();
});

describe('generateAndSendDailyBusinessReport — Reports Module Redesign, Phase 3 six-way split', () => {
  it('sends exactly six emails, one per report workspace, each with a dashboard link and three download links (no attachments)', async () => {
    reportRecipientRepository.findActiveEmails.mockResolvedValue([MARKER_EMAIL]);

    await generateAndSendDailyBusinessReport();

    expect(emailService.sendScheduledReportEmail).toHaveBeenCalledTimes(6);

    const calledTypes = emailService.sendScheduledReportEmail.mock.calls.map(([, opts]) => opts.title);
    expect(calledTypes).toHaveLength(6);
    expect(new Set(calledTypes).size).toBe(6); // six distinct titles, not the same report six times

    for (const [recipients, opts] of emailService.sendScheduledReportEmail.mock.calls) {
      expect(recipients).toEqual([MARKER_EMAIL]);
      expect(opts).not.toHaveProperty('attachments');
      expect(opts.dashboardLink).toContain('/admin/reports');
      expect(Array.isArray(opts.keyStats)).toBe(true);

      // Scheduled Report Email Redesign — every format links through the
      // admin frontend's download-redirect route, never a raw API URL, and
      // every link for one email carries the SAME runId (one archived run
      // per report, not per format).
      expect(opts.downloadLinks.xlsx).toContain('/admin/reports/exports/download?runId=');
      expect(opts.downloadLinks.xlsx).toContain('format=xlsx');
      expect(opts.downloadLinks.csv).toContain('format=csv');
      expect(opts.downloadLinks.pdf).toContain('format=pdf');
      const runIdFromXlsx = new URL(opts.downloadLinks.xlsx).searchParams.get('runId');
      const runIdFromCsv = new URL(opts.downloadLinks.csv).searchParams.get('runId');
      const runIdFromPdf = new URL(opts.downloadLinks.pdf).searchParams.get('runId');
      expect(runIdFromCsv).toBe(runIdFromXlsx);
      expect(runIdFromPdf).toBe(runIdFromXlsx);
    }
  }, 60000);

  it('archives all six report types as sent, each with the SAME id referenced by its email\'s download links, and independently downloadable from the Archive', async () => {
    reportRecipientRepository.findActiveEmails.mockResolvedValue([MARKER_EMAIL]);

    await generateAndSendDailyBusinessReport();

    const callsByTitle = new Map(emailService.sendScheduledReportEmail.mock.calls.map(([, opts]) => [opts.title, opts]));

    for (const type of EXPECTED_TYPES) {
      const [run] = await prisma.reportRun.findMany({
        where: { type, recipients: { has: MARKER_EMAIL } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });
      expect(run, `expected an archived run for ${type}`).toBeTruthy();
      expect(run.status).toBe('sent');
      expect(run.data).toBeTruthy();

      // The archived run's real id must match the id embedded in the
      // corresponding email's download links — proof the "archive first,
      // generate links against that id, then send" ordering actually wired
      // up correctly for this specific run, not just that some run exists.
      const matchingEmail = [...callsByTitle.values()].find((opts) =>
        opts.downloadLinks.xlsx.includes(`runId=${run.id}`)
      );
      expect(matchingEmail, `expected an email whose download links reference run ${run.id} (${type})`).toBeTruthy();
    }
  }, 60000);

  it('skips all six with no email sent when there are no active recipients', async () => {
    reportRecipientRepository.findActiveEmails.mockResolvedValue([]);
    const originalAdminEmail = process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_EMAIL;

    try {
      await generateAndSendDailyBusinessReport();
      expect(emailService.sendScheduledReportEmail).not.toHaveBeenCalled();

      for (const type of EXPECTED_TYPES) {
        const [run] = await prisma.reportRun.findMany({
          where: { type, status: 'skipped', recipients: { isEmpty: true } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        });
        expect(run, `expected a skipped run for ${type}`).toBeTruthy();
        if (run) await prisma.reportRun.delete({ where: { id: run.id } });
      }
    } finally {
      if (originalAdminEmail !== undefined) process.env.ADMIN_EMAIL = originalAdminEmail;
    }
  }, 60000);

  it('archives the computed data even when the email send fails, so the report stays recoverable from the Archive', async () => {
    reportRecipientRepository.findActiveEmails.mockResolvedValue([MARKER_EMAIL]);
    // All six reports run concurrently (Promise.all) — mockRejectedValueOnce
    // would apply to whichever call happens to land first in wall-clock
    // time, not necessarily this specific report, so match by argument
    // instead to reliably fail only the one this test asserts on.
    emailService.sendScheduledReportEmail.mockImplementation(async (recipients, opts) => {
      if (opts.title === 'Executive Daily Report') {
        throw new Error('MXroute API rejected the email: Authentication failed');
      }
    });

    await generateAndSendDailyBusinessReport();

    const [run] = await prisma.reportRun.findMany({
      where: { type: 'executive_daily_report', recipients: { has: MARKER_EMAIL } },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    expect(run).toBeTruthy();
    expect(run.status).toBe('failed');
    expect(run.errorMessage).toContain('Authentication failed');
    // The report was computed before the send attempt — still archived and
    // downloadable even though delivery failed.
    expect(run.data).toBeTruthy();

    // mockClear() (in beforeEach) doesn't reset a custom implementation —
    // restore the module's original default so a later test run never
    // inherits this one's rejection behavior.
    emailService.sendScheduledReportEmail.mockResolvedValue(undefined);
  }, 60000);
});
