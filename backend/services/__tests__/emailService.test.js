import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Capture every call to the MXroute HTTP API transport — the email body is
// what carries the customer-facing links and the logo — the guarantee this
// suite exists for (no localhost/ngrok URLs, absolute-HTTPS logo) is
// checked on the rendered HTML, not on emailService internals.
const sent = [];
vi.mock('../emailTransport.js', () => ({
  sendEmail: vi.fn(async (opts) => {
    sent.push(opts);
    return { provider: 'mxroute-api', httpStatus: 200 };
  }),
}));

const {
  sendOrderConfirmationEmail,
  sendPaymentPendingEmail,
  sendPaymentReminderEmail,
  sendPaymentFailedEmail,
  sendOrderStatusEmail,
  sendDailyBusinessReportEmail,
  sendScheduledReportEmail,
} = await import('../emailService.js');
const { sendEmail } = await import('../emailTransport.js');

function baseOrder(overrides = {}) {
  return {
    _id: 'o1', orderNumber: 'PS-20260901-ABCD', createdAt: new Date('2026-09-01T10:00:00Z'),
    paymentMethod: 'xendit', paymentStatus: 'paid', orderStatus: 'paid', total: 1500,
    subtotal: 1500, shippingFee: 0, shippingMethod: 'domestic_flat_rate',
    shippingAddress: { fullName: 'Maria Santos', phone: '0917', country: 'Philippines', address: '1 Rizal', city: 'QC', province: 'NCR', zipCode: '1000' },
    items: [{ name: 'Gilas Jersey', price: 1500, quantity: 1, size: 'M', color: 'Blue' }],
    passes: [],
    ...overrides,
  };
}

describe('transactional email URLs — production-safe by construction', () => {
  beforeEach(() => {
    sent.length = 0;
    sendEmail.mockClear();
    vi.stubEnv('FRONTEND_URL', 'https://isolated-old-crayon.ngrok-free.dev');
    vi.stubEnv('EMAIL_LOGO_URL', undefined);
    vi.stubEnv('EMAIL_USER', 'support@pusostore.com');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('10. every email in this file — including scheduled reports — sends via the MXroute HTTP API transport; no SMTP/nodemailer usage remains', async () => {
    await sendOrderConfirmationEmail('fan@example.com', baseOrder());
    await sendScheduledReportEmail(['finance@pusostore.com'], {
      title: 'Sales Report', dateStr: 'Sep 2026', keyStats: [['Orders', '10']],
      dashboardLink: 'https://pusostore.com/admin/reports/sales',
      downloadLinks: { xlsx: 'https://pusostore.com/x', csv: 'https://pusostore.com/c', pdf: 'https://pusostore.com/p' },
    });
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it('6. sender is the bare EMAIL_USER address (no display-name format — the API mangled it in a real test)', async () => {
    await sendOrderConfirmationEmail('fan@example.com', baseOrder());
    expect(sent[0].from).toBe('support@pusostore.com');
  });

  it('7. recipient is passed through unchanged', async () => {
    await sendOrderConfirmationEmail('fan@example.com', baseOrder());
    expect(sent[0].to).toBe('fan@example.com');
  });

  it('order confirmation "View Order" link uses an absolute HTTPS production URL, not the dev FRONTEND_URL', async () => {
    await sendOrderConfirmationEmail('fan@example.com', baseOrder());
    const html = sent[0].html;
    expect(html).toContain('https://pusostore.com/order/PS-20260901-ABCD');
    expect(html).not.toContain('ngrok');
    expect(html).not.toContain('localhost');
    expect(html).not.toContain('http://');
  });

  it('the email logo is an absolute HTTPS production URL (puso-white.png), not the dev host', async () => {
    await sendOrderConfirmationEmail('fan@example.com', baseOrder({ passes: [] }));
    const html = sent[0].html;
    // The logo URL is resolved lazily at send time, so the ngrok FRONTEND_URL
    // stubbed in beforeEach is live here — this assertion only holds because
    // the guard sanitized it, which is exactly the regression this test pins.
    expect(html).toContain('https://pusostore.com/puso-white.png');
    expect(html).not.toContain('ngrok');
    expect(html).not.toContain('localhost');
  });

  it('EMAIL_LOGO_URL overrides the logo outright (still requires absolute HTTPS)', async () => {
    vi.stubEnv('EMAIL_LOGO_URL', 'https://res.cloudinary.com/example/image/upload/logo.png');
    await sendOrderConfirmationEmail('fan@example.com', baseOrder());
    expect(sent[0].html).toContain('https://res.cloudinary.com/example/image/upload/logo.png');
    expect(sent[0].html).not.toContain('ngrok');
  });

  it('11. Pass QR images remain plain remote <img> tags in the HTML body, unchanged by the transport migration', async () => {
    await sendOrderConfirmationEmail('fan@example.com', baseOrder({
      passes: [{
        _id: 'pass-1', status: 'issued', qrToken: 'tok-1',
        qrCodeUrl: 'https://res.cloudinary.com/dzps2jbk3/image/upload/puso-shop/pass-qr/tok-1.png',
        passEvent: { name: 'UAAP Finals', images: [] },
        passTier: { name: 'GA' },
      }],
    }));
    const html = sent[0].html;
    expect(html).toContain('<img src="https://res.cloudinary.com/dzps2jbk3/image/upload/puso-shop/pass-qr/tok-1.png"');
  });

  it('8. subject is passed through unchanged', async () => {
    await sendPaymentReminderEmail('fan@example.com', baseOrder(), '6 hours');
    expect(sent[0].subject).toBe('Reminder: Complete Payment (6 hours left) - PS-20260901-ABCD');
  });

  // MXroute's HTTP API does not RFC-2047-encode non-ASCII characters in the
  // SMTP Subject header the way nodemailer did automatically — an em dash
  // (—) in a subject arrived at Gmail as mojibake ("â€"", UTF-8 bytes
  // misread as Windows-1252). The HTML body is unaffected (it declares its
  // own charset and mostly uses HTML entities, not raw Unicode), so this is
  // specifically a subject-line guard.
  it('every subject line is plain ASCII — no raw Unicode that MXroute\'s API would corrupt in the Subject header', async () => {
    await sendOrderConfirmationEmail('fan@example.com', baseOrder());
    await sendPaymentPendingEmail('fan@example.com', baseOrder());
    await sendPaymentReminderEmail('fan@example.com', baseOrder(), '6 hours');
    await sendPaymentFailedEmail('fan@example.com', baseOrder(), 'failed');
    await sendOrderStatusEmail('fan@example.com', baseOrder(), 'shipped');
    await sendScheduledReportEmail(['finance@pusostore.com'], {
      title: 'Sales Report', dateStr: 'Sep 2026', keyStats: [['Orders', '10']],
      dashboardLink: 'https://pusostore.com/admin/reports/sales', downloadLinks: {},
    });

    for (const msg of sent) {
      // eslint-disable-next-line no-control-regex
      expect(msg.subject).toMatch(/^[\x00-\x7F]*$/);
    }
  });

  it('payment reminder "Complete Payment" link is production-safe', async () => {
    await sendPaymentReminderEmail('fan@example.com', baseOrder(), '6 hours');
    const html = sent[0].html;
    expect(html).toContain('https://pusostore.com/order/PS-20260901-ABCD');
    expect(html).not.toContain('ngrok');
    expect(html).not.toContain('localhost');
    expect(html).not.toContain('http://');
  });

  it('16. payment pending "Complete Payment" link is production-safe and uses the new transport', async () => {
    await sendPaymentPendingEmail('fan@example.com', baseOrder());
    const html = sent[0].html;
    expect(html).toContain('https://pusostore.com/order/PS-20260901-ABCD');
    expect(html).not.toContain('ngrok');
    expect(html).not.toContain('localhost');
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('payment failed and order-status emails are production-safe', async () => {
    await sendPaymentFailedEmail('fan@example.com', baseOrder(), 'failed');
    await sendOrderStatusEmail('fan@example.com', baseOrder(), 'shipped');
    for (const msg of sent) {
      expect(msg.html).toContain('https://pusostore.com/');
      expect(msg.html).not.toContain('ngrok');
      expect(msg.html).not.toContain('localhost');
      expect(msg.html).not.toContain('http://');
    }
  });

  it('sendDailyBusinessReportEmail sends one API call per recipient (MXroute is one-recipient-per-call)', async () => {
    const report = {
      date: new Date('2026-09-01'),
      sales: { grossRevenue: 0, orders: 0, netRevenue: 0, avgOrderValue: 0, shippingRevenue: 0, refundedAmount: 0 },
      products: { topSelling: [], noSalesCount: 0, lowStock: 0, outOfStock: 0 },
      passes: { ticketsSold: 0, revenue: 0, checkedIn: 0, topSelling: [] },
      organizations: { byOrganization: [], byLeague: [] },
      customers: { newCustomers: 0, returningCustomers: 0, repeatPurchaseRate: 0 },
      payments: { successful: 0, failed: 0, pending: 0, refunded: 0, byMethod: [] },
      shipping: { awaitingShipment: 0, inTransit: 0, delivered: 0 },
      tryOn: { sessions: 0, successful: 0, failed: 0, successRate: 0, conversion: { triedUsers: 0, purchases: 0, conversionRate: 0, revenue: 0 }, mostTriedOn: [] },
      fulfillment: { pendingFulfillment: 0, exceptions: 0, returnsAwaitingApproval: 0, refundQueue: 0 },
    };
    await sendDailyBusinessReportEmail(['exec1@pusostore.com', 'exec2@pusostore.com'], report);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sent.map((s) => s.to).sort()).toEqual(['exec1@pusostore.com', 'exec2@pusostore.com']);
  });

  describe('sendScheduledReportEmail — HTML summary + download links (no attachments)', () => {
    const send = () => sendScheduledReportEmail(['finance@pusostore.com'], {
      title: 'Sales Report',
      dateStr: 'September 2026',
      keyStats: [['Gross Revenue', '₱84,250.50'], ['Orders', 37]],
      dashboardLink: 'https://pusostore.com/admin/reports/sales',
      downloadLinks: {
        xlsx: 'https://pusostore.com/admin/reports/exports/download?runId=run-1&format=xlsx',
        csv: 'https://pusostore.com/admin/reports/exports/download?runId=run-1&format=csv',
        pdf: 'https://pusostore.com/admin/reports/exports/download?runId=run-1&format=pdf',
      },
    });

    it('sends via the MXroute API transport, one call per recipient, with no attachments field at all', async () => {
      await send();
      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(sent[0]).not.toHaveProperty('attachments');
      expect(sent[0].to).toBe('finance@pusostore.com');
    });

    it('renders keyStats as a real HTML <table>, not an image or a screenshot', async () => {
      await send();
      const html = sent[0].html;
      expect(html).toContain('<table');
      expect(html).toContain('Gross Revenue');
      expect(html).toContain('₱84,250.50');
      expect(html).toContain('Orders');
      expect(html).toContain('37');
    });

    it('includes a "View Full Report" link pointing at the dashboard, production-safe', async () => {
      await send();
      const html = sent[0].html;
      expect(html).toContain('View Full Report');
      expect(html).toContain('https://pusostore.com/admin/reports/sales');
      expect(html).not.toContain('ngrok');
      expect(html).not.toContain('localhost');
    });

    it('includes a distinct clickable link for each available download format', async () => {
      await send();
      const html = sent[0].html;
      expect(html).toContain('href="https://pusostore.com/admin/reports/exports/download?runId=run-1&format=xlsx"');
      expect(html).toContain('href="https://pusostore.com/admin/reports/exports/download?runId=run-1&format=csv"');
      expect(html).toContain('href="https://pusostore.com/admin/reports/exports/download?runId=run-1&format=pdf"');
      expect(html).toContain('Download Excel');
      expect(html).toContain('Download CSV');
      expect(html).toContain('Download PDF');
    });

    it('omits a download link for a format that was not supplied, rather than rendering a dead link', async () => {
      await sendScheduledReportEmail(['finance@pusostore.com'], {
        title: 'Sales Report', dateStr: 'September 2026', keyStats: [['Orders', 10]],
        dashboardLink: 'https://pusostore.com/admin/reports/sales',
        downloadLinks: { xlsx: 'https://pusostore.com/admin/reports/exports/download?runId=run-2&format=xlsx' },
      });
      const html = sent[0].html;
      expect(html).toContain('Download Excel');
      expect(html).not.toContain('Download CSV');
      expect(html).not.toContain('Download PDF');
    });

    // Security review, Scheduled Report Email Redesign — every value currently
    // reaching keyStats/title is static (verified: no product/org/customer
    // name ever lands in a report's `summary` array, only in its `sheets`,
    // which this email never renders). This test pins the defense-in-depth
    // control itself rather than relying on that staying true by convention —
    // a future summary row containing a name should still be safe.
    describe('HTML-escapes dynamic values (defense in depth — nothing user-controlled reaches these today, but nothing should be trusted to stay that way)', () => {
      it('escapes HTML-special characters in a keyStats label', async () => {
        await sendScheduledReportEmail(['finance@pusostore.com'], {
          title: 'Sales Report', dateStr: 'September 2026',
          keyStats: [['<script>alert(1)</script>', 10]],
          dashboardLink: 'https://pusostore.com/admin/reports/sales', downloadLinks: {},
        });
        const html = sent[0].html;
        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      });

      it('escapes HTML-special characters in a keyStats value', async () => {
        await sendScheduledReportEmail(['finance@pusostore.com'], {
          title: 'Sales Report', dateStr: 'September 2026',
          keyStats: [['Note', '<img src=x onerror=alert(1)>']],
          dashboardLink: 'https://pusostore.com/admin/reports/sales', downloadLinks: {},
        });
        const html = sent[0].html;
        expect(html).not.toContain('<img src=x onerror=alert(1)>');
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
      });

      it('escapes HTML-special characters in the report title', async () => {
        await sendScheduledReportEmail(['finance@pusostore.com'], {
          title: '<b>Sales</b> Report', dateStr: 'September 2026',
          keyStats: [['Orders', 10]],
          dashboardLink: 'https://pusostore.com/admin/reports/sales', downloadLinks: {},
        });
        const html = sent[0].html;
        expect(html).not.toContain('<b>Sales</b> Report');
        expect(html).toContain('&lt;b&gt;Sales&lt;/b&gt; Report');
      });

      it('leaves plain alphanumeric/currency/percent values unaffected (no double-escaping, no mangled output)', async () => {
        await send();
        const html = sent[0].html;
        expect(html).toContain('Gross Revenue');
        expect(html).toContain('₱84,250.50');
        expect(html).toContain('37');
      });
    });
  });
});
