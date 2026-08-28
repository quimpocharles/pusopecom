import { describe, it, expect, vi } from 'vitest';
import { requirePermission, requireAnyPermission, isAdmin } from '../auth.js';
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

describe('isAdmin', () => {
  it('rejects a non-admin role', async () => {
    const { req, res, next } = mockReqRes({ role: 'customer' });
    await isAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('11. allows an admin whose StaffProfile is active', async () => {
    const { req, res, next } = mockReqRes({ role: 'admin', staffProfile: { department: 'operations', active: true } });
    await isAdmin(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBeNull();
  });

  it('12. denies an admin whose StaffProfile has been deactivated', async () => {
    const { req, res, next } = mockReqRes({ role: 'admin', staffProfile: { department: 'operations', active: false } });
    await isAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toMatch(/deactivated/i);
  });

  // Bootstrap rule (lib/permissions.js) must survive this fix untouched —
  // an admin with no StaffProfile at all is not "inactive", it's
  // unassigned, and this check must not treat the two the same.
  it('does not reject an admin with no StaffProfile at all (bootstrap rule preserved)', async () => {
    const { req, res, next } = mockReqRes({ role: 'admin', staffProfile: null });
    await isAdmin(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBeNull();
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
