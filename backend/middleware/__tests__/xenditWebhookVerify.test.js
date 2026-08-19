import { describe, it, expect, afterEach } from 'vitest';
import { xenditWebhookVerify } from '../xenditWebhookVerify.js';

const originalToken = process.env.XENDIT_WEBHOOK_TOKEN;

afterEach(() => {
  process.env.XENDIT_WEBHOOK_TOKEN = originalToken;
});

function run(headers) {
  const req = { headers };
  let statusCode = null;
  let body = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(payload) { body = payload; },
  };
  let nextCalled = false;
  xenditWebhookVerify(req, res, () => { nextCalled = true; });
  return { nextCalled, statusCode, body };
}

describe('xenditWebhookVerify', () => {
  it('allows a request whose x-callback-token matches XENDIT_WEBHOOK_TOKEN', () => {
    process.env.XENDIT_WEBHOOK_TOKEN = 'my-secret-token';
    const { nextCalled, statusCode } = run({ 'x-callback-token': 'my-secret-token' });
    expect(nextCalled).toBe(true);
    expect(statusCode).toBeNull();
  });

  it('rejects a request with a mismatched token with a 403', () => {
    process.env.XENDIT_WEBHOOK_TOKEN = 'my-secret-token';
    const { nextCalled, statusCode, body } = run({ 'x-callback-token': 'wrong-token' });
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
    expect(body).toEqual({ success: false });
  });

  it('rejects a request with no token header at all', () => {
    process.env.XENDIT_WEBHOOK_TOKEN = 'my-secret-token';
    const { nextCalled, statusCode } = run({});
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
  });

  it('rejects a token of a different length than expected — never calls timingSafeEqual on mismatched buffers', () => {
    process.env.XENDIT_WEBHOOK_TOKEN = 'a-longer-secret-token';
    const { nextCalled, statusCode } = run({ 'x-callback-token': 'short' });
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
  });

  it('rejects every request if XENDIT_WEBHOOK_TOKEN is not configured — never fails open', () => {
    delete process.env.XENDIT_WEBHOOK_TOKEN;
    const { nextCalled, statusCode } = run({ 'x-callback-token': 'anything' });
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
  });
});
