import { describe, it, expect, afterEach } from 'vitest';
import crypto from 'crypto';
import { epaygamesWebhookVerify } from '../epaygamesWebhookVerify.js';

const originalNodeEnv = process.env.NODE_ENV;
const originalSandbox = process.env.EPAYGAMES_SANDBOX;
const originalSignatureKey = process.env.EPAYGAMES_SIGNATURE_KEY;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  process.env.EPAYGAMES_SANDBOX = originalSandbox;
  process.env.EPAYGAMES_SIGNATURE_KEY = originalSignatureKey;
});

// '@' per ePayGames' own Payments API documentation example
// ("100@EPLKZT2OH319WBEF") — confirmed against two real sandbox webhook
// deliveries 2026-08-28. The original implementation used '|', which is
// not documented anywhere and never validated a single real delivery.
function sign(key, amount, referenceNo) {
  return crypto.createHmac('sha256', key).update(`${amount}@${referenceNo}`).digest('hex');
}

// Only for the regression test proving the old, wrong delimiter is
// rejected — never used to compute an "expected" signature elsewhere.
function signWithPipeDelimiter(key, amount, referenceNo) {
  return crypto.createHmac('sha256', key).update(`${amount}|${referenceNo}`).digest('hex');
}

function run({ ip, body }) {
  const req = { ip, body };
  let statusCode = null;
  let responseBody = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(payload) { responseBody = payload; },
  };
  let nextCalled = false;
  epaygamesWebhookVerify(req, res, () => { nextCalled = true; });
  return { nextCalled, statusCode, responseBody };
}

describe('epaygamesWebhookVerify', () => {
  it('allows a request with a valid signature (outside production, IP is not enforced)', () => {
    process.env.NODE_ENV = 'test';
    process.env.EPAYGAMES_SIGNATURE_KEY = 'test-signature-key';
    const data = { amount: 599, reference_no: 'PS-1#aaa' };
    const signature = sign('test-signature-key', data.amount, data.reference_no);

    const { nextCalled, statusCode } = run({ ip: '1.2.3.4', body: { data: { ...data, signature } } });
    expect(nextCalled).toBe(true);
    expect(statusCode).toBeNull();
  });

  it('rejects an invalid signature with a 403, even with a well-formed payload', () => {
    process.env.NODE_ENV = 'test';
    process.env.EPAYGAMES_SIGNATURE_KEY = 'test-signature-key';
    const data = { amount: 599, reference_no: 'PS-1#aaa', signature: 'not-the-real-signature-at-all-000000' };

    const { nextCalled, statusCode, responseBody } = run({ ip: '1.2.3.4', body: { data } });
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
    expect(responseBody).toEqual({ success: false });
  });

  it('rejects a request with no signature field at all', () => {
    process.env.NODE_ENV = 'test';
    process.env.EPAYGAMES_SIGNATURE_KEY = 'test-signature-key';
    const { nextCalled, statusCode } = run({ ip: '1.2.3.4', body: { data: { amount: 599, reference_no: 'PS-1#aaa' } } });
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
  });

  it('rejects every request if EPAYGAMES_SIGNATURE_KEY is not configured — never fails open', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.EPAYGAMES_SIGNATURE_KEY;
    const data = { amount: 599, reference_no: 'PS-1#aaa' };
    const signature = sign('some-key-that-does-not-match-config', data.amount, data.reference_no);

    const { nextCalled, statusCode } = run({ ip: '1.2.3.4', body: { data: { ...data, signature } } });
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
  });

  it('rejects a malformed payload (missing reference_no) before ever computing a signature', () => {
    process.env.NODE_ENV = 'test';
    process.env.EPAYGAMES_SIGNATURE_KEY = 'test-signature-key';
    const { nextCalled, statusCode } = run({ ip: '1.2.3.4', body: { data: { amount: 599, signature: 'irrelevant' } } });
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
  });

  it('rejects a signature of a different length than expected — never calls timingSafeEqual on mismatched buffers', () => {
    process.env.NODE_ENV = 'test';
    process.env.EPAYGAMES_SIGNATURE_KEY = 'test-signature-key';
    const { nextCalled, statusCode } = run({
      ip: '1.2.3.4',
      body: { data: { amount: 599, reference_no: 'PS-1#aaa', signature: 'short' } },
    });
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
  });

  it('in production, allows a valid signature from one of the documented production IPs', () => {
    process.env.NODE_ENV = 'production';
    process.env.EPAYGAMES_SANDBOX = 'false';
    process.env.EPAYGAMES_SIGNATURE_KEY = 'prod-key';
    const data = { amount: 1000, reference_no: 'PS-2#bbb' };
    const signature = sign('prod-key', data.amount, data.reference_no);

    const { nextCalled } = run({ ip: '18.166.179.109', body: { data: { ...data, signature } } });
    expect(nextCalled).toBe(true);
  });

  // Second production IP corrected 2026-08-28 — was '18.166.202.124'
  // (never confirmed against documentation), actual documented value is
  // '18.166.252.124'.
  it('in production, allows a valid signature from the corrected second production IP (18.166.252.124)', () => {
    process.env.NODE_ENV = 'production';
    process.env.EPAYGAMES_SANDBOX = 'false';
    process.env.EPAYGAMES_SIGNATURE_KEY = 'prod-key';
    const data = { amount: 1000, reference_no: 'PS-2#bbb' };
    const signature = sign('prod-key', data.amount, data.reference_no);

    const { nextCalled } = run({ ip: '18.166.252.124', body: { data: { ...data, signature } } });
    expect(nextCalled).toBe(true);
  });

  // Regression test (2026-08-28): confirms the fix actually changed
  // behavior — a signature computed with the old, wrong '|' delimiter
  // must NOT validate now that the implementation uses '@'.
  it('rejects a signature computed with the old, undocumented "|" delimiter — confirms the "@" fix actually changed behavior', () => {
    process.env.NODE_ENV = 'test';
    process.env.EPAYGAMES_SIGNATURE_KEY = 'test-signature-key';
    const data = { amount: 599, reference_no: 'PS-1__aaa' };
    const signature = signWithPipeDelimiter('test-signature-key', data.amount, data.reference_no);

    const { nextCalled, statusCode } = run({ ip: '1.2.3.4', body: { data: { ...data, signature } } });
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
  });

  it('in production with EPAYGAMES_SANDBOX=true, allows the documented sandbox IP instead', () => {
    process.env.NODE_ENV = 'production';
    process.env.EPAYGAMES_SANDBOX = 'true';
    process.env.EPAYGAMES_SIGNATURE_KEY = 'sandbox-key';
    const data = { amount: 1000, reference_no: 'PS-2#bbb' };
    const signature = sign('sandbox-key', data.amount, data.reference_no);

    const { nextCalled } = run({ ip: '43.198.4.7', body: { data: { ...data, signature } } });
    expect(nextCalled).toBe(true);
  });

  it('in production, rejects a valid signature from an IP not on either list — signature alone is never sufficient', () => {
    process.env.NODE_ENV = 'production';
    process.env.EPAYGAMES_SANDBOX = 'false';
    process.env.EPAYGAMES_SIGNATURE_KEY = 'prod-key';
    const data = { amount: 1000, reference_no: 'PS-2#bbb' };
    const signature = sign('prod-key', data.amount, data.reference_no);

    const { nextCalled, statusCode } = run({ ip: '203.0.113.7', body: { data: { ...data, signature } } });
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
  });

  it('in production, rejects a valid production signature delivered from the sandbox IP — the two lists never cross-validate', () => {
    process.env.NODE_ENV = 'production';
    process.env.EPAYGAMES_SANDBOX = 'false';
    process.env.EPAYGAMES_SIGNATURE_KEY = 'prod-key';
    const data = { amount: 1000, reference_no: 'PS-2#bbb' };
    const signature = sign('prod-key', data.amount, data.reference_no);

    const { nextCalled, statusCode } = run({ ip: '43.198.4.7', body: { data: { ...data, signature } } }); // sandbox IP, wrong environment
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
  });
});
