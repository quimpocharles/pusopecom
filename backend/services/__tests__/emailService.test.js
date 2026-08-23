import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as mailer from 'nodemailer';

// Capture the rendered `html` of every sendMail call. The email body is what
// carries the customer-facing links and the logo — the guarantee this suite
// exists for (no localhost/ngrok URLs, absolute-HTTPS logo) is checked on the
// rendered HTML, not on the emailService internals.
const sent = [];
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn(async (opts) => {
        sent.push(opts);
        return { messageId: 'test-message-id' };
      }),
    })),
  },
}));

const { sendOrderConfirmationEmail, sendPaymentPendingEmail, sendPaymentReminderEmail, sendPaymentFailedEmail, sendOrderStatusEmail } =
  await import('../emailService.js');

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

// Force a known FRONTEND_URL and assert the rendered HTML never leaks a dev
// host, even when the env var is misconfigured (the guard's actual job).
describe('transactional email URLs — production-safe by construction', () => {
  beforeEach(() => {
    sent.length = 0;
    vi.stubEnv('FRONTEND_URL', 'https://isolated-old-crayon.ngrok-free.dev');
    vi.stubEnv('EMAIL_LOGO_URL', undefined);
  });

  afterEach(() => vi.unstubAllEnvs());

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

  it('payment reminder "Complete Payment" link is production-safe', async () => {
    await sendPaymentReminderEmail('fan@example.com', baseOrder(), '6 hours');
    const html = sent[0].html;
    expect(html).toContain('https://pusostore.com/order/PS-20260901-ABCD');
    expect(sent[0].subject).toBe('Reminder: Complete Payment (6 hours left) — PS-20260901-ABCD');
    expect(html).not.toContain('ngrok');
    expect(html).not.toContain('localhost');
    expect(html).not.toContain('http://');
  });

  it('payment pending "Complete Payment" link is production-safe', async () => {
    await sendPaymentPendingEmail('fan@example.com', baseOrder());
    const html = sent[0].html;
    expect(html).toContain('https://pusostore.com/order/PS-20260901-ABCD');
    expect(html).not.toContain('ngrok');
    expect(html).not.toContain('localhost');
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
});
