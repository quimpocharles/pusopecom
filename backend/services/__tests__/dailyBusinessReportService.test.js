import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../repositories/orderRepository.js', () => ({ find: vi.fn(), count: vi.fn() }));
vi.mock('../../repositories/productRepository.js', () => ({ find: vi.fn(), count: vi.fn() }));
vi.mock('../../repositories/tryOnLogRepository.js', () => ({ find: vi.fn() }));
vi.mock('../../repositories/organizationRepository.js', () => ({ find: vi.fn() }));
vi.mock('../../repositories/reportRecipientRepository.js', () => ({ findActiveEmails: vi.fn() }));
vi.mock('../../repositories/reportRunRepository.js', () => ({ create: vi.fn().mockResolvedValue({ id: 'run-1' }) }));
vi.mock('../emailService.js', () => ({ sendDailyBusinessReportEmail: vi.fn().mockResolvedValue(undefined) }));

const orderRepository = await import('../../repositories/orderRepository.js');
const productRepository = await import('../../repositories/productRepository.js');
const tryOnLogRepository = await import('../../repositories/tryOnLogRepository.js');
const organizationRepository = await import('../../repositories/organizationRepository.js');
const reportRecipientRepository = await import('../../repositories/reportRecipientRepository.js');
const reportRunRepository = await import('../../repositories/reportRunRepository.js');
const emailService = await import('../emailService.js');
const {
  generateDailyBusinessReport,
  generateBusinessReportForRange,
  generateAndSendDailyBusinessReport,
  generateAndSendWeeklyBusinessReport,
  generateAndSendMonthlyBusinessReport,
  generateAndSendQuarterlyBusinessReport,
  dailyBusinessReportToExportShape,
} = await import('../dailyBusinessReportService.js');

function order(overrides = {}) {
  return {
    _id: 'order-1', user: null, email: 'buyer@test.local',
    paymentStatus: 'paid', paymentMethod: 'maya', orderStatus: 'processing',
    total: 500, shippingFee: 99, items: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.ADMIN_EMAIL;
  productRepository.count.mockResolvedValue(0);
  productRepository.find.mockResolvedValue([]);
  tryOnLogRepository.find.mockResolvedValue([]);
  organizationRepository.find.mockResolvedValue([]);
  orderRepository.count.mockResolvedValue(1);
});

describe('generateDailyBusinessReport — sales', () => {
  it('computes gross/net/shipping revenue, excluding refunded orders from gross but not from net deduction', async () => {
    orderRepository.find.mockResolvedValueOnce([
      order({ total: 1000, shippingFee: 100, paymentStatus: 'paid' }),
      order({ total: 500, shippingFee: 50, paymentStatus: 'paid' }),
      order({ total: 300, paymentStatus: 'refunded' }),
      order({ total: 200, paymentStatus: 'pending' }),
    ]);

    const report = await generateDailyBusinessReport();

    expect(report.sales.orders).toBe(2); // paid only
    expect(report.sales.grossRevenue).toBe(1500);
    expect(report.sales.shippingRevenue).toBe(150);
    expect(report.sales.refundedAmount).toBe(300);
    expect(report.sales.netRevenue).toBe(1200); // gross - refunded
    expect(report.sales.avgOrderValue).toBe(750);
  });

  it('reports zeros cleanly with no orders', async () => {
    orderRepository.find.mockResolvedValueOnce([]);
    const report = await generateDailyBusinessReport();
    expect(report.sales).toMatchObject({ orders: 0, grossRevenue: 0, avgOrderValue: 0, netRevenue: 0 });
  });

  it('does not include Checkout Abandonment, Refund Requests, or Support Issues sections at all', async () => {
    orderRepository.find.mockResolvedValueOnce([]);
    const report = await generateDailyBusinessReport();
    expect(report).not.toHaveProperty('operations');
    expect(JSON.stringify(report)).not.toMatch(/abandonment|support/i);
  });

  it('queries orderRepository with yesterday\'s range in Philippine time, not today\'s', async () => {
    orderRepository.find.mockResolvedValueOnce([]);
    // Fixed instant: 2026-08-02 06:00 UTC = 2026-08-02 14:00 PHT
    await generateDailyBusinessReport(new Date('2026-08-02T06:00:00Z'));

    const [{ where }] = orderRepository.find.mock.calls[0];
    // Yesterday in PHT is Aug 1 00:00 PHT -> Aug 2 00:00 PHT, i.e. Jul 31 16:00 UTC -> Aug 1 16:00 UTC
    expect(where.createdAt.gte.toISOString()).toBe('2026-07-31T16:00:00.000Z');
    expect(where.createdAt.lt.toISOString()).toBe('2026-08-01T16:00:00.000Z');
  });
});

describe('generateDailyBusinessReport — products', () => {
  it('ranks top sellers by quantity and counts products with no sales', async () => {
    orderRepository.find.mockResolvedValueOnce([
      order({
        items: [
          { product: { _id: 'p1' }, name: 'Jersey', quantity: 3, price: 500 },
          { product: { _id: 'p2' }, name: 'Cap', quantity: 1, price: 200 },
        ],
      }),
    ]);
    productRepository.count.mockImplementation(({ where }) => {
      if (where.totalStock === 0) return 2; // out of stock
      if (where.totalStock?.lte === 5) return 4; // low stock
      return 20; // total active
    });

    const report = await generateDailyBusinessReport();

    expect(report.products.topSelling[0]).toMatchObject({ name: 'Jersey', quantity: 3, revenue: 1500 });
    expect(report.products.outOfStock).toBe(2);
    expect(report.products.lowStock).toBe(4);
    expect(report.products.noSalesCount).toBe(18); // 20 active - 2 sold
  });
});

describe('generateDailyBusinessReport — organizations', () => {
  it('groups revenue by organization (resolving names), league, and legacy team string', async () => {
    orderRepository.find.mockResolvedValueOnce([
      order({
        items: [
          { product: { _id: 'p1', league: 'UAAP', team: 'FEU Tamaraws', organizationId: 'org-1' }, name: 'Jersey', quantity: 2, price: 500 },
          { product: { _id: 'p2', league: 'PBA', team: null, organizationId: null }, name: 'Cap', quantity: 1, price: 300 },
        ],
      }),
    ]);
    organizationRepository.find.mockResolvedValueOnce([{ _id: 'org-1', name: 'Far Eastern University' }]);

    const report = await generateDailyBusinessReport();

    expect(report.organizations.byOrganization).toEqual([{ name: 'Far Eastern University', revenue: 1000 }]);
    expect(report.organizations.byLeague).toEqual(
      expect.arrayContaining([{ name: 'UAAP', revenue: 1000 }, { name: 'PBA', revenue: 300 }])
    );
    expect(report.organizations.byTeam).toEqual([{ name: 'FEU Tamaraws', revenue: 1000 }]);
  });
});

describe('generateDailyBusinessReport — customers', () => {
  it('classifies a customer as new when yesterday was their only paid order, returning otherwise', async () => {
    orderRepository.find.mockResolvedValueOnce([
      order({ user: 'user-1', email: 'a@test.local', total: 500 }),
      order({ user: 'user-2', email: 'b@test.local', total: 500 }),
    ]);
    orderRepository.count.mockImplementation(({ where }) => {
      if (where.userId === 'user-1') return 1; // first ever order
      if (where.userId === 'user-2') return 4; // repeat customer
      return 0;
    });

    const report = await generateDailyBusinessReport();

    expect(report.customers.newCustomers).toBe(1);
    expect(report.customers.returningCustomers).toBe(1);
    expect(report.customers.repeatPurchaseRate).toBe(50);
  });
});

describe('generateDailyBusinessReport — payments and shipping', () => {
  it('breaks down payment status/method and shipping status across ALL orders, not just paid', async () => {
    orderRepository.find.mockResolvedValueOnce([
      // Payment Platform Redesign, Phase 2 — orderStatus values match what
      // applyPaymentResolution actually produces for each paymentStatus
      // now (paid->'paid', failed->'failed_payment', pending stays
      // unresolved->'awaiting_payment'), not the pre-Phase-2 vocabulary.
      order({ paymentStatus: 'paid', paymentMethod: 'maya', orderStatus: 'paid' }),
      order({ paymentStatus: 'failed', paymentMethod: 'maya', orderStatus: 'failed_payment' }),
      order({ paymentStatus: 'pending', paymentMethod: 'maya', orderStatus: 'awaiting_payment' }),
      order({ paymentStatus: 'paid', paymentMethod: 'maya', orderStatus: 'shipped' }),
      order({ paymentStatus: 'paid', paymentMethod: 'maya', orderStatus: 'delivered' }),
    ]);

    const report = await generateDailyBusinessReport();

    expect(report.payments).toMatchObject({ successful: 3, failed: 1, pending: 1, refunded: 0 });
    expect(report.payments.byMethod).toEqual([{ method: 'maya', count: 5 }]);
    // awaitingShipment = paid/processing/packed, only the first row qualifies
    expect(report.shipping).toEqual({ awaitingShipment: 1, inTransit: 1, delivered: 1 });
  });
});

describe('generateDailyBusinessReport — AI Try-On', () => {
  it('computes success rate and most-tried-on products, treating non-true success as failed', async () => {
    orderRepository.find.mockResolvedValueOnce([]);
    tryOnLogRepository.find.mockResolvedValueOnce([
      { product: 'p1', productName: 'Jersey', success: true },
      { product: 'p1', productName: 'Jersey', success: true },
      { product: 'p2', productName: 'Cap', success: false },
      { product: 'p3', productName: 'Shorts', success: null },
    ]);

    const report = await generateDailyBusinessReport();

    expect(report.tryOn.sessions).toBe(4);
    expect(report.tryOn.successful).toBe(2);
    expect(report.tryOn.failed).toBe(2);
    expect(report.tryOn.successRate).toBe(50);
    expect(report.tryOn.mostTriedOn[0]).toMatchObject({ productName: 'Jersey', count: 2 });
    // "conversion rate" language never appears — no purchase-linkage data exists to back it
    expect(report.tryOn).not.toHaveProperty('conversionRate');
  });
});

describe('generateAndSendDailyBusinessReport — recipients', () => {
  it('sends to active ReportRecipient emails when configured', async () => {
    orderRepository.find.mockResolvedValueOnce([]);
    reportRecipientRepository.findActiveEmails.mockResolvedValueOnce(['finance@test.local', 'ops@test.local']);

    await generateAndSendDailyBusinessReport();

    expect(emailService.sendDailyBusinessReportEmail).toHaveBeenCalledTimes(1);
    const [recipients] = emailService.sendDailyBusinessReportEmail.mock.calls[0];
    expect(recipients).toEqual(['finance@test.local', 'ops@test.local']);
  });

  it('falls back to ADMIN_EMAIL when no ReportRecipient rows exist yet', async () => {
    process.env.ADMIN_EMAIL = 'legacy-admin@test.local';
    orderRepository.find.mockResolvedValueOnce([]);
    reportRecipientRepository.findActiveEmails.mockResolvedValueOnce([]);

    await generateAndSendDailyBusinessReport();

    const [recipients] = emailService.sendDailyBusinessReportEmail.mock.calls[0];
    expect(recipients).toEqual(['legacy-admin@test.local']);
  });

  it('skips sending when there are no recipients and no ADMIN_EMAIL fallback', async () => {
    reportRecipientRepository.findActiveEmails.mockResolvedValueOnce([]);

    await generateAndSendDailyBusinessReport();

    expect(emailService.sendDailyBusinessReportEmail).not.toHaveBeenCalled();
    expect(orderRepository.find).not.toHaveBeenCalled(); // report never generated if nobody will receive it
  });
});

describe('generateAndSendDailyBusinessReport — Report Archive', () => {
  it('archives a successful run with status=sent, the full report snapshot, and the recipient list', async () => {
    orderRepository.find.mockResolvedValueOnce([]);
    reportRecipientRepository.findActiveEmails.mockResolvedValueOnce(['finance@test.local']);

    await generateAndSendDailyBusinessReport();

    expect(reportRunRepository.create).toHaveBeenCalledTimes(1);
    const [archived] = reportRunRepository.create.mock.calls[0];
    expect(archived.status).toBe('sent');
    expect(archived.recipients).toEqual(['finance@test.local']);
    expect(archived.data).toHaveProperty('sales');
    expect(archived.reportDate).toBeInstanceOf(Date);
  });

  it('archives a skipped run with no data and no recipients when nobody is configured', async () => {
    reportRecipientRepository.findActiveEmails.mockResolvedValueOnce([]);

    await generateAndSendDailyBusinessReport();

    expect(reportRunRepository.create).toHaveBeenCalledTimes(1);
    const [archived] = reportRunRepository.create.mock.calls[0];
    expect(archived.status).toBe('skipped');
    expect(archived.recipients).toEqual([]);
    expect(archived.data).toBeUndefined();
  });

  it('archives a failed run with the error message, then rethrows so the caller still sees the failure', async () => {
    orderRepository.find.mockResolvedValueOnce([]);
    reportRecipientRepository.findActiveEmails.mockResolvedValueOnce(['finance@test.local']);
    emailService.sendDailyBusinessReportEmail.mockRejectedValueOnce(new Error('SMTP down'));

    await expect(generateAndSendDailyBusinessReport()).rejects.toThrow('SMTP down');

    expect(reportRunRepository.create).toHaveBeenCalledTimes(1);
    const [archived] = reportRunRepository.create.mock.calls[0];
    expect(archived.status).toBe('failed');
    expect(archived.errorMessage).toBe('SMTP down');
    expect(archived.recipients).toEqual(['finance@test.local']);
  });

  it('a failure to archive itself never masks the real send outcome', async () => {
    orderRepository.find.mockResolvedValueOnce([]);
    reportRecipientRepository.findActiveEmails.mockResolvedValueOnce(['finance@test.local']);
    reportRunRepository.create.mockRejectedValueOnce(new Error('DB write failed'));

    await expect(generateAndSendDailyBusinessReport()).resolves.toBeUndefined();
    expect(emailService.sendDailyBusinessReportEmail).toHaveBeenCalledTimes(1);
  });
});

describe('dailyBusinessReportToExportShape', () => {
  it('maps a report snapshot into the summary/sheets shape lib/reportExport.js expects', () => {
    const data = {
      sales: { grossRevenue: 1000, netRevenue: 900, orders: 2, avgOrderValue: 500, shippingRevenue: 100, refundedAmount: 100 },
      products: { topSelling: [{ name: 'Jersey', quantity: 3, revenue: 1000 }] },
      organizations: { byOrganization: [{ name: 'FEU', revenue: 500 }], byLeague: [{ name: 'UAAP', revenue: 500 }] },
      customers: { newCustomers: 1, returningCustomers: 1 },
      payments: { successful: 2, failed: 0, pending: 0, refunded: 1, byMethod: [{ method: 'maya', count: 2 }] },
      shipping: { awaitingShipment: 1, inTransit: 0, delivered: 1 },
      tryOn: { sessions: 4, successful: 2, successRate: 50, mostTriedOn: [{ productName: 'Jersey', count: 2 }] },
    };

    const shape = dailyBusinessReportToExportShape(data);

    expect(shape.summary).toContainEqual(['Gross Revenue', 1000]);
    const sheetNames = shape.sheets.map((s) => s.name);
    expect(sheetNames).toEqual([
      'Top Selling Products', 'Sales by Organization', 'Sales by League',
      'Payments', 'Payment Methods', 'Shipping', 'Most Tried-On',
    ]);
    const paymentsSheet = shape.sheets.find((s) => s.name === 'Payments');
    expect(paymentsSheet.rows).toContainEqual({ status: 'Refunded', count: 1 });
  });
});

describe('generateBusinessReportForRange — the shared core behind every cadence', () => {
  it('returns periodStart/periodEnd matching the given range, and date for backward compatibility', async () => {
    orderRepository.find.mockResolvedValueOnce([]);
    const start = new Date('2026-07-01T00:00:00Z');
    const end = new Date('2026-08-01T00:00:00Z');

    const report = await generateBusinessReportForRange(start, end);

    expect(report.periodStart).toEqual(start);
    expect(report.periodEnd).toEqual(end);
    expect(report.date).toEqual(start);
  });
});

describe('weekly/monthly/quarterly cadences use correct Philippine-time date ranges', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('weekly covers the 7 days ending today', async () => {
    orderRepository.find.mockResolvedValueOnce([]);
    reportRecipientRepository.findActiveEmails.mockResolvedValueOnce(['ops@test.local']);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-10T06:00:00Z')); // Aug 10 14:00 PHT

    await generateAndSendWeeklyBusinessReport();

    const [{ where }] = orderRepository.find.mock.calls[0];
    expect(where.createdAt.lt.toISOString()).toBe('2026-08-09T16:00:00.000Z'); // today 00:00 PHT
    expect(where.createdAt.gte.toISOString()).toBe('2026-08-02T16:00:00.000Z'); // 7 days earlier
  });

  it('monthly covers the full previous calendar month', async () => {
    orderRepository.find.mockResolvedValueOnce([]);
    reportRecipientRepository.findActiveEmails.mockResolvedValueOnce(['ops@test.local']);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T06:00:00Z')); // Aug 1 14:00 PHT

    await generateAndSendMonthlyBusinessReport();

    const [{ where }] = orderRepository.find.mock.calls[0];
    expect(where.createdAt.gte.toISOString()).toBe('2026-06-30T16:00:00.000Z'); // Jul 1 00:00 PHT
    expect(where.createdAt.lt.toISOString()).toBe('2026-07-31T16:00:00.000Z'); // Aug 1 00:00 PHT
  });

  it('quarterly covers the full previous calendar quarter, including a year rollover', async () => {
    orderRepository.find.mockResolvedValueOnce([]);
    reportRecipientRepository.findActiveEmails.mockResolvedValueOnce(['ops@test.local']);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T06:00:00Z')); // Jan 1 14:00 PHT — Q1 start

    await generateAndSendQuarterlyBusinessReport();

    const [{ where }] = orderRepository.find.mock.calls[0];
    // Previous quarter is Oct-Dec 2025
    expect(where.createdAt.gte.toISOString()).toBe('2025-09-30T16:00:00.000Z'); // Oct 1 2025 00:00 PHT
    expect(where.createdAt.lt.toISOString()).toBe('2025-12-31T16:00:00.000Z'); // Jan 1 2026 00:00 PHT
  });
});

describe('generateAndSendWeeklyBusinessReport / Monthly / Quarterly — archiving and titles', () => {
  it('archives with the correct type and passes the correct email title', async () => {
    orderRepository.find.mockResolvedValueOnce([]);
    reportRecipientRepository.findActiveEmails.mockResolvedValueOnce(['ops@test.local']);

    await generateAndSendWeeklyBusinessReport();

    const [archived] = reportRunRepository.create.mock.calls[0];
    expect(archived.type).toBe('weekly_business_report');
    const [, , title] = emailService.sendDailyBusinessReportEmail.mock.calls[0];
    expect(title).toBe('Weekly Business Report');
  });

  it('does NOT fall back to ADMIN_EMAIL for non-daily cadences', async () => {
    process.env.ADMIN_EMAIL = 'legacy-admin@test.local';
    reportRecipientRepository.findActiveEmails.mockResolvedValueOnce([]);

    await generateAndSendMonthlyBusinessReport();

    expect(emailService.sendDailyBusinessReportEmail).not.toHaveBeenCalled();
    const [archived] = reportRunRepository.create.mock.calls[0];
    expect(archived.status).toBe('skipped');
    expect(archived.type).toBe('monthly_business_report');
  });
});
