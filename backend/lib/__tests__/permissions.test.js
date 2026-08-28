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

// Launch-readiness permission-model fix — `scanner` and `order_management`
// exist specifically because neither `warehouse` nor `operations` can be
// narrowed to just one capability (additive overrides only ever add to a
// department's default, never subtract from it).
describe('scanner department', () => {
  const scanner = { role: 'admin', staffProfile: { department: 'scanner', permissions: [] } };

  it('1. has passes.checkin', () => {
    expect(hasPermission(scanner, PERMISSIONS.PASSES_CHECKIN)).toBe(true);
  });

  it('2. does not have orders.view', () => {
    expect(hasPermission(scanner, PERMISSIONS.ORDERS_VIEW)).toBe(false);
  });

  it('3. does not have fulfillment.manage', () => {
    expect(hasPermission(scanner, PERMISSIONS.FULFILLMENT_MANAGE)).toBe(false);
  });

  it('4. does not have passes.manage', () => {
    expect(hasPermission(scanner, PERMISSIONS.PASSES_MANAGE)).toBe(false);
  });

  it('5. does not have returns.approve', () => {
    expect(hasPermission(scanner, PERMISSIONS.RETURNS_APPROVE)).toBe(false);
  });

  it('6. does not have any settings.* permission', () => {
    for (const p of ALL_PERMISSIONS.filter((p) => p.startsWith('settings.'))) {
      expect(hasPermission(scanner, p)).toBe(false);
    }
  });

  it('holds exactly one effective permission — nothing else, additive or otherwise', () => {
    const effective = getEffectivePermissions(scanner.staffProfile);
    expect([...effective]).toEqual([PERMISSIONS.PASSES_CHECKIN]);
  });
});

describe('order_management department', () => {
  const orderManager = { role: 'admin', staffProfile: { department: 'order_management', permissions: [] } };

  it('7. has orders.view', () => {
    expect(hasPermission(orderManager, PERMISSIONS.ORDERS_VIEW)).toBe(true);
  });

  it('8. has orders.manage', () => {
    expect(hasPermission(orderManager, PERMISSIONS.ORDERS_MANAGE)).toBe(true);
  });

  it('9. does not have fulfillment.manage', () => {
    expect(hasPermission(orderManager, PERMISSIONS.FULFILLMENT_MANAGE)).toBe(false);
  });

  it('10. does not have returns.approve', () => {
    expect(hasPermission(orderManager, PERMISSIONS.RETURNS_APPROVE)).toBe(false);
  });

  it('11. does not have settings.integrations.manage (cannot touch the payment gateway)', () => {
    expect(hasPermission(orderManager, PERMISSIONS.SETTINGS_INTEGRATIONS_MANAGE)).toBe(false);
  });

  it('12. does not have passes.manage', () => {
    expect(hasPermission(orderManager, PERMISSIONS.PASSES_MANAGE)).toBe(false);
  });

  it('holds exactly its two named permissions — nothing else', () => {
    const effective = getEffectivePermissions(orderManager.staffProfile);
    expect([...effective].sort()).toEqual([PERMISSIONS.ORDERS_MANAGE, PERMISSIONS.ORDERS_VIEW].sort());
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

  // 13–15. Regression — adding `scanner`/`order_management` must not have
  // touched a single existing department's bundle. Exact array equality
  // (not just "still contains X") so any accidental edit anywhere in this
  // object fails loudly, not just a missing-permission edit.
  it('13. warehouse is unchanged', () => {
    expect(DEPARTMENT_DEFAULTS.warehouse).toEqual([
      PERMISSIONS.ORDERS_VIEW, PERMISSIONS.FULFILLMENT_MANAGE, PERMISSIONS.PRODUCTS_VIEW, PERMISSIONS.PASSES_CHECKIN,
    ]);
  });

  it('14. operations is unchanged', () => {
    expect(DEPARTMENT_DEFAULTS.operations).toEqual([
      PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_MANAGE, PERMISSIONS.FULFILLMENT_MANAGE,
      PERMISSIONS.RETURNS_VIEW, PERMISSIONS.RETURNS_APPROVE,
      PERMISSIONS.REPORTS_SALES_VIEW, PERMISSIONS.REPORTS_PRODUCTS_VIEW, PERMISSIONS.REPORTS_OPERATIONS_VIEW,
      PERMISSIONS.SETTINGS_COMMERCE_MANAGE, PERMISSIONS.PASSES_CHECKIN,
    ]);
  });

  it('15. marketing, finance, and support are unchanged', () => {
    expect(DEPARTMENT_DEFAULTS.marketing).toEqual([
      PERMISSIONS.HOMEPAGE_MANAGE, PERMISSIONS.CAMPAIGNS_MANAGE, PERMISSIONS.FITCHECK_CAMPAIGNS_MANAGE,
      PERMISSIONS.PROMOTIONS_MANAGE, PERMISSIONS.PASSES_MANAGE,
      PERMISSIONS.REPORTS_FITCHECK_VIEW, PERMISSIONS.REPORTS_ORGANIZATIONS_VIEW, PERMISSIONS.REPORTS_CUSTOMERS_VIEW,
      PERMISSIONS.SETTINGS_FITCHECK_MANAGE,
    ]);
    expect(DEPARTMENT_DEFAULTS.finance).toEqual([
      PERMISSIONS.REPORTS_EXECUTIVE_VIEW, PERMISSIONS.REPORTS_SALES_VIEW, PERMISSIONS.REPORTS_FINANCE_VIEW,
      PERMISSIONS.ORDERS_VIEW, PERMISSIONS.RETURNS_VIEW, PERMISSIONS.RETURNS_APPROVE,
    ]);
    expect(DEPARTMENT_DEFAULTS.support).toEqual([
      PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_MANAGE, PERMISSIONS.ORDERS_VIEW,
      PERMISSIONS.RETURNS_VIEW, PERMISSIONS.RETURNS_APPROVE, PERMISSIONS.REPORTS_CUSTOMERS_VIEW,
    ]);
  });

  it('16. executive is still the wildcard', () => {
    expect(DEPARTMENT_DEFAULTS.executive).toEqual(['*']);
  });

  it('exactly eight departments exist — six original plus the two new ones, no accidental extras', () => {
    expect(Object.keys(DEPARTMENT_DEFAULTS).sort()).toEqual(
      ['executive', 'finance', 'marketing', 'operations', 'order_management', 'scanner', 'support', 'warehouse'].sort()
    );
  });
});

// 17. Bootstrap rule (no StaffProfile at all) — already covered by
// 'treats an admin with no StaffProfile as executive' above; asserted here
// too, explicitly against the launch-readiness spec's own numbering.
describe('bootstrap rule (regression)', () => {
  it('17. an admin with no StaffProfile is still treated as executive after this change', () => {
    expect(hasPermission({ role: 'admin', staffProfile: null }, PERMISSIONS.PASSES_CHECKIN)).toBe(true);
    expect(hasPermission({ role: 'admin', staffProfile: null }, PERMISSIONS.ORDERS_MANAGE)).toBe(true);
  });
});
