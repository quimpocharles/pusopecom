import { describe, it, expect } from 'vitest';
import { PERMISSIONS, ALL_PERMISSIONS, DEPARTMENT_DEFAULTS, getEffectivePermissions, hasPermission, hasAnyPermission } from '../permissions.js';

describe('hasPermission', () => {
  it('denies a non-admin regardless of anything else', () => {
    expect(hasPermission({ role: 'customer', staffProfile: null }, PERMISSIONS.PRODUCTS_VIEW)).toBe(false);
    expect(hasPermission(null, PERMISSIONS.PRODUCTS_VIEW)).toBe(false);
  });

  it('treats an admin with no StaffProfile as executive — the bootstrap rule', () => {
    expect(hasPermission({ role: 'admin', staffProfile: null }, PERMISSIONS.REPORTS_FINANCE_VIEW)).toBe(true);
    expect(hasPermission({ role: 'admin', staffProfile: undefined }, PERMISSIONS.SETTINGS_SECURITY_MANAGE)).toBe(true);
  });

  it('executive department passes every permission, including ones not in any bundle', () => {
    const exec = { role: 'admin', staffProfile: { department: 'executive', permissions: [] } };
    for (const p of ALL_PERMISSIONS) expect(hasPermission(exec, p)).toBe(true);
  });

  it('a department only grants its own default bundle', () => {
    const warehouse = { role: 'admin', staffProfile: { department: 'warehouse', permissions: [] } };
    expect(hasPermission(warehouse, PERMISSIONS.PRODUCTS_VIEW)).toBe(true);
    expect(hasPermission(warehouse, PERMISSIONS.FULFILLMENT_MANAGE)).toBe(true);
    expect(hasPermission(warehouse, PERMISSIONS.REPORTS_FINANCE_VIEW)).toBe(false);
    expect(hasPermission(warehouse, PERMISSIONS.PRODUCTS_MANAGE)).toBe(false);
  });

  it('a .manage permission implies its own .view, without needing it listed separately', () => {
    const operations = { role: 'admin', staffProfile: { department: 'operations', permissions: [] } };
    // operations' bundle lists ORDERS_MANAGE but not ORDERS_VIEW explicitly in some hypothetical
    // future edit — this asserts the implication holds regardless of whether .view is also listed.
    expect(DEPARTMENT_DEFAULTS.operations).toContain(PERMISSIONS.ORDERS_MANAGE);
    expect(hasPermission(operations, PERMISSIONS.ORDERS_VIEW)).toBe(true);
  });

  it('permissions is additive on top of the department default, not a replacement', () => {
    const warehousePlus = { role: 'admin', staffProfile: { department: 'warehouse', permissions: [PERMISSIONS.RETURNS_APPROVE] } };
    // still has its department default
    expect(hasPermission(warehousePlus, PERMISSIONS.PRODUCTS_VIEW)).toBe(true);
    // plus the explicit addition
    expect(hasPermission(warehousePlus, PERMISSIONS.RETURNS_APPROVE)).toBe(true);
    // still correctly denied everything else
    expect(hasPermission(warehousePlus, PERMISSIONS.REPORTS_FINANCE_VIEW)).toBe(false);
  });

  it('an unrecognized department falls back to an empty bundle rather than throwing', () => {
    const bogus = { role: 'admin', staffProfile: { department: 'not-a-real-department', permissions: [] } };
    expect(hasPermission(bogus, PERMISSIONS.PRODUCTS_VIEW)).toBe(false);
  });
});

describe('hasAnyPermission', () => {
  it('passes if the user holds at least one of the listed permissions', () => {
    const finance = { role: 'admin', staffProfile: { department: 'finance', permissions: [] } };
    expect(hasAnyPermission(finance, [PERMISSIONS.SETTINGS_FITCHECK_MANAGE, PERMISSIONS.REPORTS_FINANCE_VIEW])).toBe(true);
    expect(hasAnyPermission(finance, [PERMISSIONS.SETTINGS_FITCHECK_MANAGE, PERMISSIONS.SETTINGS_COMMERCE_MANAGE])).toBe(false);
  });
});

describe('getEffectivePermissions', () => {
  it('returns null for no profile, leaving the bootstrap decision to the caller', () => {
    expect(getEffectivePermissions(null)).toBeNull();
  });

  it('returns the wildcard set for executive without enumerating the vocabulary', () => {
    const effective = getEffectivePermissions({ department: 'executive', permissions: [] });
    expect(effective.has('*')).toBe(true);
    expect(effective.size).toBe(1);
  });

  it('unions department default and explicit permissions, with .manage implying .view', () => {
    const effective = getEffectivePermissions({ department: 'warehouse', permissions: ['returns.approve'] });
    expect(effective.has(PERMISSIONS.PRODUCTS_VIEW)).toBe(true);
    expect(effective.has(PERMISSIONS.FULFILLMENT_MANAGE)).toBe(true);
    expect(effective.has(PERMISSIONS.RETURNS_APPROVE)).toBe(true);
    expect(effective.has(PERMISSIONS.REPORTS_FINANCE_VIEW)).toBe(false);
  });
});

describe('DEPARTMENT_DEFAULTS', () => {
  it('every permission referenced in a department bundle is a real, known permission', () => {
    for (const [department, bundle] of Object.entries(DEPARTMENT_DEFAULTS)) {
      if (department === 'executive') continue; // wildcard, not enumerated
      for (const permission of bundle) {
        expect(ALL_PERMISSIONS, `${department} references unknown permission "${permission}"`).toContain(permission);
      }
    }
  });

  it('every non-executive department is a strict subset of the full vocabulary — none accidentally grants everything', () => {
    for (const [department, bundle] of Object.entries(DEPARTMENT_DEFAULTS)) {
      if (department === 'executive') continue;
      expect(bundle.length).toBeLessThan(ALL_PERMISSIONS.length);
    }
  });
});
