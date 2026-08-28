import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

// Launch-readiness audit, Fix 2 — dedicated, focused file for the new
// per-type archive authorization, separate from the existing
// reports.test.js (not run here), whose mocked req.user carries no
// staffProfile at all and so always passes under the bootstrap rule —
// it never exercised real department-scoped denial. This file uses the
// REAL requirePermission/requireAnyPermission/hasPermission (only
// authenticate/isAdmin are mocked, to make req.user's staffProfile
// controllable), same convention as promoCodes.test.js /
// settingsPaymentGateway.test.js.
//
// Note: there is no real "finance_report" or "customers_report"
// ReportRunType — the live Finance/Customers reports (routes/reports.js
// GET /finance, /customers) are computed on demand and never archived to
// ReportRun (confirmed via services/dailyBusinessReportService.js's
// SCHEDULED_REPORT_DEFS — only six workspace types are ever archived, plus
// the three bundled cadence types). These tests exercise the exact same
// mechanism (type-scoped permission) against real archived types instead:
// executive_daily_report (needs REPORTS_EXECUTIVE_VIEW — a Finance-dept
// default) and fit_check_analytics_report (needs REPORTS_FITCHECK_VIEW — a
// Marketing-dept default, which Finance does NOT hold).

let currentUser = { _id: 'reports-archive-test-admin', role: 'admin', staffProfile: null };

vi.mock('../../middleware/auth.js', async () => {
  const actual = await vi.importActual('../../middleware/auth.js');
  return {
    ...actual,
    authenticate: (req, res, next) => { req.user = currentUser; next(); },
    isAdmin: (req, res, next) => next(),
  };
});

vi.mock('../../services/dailyBusinessReportService.js', async () => {
  const actual = await vi.importActual('../../services/dailyBusinessReportService.js');
  return {
    ...actual,
    generateAndSendDailyBusinessReport: vi.fn().mockResolvedValue(undefined),
    generateAndSendWeeklyBusinessReport: vi.fn().mockResolvedValue(undefined),
    generateAndSendMonthlyBusinessReport: vi.fn().mockResolvedValue(undefined),
    generateAndSendQuarterlyBusinessReport: vi.fn().mockResolvedValue(undefined),
  };
});

const { default: reportsRouter } = await import('../reports.js');
const dailyBusinessReportService = await import('../../services/dailyBusinessReportService.js');

const app = express();
app.use(express.json());
app.use('/api/reports', reportsRouter);

const MARKER = `ReportsArchivePermTest${Date.now()}`;
const createdRunIds = [];

async function makeRun(type, overrides = {}) {
  const run = await prisma.reportRun.create({
    data: {
      type,
      status: 'sent',
      reportDate: new Date('2026-08-01'),
      data: { note: MARKER },
      recipients: [],
      ...overrides,
    },
  });
  createdRunIds.push(run.id);
  return run;
}

function asFinance() {
  currentUser = { _id: 'reports-archive-test-admin', role: 'admin', staffProfile: { department: 'finance', permissions: [] } };
}
function asMarketing() {
  currentUser = { _id: 'reports-archive-test-admin', role: 'admin', staffProfile: { department: 'marketing', permissions: [] } };
}
function asExecutive() {
  currentUser = { _id: 'reports-archive-test-admin', role: 'admin', staffProfile: { department: 'executive', permissions: [] } };
}

afterAll(async () => {
  await prisma.reportRun.deleteMany({ where: { id: { in: createdRunIds } } });
  await prisma.$disconnect();
});

describe('Report archive — per-type authorization', () => {
  it('7. Finance user can access an Executive-type archive (finance holds reports.executive.view by default)', async () => {
    const run = await makeRun('executive_daily_report');
    asFinance();

    const list = await request(app).get('/api/reports/archive?type=executive_daily_report');
    expect(list.status).toBe(200);
    expect(list.body.data.some((r) => r._id === run.id)).toBe(true);

    const detail = await request(app).get(`/api/reports/archive/${run.id}`);
    expect(detail.status).toBe(200);
  }, 20000);

  it('7b. Finance user can also download a Sales-type archive (finance holds reports.sales.view by default too)', async () => {
    const run = await makeRun('sales_report', {
      data: { totalRevenue: 1000, totalOrders: 2, averageOrderValue: 500, revenueOverTime: [], salesByCategory: [], salesBySport: [] },
    });
    asFinance();

    const download = await request(app).get(`/api/reports/archive/${run.id}/download`);
    expect(download.status).toBe(200);
  }, 20000);

  it('8. Finance user cannot access a Fit Check-type archive (not in finance\'s default bundle)', async () => {
    const run = await makeRun('fit_check_analytics_report');
    asFinance();

    const detail = await request(app).get(`/api/reports/archive/${run.id}`);
    expect(detail.status).toBe(403);

    const download = await request(app).get(`/api/reports/archive/${run.id}/download`);
    expect(download.status).toBe(403);

    // Filtered out of the caller's own unfiltered list, never silently included.
    const list = await request(app).get('/api/reports/archive');
    expect(list.body.data.some((r) => r._id === run.id)).toBe(false);

    // An explicit ?type= for a type the caller lacks is rejected outright, not silently emptied.
    const filteredList = await request(app).get('/api/reports/archive?type=fit_check_analytics_report');
    expect(filteredList.status).toBe(403);
  }, 20000);

  it('9. Marketing (Fit Check permission only) cannot access an Executive-type archive', async () => {
    const run = await makeRun('executive_daily_report');
    asMarketing();

    const detail = await request(app).get(`/api/reports/archive/${run.id}`);
    expect(detail.status).toBe(403);

    // Marketing's own type (fit_check_analytics_report) still works.
    const ownRun = await makeRun('fit_check_analytics_report');
    const ownDetail = await request(app).get(`/api/reports/archive/${ownRun.id}`);
    expect(ownDetail.status).toBe(200);
  }, 20000);

  it('10. Archive regeneration obeys the same type-specific permission', async () => {
    // quarterly_business_report maps to reports.executive.view (the bundled
    // cadence's closest single-permission analog — see reports.js comment).
    asMarketing();
    const denied = await request(app).post('/api/reports/archive/regenerate').send({ frequency: 'quarterly' });
    expect(denied.status).toBe(403);
    expect(dailyBusinessReportService.generateAndSendQuarterlyBusinessReport).not.toHaveBeenCalled();

    asExecutive();
    const allowed = await request(app).post('/api/reports/archive/regenerate').send({ frequency: 'quarterly' });
    expect(allowed.status).toBe(201);
    expect(dailyBusinessReportService.generateAndSendQuarterlyBusinessReport).toHaveBeenCalledOnce();

    // 'daily' has no single type (fans out into all six workspace reports)
    // — falls back to the same senior permission, so Marketing is denied
    // this one too.
    asMarketing();
    const dailyDenied = await request(app).post('/api/reports/archive/regenerate').send({ frequency: 'daily' });
    expect(dailyDenied.status).toBe(403);
    expect(dailyBusinessReportService.generateAndSendDailyBusinessReport).not.toHaveBeenCalled();
  }, 20000);
});
