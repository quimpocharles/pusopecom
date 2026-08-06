import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import prisma from '../../lib/prisma.js';

// Integration-style, like routes/__tests__/reports.test.js — the six
// compute functions this wires together already have full correctness
// coverage there against the real test DB. This file only tests the new
// plumbing: does the daily slot actually fan out into six emails, each
// with the right attachments, and does the skip path behave when there
// are no recipients — without re-mocking every repository each of the
// six computeXReport functions touches.
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
  it('sends exactly six emails, one per report workspace, each with a 3-item attachments array and a dashboard link', async () => {
    reportRecipientRepository.findActiveEmails.mockResolvedValue([MARKER_EMAIL]);

    await generateAndSendDailyBusinessReport();

    expect(emailService.sendScheduledReportEmail).toHaveBeenCalledTimes(6);

    const calledTypes = emailService.sendScheduledReportEmail.mock.calls.map(([, opts]) => opts.title);
    expect(calledTypes).toHaveLength(6);
    expect(new Set(calledTypes).size).toBe(6); // six distinct titles, not the same report six times

    for (const [recipients, opts] of emailService.sendScheduledReportEmail.mock.calls) {
      expect(recipients).toEqual([MARKER_EMAIL]);
      expect(Array.isArray(opts.attachments)).toBe(true);
      expect(opts.attachments).toHaveLength(3);
      const extensions = opts.attachments.map((a) => a.filename.split('.').pop()).sort();
      expect(extensions).toEqual(['csv', 'pdf', 'xlsx']);
      expect(opts.dashboardLink).toContain('/admin/reports');
      expect(Array.isArray(opts.keyStats)).toBe(true);
    }
  }, 60000);

  it('archives all six report types as sent, each independently downloadable from the Archive', async () => {
    reportRecipientRepository.findActiveEmails.mockResolvedValue([MARKER_EMAIL]);

    await generateAndSendDailyBusinessReport();

    for (const type of EXPECTED_TYPES) {
      const [run] = await prisma.reportRun.findMany({
        where: { type, recipients: { has: MARKER_EMAIL } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });
      expect(run, `expected an archived run for ${type}`).toBeTruthy();
      expect(run.status).toBe('sent');
      expect(run.data).toBeTruthy();
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
});
