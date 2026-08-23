import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';

vi.mock('axios');
vi.mock('../../lib/logger.js', () => ({ default: { error: vi.fn(), info: vi.fn() } }));
vi.mock('../../lib/sentry.js', () => ({ default: { captureException: vi.fn() } }));

const { sendEmail } = await import('../emailTransport.js');
const logger = (await import('../../lib/logger.js')).default;
const Sentry = (await import('../../lib/sentry.js')).default;

const MXROUTE_URL = 'https://smtpapi.mxroute.com/';

describe('emailTransport.sendEmail — MXroute HTTP API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('EMAIL_HOST', 'fusion.mxrouting.net');
    vi.stubEnv('EMAIL_USER', 'support@pusostore.com');
    vi.stubEnv('EMAIL_PASSWORD', 'super-secret-value');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('1/4. sends the correct HTTP request shape and resolves on a successful submission', async () => {
    axios.post.mockResolvedValue({ status: 200, data: { success: true, message: 'Email sent successfully.' } });

    const result = await sendEmail({
      from: 'support@pusostore.com',
      to: 'fan@example.com',
      subject: 'Order Confirmed — PS-1',
      html: '<p>hi</p>',
    });

    expect(axios.post).toHaveBeenCalledWith(
      MXROUTE_URL,
      {
        server: 'fusion.mxrouting.net',
        username: 'support@pusostore.com',
        password: 'super-secret-value',
        from: 'support@pusostore.com',
        to: 'fan@example.com',
        subject: 'Order Confirmed — PS-1',
        body: '<p>hi</p>',
      },
      expect.objectContaining({ headers: { 'Content-Type': 'application/json' } })
    );
    expect(result).toEqual({ provider: 'mxroute-api', httpStatus: 200 });
  });

  it('6. correct sender is passed through unchanged', async () => {
    axios.post.mockResolvedValue({ status: 200, data: { success: true } });
    await sendEmail({ from: 'support@pusostore.com', to: 'x@example.com', subject: 's', html: 'h' });
    expect(axios.post.mock.calls[0][1].from).toBe('support@pusostore.com');
  });

  it('7. correct recipient is passed through unchanged', async () => {
    axios.post.mockResolvedValue({ status: 200, data: { success: true } });
    await sendEmail({ from: 'support@pusostore.com', to: 'recipient@example.com', subject: 's', html: 'h' });
    expect(axios.post.mock.calls[0][1].to).toBe('recipient@example.com');
  });

  it('8. correct subject is passed through unchanged', async () => {
    axios.post.mockResolvedValue({ status: 200, data: { success: true } });
    await sendEmail({ from: 'support@pusostore.com', to: 'x@example.com', subject: 'Reminder: Complete Payment', html: 'h' });
    expect(axios.post.mock.calls[0][1].subject).toBe('Reminder: Complete Payment');
  });

  it('9. HTML body is passed through unchanged as `body`', async () => {
    axios.post.mockResolvedValue({ status: 200, data: { success: true } });
    const html = '<h2>Order Confirmed!</h2><img src="https://res.cloudinary.com/qr.png" />';
    await sendEmail({ from: 'support@pusostore.com', to: 'x@example.com', subject: 's', html });
    expect(axios.post.mock.calls[0][1].body).toBe(html);
  });

  it('a bounded request timeout is always set (default 10s, same as the old SMTP connectionTimeout default) — never an unbounded hang', async () => {
    // EMAIL_TIMEOUT_MS is read once at module load, same existing pattern
    // the SMTP transporter's own connectionTimeout/greetingTimeout already
    // used — not re-read per call, so this asserts the effective default
    // rather than attempting a runtime override.
    axios.post.mockResolvedValue({ status: 200, data: { success: true } });
    await sendEmail({ from: 'a@b.com', to: 'c@d.com', subject: 's', html: 'h' });
    expect(axios.post.mock.calls[0][2].timeout).toBe(10_000);
  });

  it('2. throws when MXroute reports apiSuccess: false, and reports the provider message', async () => {
    axios.post.mockResolvedValue({ status: 200, data: { success: false, message: 'Authentication failed' } });

    await expect(sendEmail({ from: 'a@b.com', to: 'c@d.com', subject: 's', html: 'h' }))
      .rejects.toThrow('MXroute API rejected the email: Authentication failed');
  });

  it('2b. throws on an unexpected HTTP status even if data.success is missing', async () => {
    axios.post.mockResolvedValue({ status: 500, data: {} });
    await expect(sendEmail({ from: 'a@b.com', to: 'c@d.com', subject: 's', html: 'h' }))
      .rejects.toThrow('MXroute API rejected the email: HTTP 500');
  });

  it('3. throws on a network failure', async () => {
    axios.post.mockRejectedValue(Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }));
    await expect(sendEmail({ from: 'a@b.com', to: 'c@d.com', subject: 's', html: 'h' }))
      .rejects.toThrow('MXroute API request failed: ENOTFOUND');
  });

  it('3b. throws on a request timeout', async () => {
    axios.post.mockRejectedValue(Object.assign(new Error('timeout of 10000ms exceeded'), { code: 'ECONNABORTED' }));
    await expect(sendEmail({ from: 'a@b.com', to: 'c@d.com', subject: 's', html: 'h' }))
      .rejects.toThrow('MXroute API request failed: ECONNABORTED');
  });

  it('throws a clear configuration error if EMAIL_PASSWORD is missing, without ever calling the API', async () => {
    vi.stubEnv('EMAIL_PASSWORD', '');
    await expect(sendEmail({ from: 'a@b.com', to: 'c@d.com', subject: 's', html: 'h' }))
      .rejects.toThrow('Email transport is not configured');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('19. never logs or throws the password on success', async () => {
    axios.post.mockResolvedValue({ status: 200, data: { success: true } });
    await sendEmail({ from: 'a@b.com', to: 'c@d.com', subject: 's', html: 'h' });

    for (const call of logger.error.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('super-secret-value');
    }
  });

  it('19b. never logs or throws the password on API rejection', async () => {
    axios.post.mockResolvedValue({ status: 200, data: { success: false, message: 'Authentication failed' } });
    await sendEmail({ from: 'a@b.com', to: 'c@d.com', subject: 's', html: 'h' }).catch(() => {});

    for (const call of logger.error.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('super-secret-value');
    }
    for (const call of Sentry.captureException.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('super-secret-value');
    }
  });

  it('19c. never logs or throws the password on a network failure', async () => {
    axios.post.mockRejectedValue(new Error('connect ECONNREFUSED'));
    await sendEmail({ from: 'a@b.com', to: 'c@d.com', subject: 's', html: 'h' }).catch(() => {});

    for (const call of logger.error.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('super-secret-value');
    }
  });
});
