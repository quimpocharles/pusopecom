import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mayaWebhookIpAllowlist } from '../mayaWebhookIpAllowlist.js';

const originalNodeEnv = process.env.NODE_ENV;
const originalMayaSandbox = process.env.MAYA_SANDBOX;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  process.env.MAYA_SANDBOX = originalMayaSandbox;
});

function run(ip) {
  const req = { ip };
  let statusCode = null;
  let body = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(payload) { body = payload; },
  };
  let nextCalled = false;
  mayaWebhookIpAllowlist(req, res, () => { nextCalled = true; });
  return { nextCalled, statusCode, body };
}

describe('mayaWebhookIpAllowlist', () => {
  it('skips enforcement entirely outside production — real IPs never reach dev/test', () => {
    process.env.NODE_ENV = 'test';
    const { nextCalled, statusCode } = run('1.2.3.4'); // not a Maya IP
    expect(nextCalled).toBe(true);
    expect(statusCode).toBeNull();
  });

  it('in production, allows Maya\'s documented production IPs', () => {
    process.env.NODE_ENV = 'production';
    process.env.MAYA_SANDBOX = 'false';
    const { nextCalled } = run('18.138.50.235');
    expect(nextCalled).toBe(true);
  });

  it('in production with MAYA_SANDBOX=true, allows Maya\'s sandbox IPs instead', () => {
    process.env.NODE_ENV = 'production';
    process.env.MAYA_SANDBOX = 'true';
    const { nextCalled } = run('13.229.160.234');
    expect(nextCalled).toBe(true);
  });

  it('in production, rejects an IP not on either list with a 403', () => {
    process.env.NODE_ENV = 'production';
    process.env.MAYA_SANDBOX = 'false';
    const { nextCalled, statusCode, body } = run('203.0.113.7');
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
    expect(body).toEqual({ success: false });
  });

  it('in production, rejects a sandbox IP if MAYA_SANDBOX is not enabled — the two lists never cross-validate', () => {
    process.env.NODE_ENV = 'production';
    process.env.MAYA_SANDBOX = 'false';
    const { nextCalled, statusCode } = run('13.229.160.234'); // a real sandbox IP, wrong environment
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
  });
});
