import { describe, it, expect, vi } from 'vitest';
import { requirePermission, requireAnyPermission } from '../auth.js';
import { PERMISSIONS } from '../../lib/permissions.js';

function mockReqRes(user) {
  const req = { user };
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  const next = vi.fn();
  return { req, res, next };
}

describe('requirePermission', () => {
  it('calls next() when the user holds the permission', () => {
    const { req, res, next } = mockReqRes({ role: 'admin', staffProfile: { department: 'warehouse', permissions: [] } });
    requirePermission(PERMISSIONS.PRODUCTS_VIEW)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBeNull();
  });

  it('responds 403 without calling next() when the user lacks the permission', () => {
    const { req, res, next } = mockReqRes({ role: 'admin', staffProfile: { department: 'warehouse', permissions: [] } });
    requirePermission(PERMISSIONS.REPORTS_FINANCE_VIEW)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

describe('requireAnyPermission', () => {
  it('calls next() when the user holds at least one of the listed permissions', () => {
    const { req, res, next } = mockReqRes({ role: 'admin', staffProfile: { department: 'operations', permissions: [] } });
    requireAnyPermission(PERMISSIONS.SETTINGS_FITCHECK_MANAGE, PERMISSIONS.SETTINGS_COMMERCE_MANAGE)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('responds 403 when the user holds none of the listed permissions', () => {
    const { req, res, next } = mockReqRes({ role: 'admin', staffProfile: { department: 'warehouse', permissions: [] } });
    requireAnyPermission(PERMISSIONS.SETTINGS_FITCHECK_MANAGE, PERMISSIONS.SETTINGS_COMMERCE_MANAGE)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});
