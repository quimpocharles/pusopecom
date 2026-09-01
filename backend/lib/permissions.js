/**
 * Admin permission vocabulary — StaffProfile (department + permissions)
 * has existed since the Enterprise Fulfillment Blueprint, but nothing ever
 * enforced it; every admin-role account had identical access regardless of
 * department. This file is the enforcement layer.
 *
 * Two axes, same shape the schema already committed to:
 *  - `department` sets a default permission bundle (DEPARTMENT_DEFAULTS).
 *  - `staffProfile.permissions` is additive on top of that default — a
 *    support rep who also needs to approve refunds gets `returns.approve`
 *    added to their row, no new department required.
 *
 * `executive` is a wildcard, not an enumerated bundle — it always passes
 * every check, including permissions added after this file was written,
 * so "executive" never needs updating when the vocabulary grows.
 *
 * Bootstrap rule: an admin-role User with no StaffProfile at all is
 * treated as executive. Today's only admin account predates this system;
 * without this rule, shipping permission enforcement would lock out every
 * existing admin. New admins should get a StaffProfile assigned at
 * creation time — this fallback is a safety net, not the intended steady
 * state for a growing team.
 */

export const PERMISSIONS = Object.freeze({
  PRODUCTS_VIEW: 'products.view',
  PRODUCTS_MANAGE: 'products.manage',
  LEAGUES_MANAGE: 'leagues.manage',
  HOMEPAGE_MANAGE: 'homepage.manage',
  CAMPAIGNS_MANAGE: 'campaigns.manage',
  FITCHECK_CAMPAIGNS_MANAGE: 'fitcheck_campaigns.manage',
  PROMOTIONS_MANAGE: 'promotions.manage',
  PASSES_MANAGE: 'passes.manage',
  PASSES_CHECKIN: 'passes.checkin',

  ORDERS_VIEW: 'orders.view',
  ORDERS_MANAGE: 'orders.manage',
  FULFILLMENT_MANAGE: 'fulfillment.manage',
  // Launch-readiness permission-model fix — deliberately narrower than
  // FULFILLMENT_MANAGE: authorizes reading shipment state and advancing its
  // status only (routes/shipments.js's read routes + PATCH /:id/status).
  // Assign/notes/cancel — and courier/tracking fields bundled into the
  // status PATCH itself — stay FULFILLMENT_MANAGE-only. Exists so
  // order_management can run day-to-day order-status work without becoming
  // a Warehouse/Fulfillment administrator (see DEPARTMENT_DEFAULTS below).
  FULFILLMENT_STATUS_MANAGE: 'fulfillment.status_manage',
  RETURNS_VIEW: 'returns.view',
  RETURNS_APPROVE: 'returns.approve',

  USERS_VIEW: 'users.view',
  USERS_MANAGE: 'users.manage',

  REPORTS_EXECUTIVE_VIEW: 'reports.executive.view',
  REPORTS_SALES_VIEW: 'reports.sales.view',
  REPORTS_PRODUCTS_VIEW: 'reports.products.view',
  REPORTS_CUSTOMERS_VIEW: 'reports.customers.view',
  REPORTS_OPERATIONS_VIEW: 'reports.operations.view',
  REPORTS_FITCHECK_VIEW: 'reports.fitcheck.view',
  REPORTS_ORGANIZATIONS_VIEW: 'reports.organizations.view',
  REPORTS_FINANCE_VIEW: 'reports.finance.view',

  SETTINGS_COMMERCE_MANAGE: 'settings.commerce.manage',
  SETTINGS_NOTIFICATIONS_MANAGE: 'settings.notifications.manage',
  SETTINGS_FITCHECK_MANAGE: 'settings.fitcheck.manage',
  SETTINGS_SECURITY_MANAGE: 'settings.security.manage',
  SETTINGS_INTEGRATIONS_MANAGE: 'settings.integrations.manage',
  SETTINGS_ADVANCED_MANAGE: 'settings.advanced.manage',
});

export const ALL_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS));

// A '<resource>.manage' permission always implies '<resource>.view' for the
// same resource — a department granted products.manage shouldn't also need
// products.view spelled out separately to hit the read endpoints.
function impliedPermissions(permission) {
  if (permission.endsWith('.manage')) {
    const viewEquivalent = `${permission.slice(0, -'.manage'.length)}.view`;
    if (ALL_PERMISSIONS.includes(viewEquivalent)) return [permission, viewEquivalent];
  }
  return [permission];
}

export const DEPARTMENT_DEFAULTS = Object.freeze({
  // Wildcard — handled specially in hasPermission, not an enumerated list.
  executive: ['*'],

  finance: [
    PERMISSIONS.REPORTS_EXECUTIVE_VIEW,
    PERMISSIONS.REPORTS_SALES_VIEW,
    PERMISSIONS.REPORTS_FINANCE_VIEW,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.RETURNS_VIEW,
    PERMISSIONS.RETURNS_APPROVE,
  ],

  operations: [
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_MANAGE,
    PERMISSIONS.FULFILLMENT_MANAGE,
    PERMISSIONS.RETURNS_VIEW,
    PERMISSIONS.RETURNS_APPROVE,
    PERMISSIONS.REPORTS_SALES_VIEW,
    PERMISSIONS.REPORTS_PRODUCTS_VIEW,
    PERMISSIONS.REPORTS_OPERATIONS_VIEW,
    PERMISSIONS.SETTINGS_COMMERCE_MANAGE,
    PERMISSIONS.PASSES_CHECKIN,
  ],

  warehouse: [
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.FULFILLMENT_MANAGE,
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.PASSES_CHECKIN,
  ],

  marketing: [
    PERMISSIONS.HOMEPAGE_MANAGE,
    PERMISSIONS.CAMPAIGNS_MANAGE,
    PERMISSIONS.FITCHECK_CAMPAIGNS_MANAGE,
    PERMISSIONS.PROMOTIONS_MANAGE,
    PERMISSIONS.PASSES_MANAGE,
    PERMISSIONS.REPORTS_FITCHECK_VIEW,
    PERMISSIONS.REPORTS_ORGANIZATIONS_VIEW,
    PERMISSIONS.REPORTS_CUSTOMERS_VIEW,
    PERMISSIONS.SETTINGS_FITCHECK_MANAGE,
  ],

  support: [
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.RETURNS_VIEW,
    PERMISSIONS.RETURNS_APPROVE,
    PERMISSIONS.REPORTS_CUSTOMERS_VIEW,
  ],

  // Launch-readiness permission-model fix — `operations`/`warehouse` are
  // each a fixed bundle of several permissions; additive overrides can only
  // ever add to a department's default, never subtract from it, so neither
  // one can produce a true "checkin only" or "order status only" account.
  // These two departments exist purely to be that minimum: no permission
  // beyond what each role's title implies.
  scanner: [
    PERMISSIONS.PASSES_CHECKIN,
  ],

  order_management: [
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_MANAGE,
    PERMISSIONS.FULFILLMENT_STATUS_MANAGE,
  ],
});

/** The full set of permissions a StaffProfile actually grants: department default (with .manage->.view implied) unioned with its own explicit overrides. */
export function getEffectivePermissions(staffProfile) {
  if (!staffProfile) return null; // caller decides what "no profile" means — see hasPermission's bootstrap rule
  if (staffProfile.department === 'executive') return new Set(['*']);

  const bundle = DEPARTMENT_DEFAULTS[staffProfile.department] ?? [];
  const explicit = staffProfile.permissions ?? [];
  const all = [...bundle, ...explicit].flatMap(impliedPermissions);
  return new Set(all);
}

/**
 * `user` is the sanitized req.user shape, expected to carry `role` and
 * (when present) `staffProfile: { department, permissions }`.
 */
export function hasPermission(user, permission) {
  if (!user || user.role !== 'admin') return false;
  if (!user.staffProfile) return true; // bootstrap rule — see file header

  const effective = getEffectivePermissions(user.staffProfile);
  if (effective.has('*')) return true;
  return effective.has(permission);
}

/** True if the user holds at least one of the given permissions — for endpoints two departments legitimately share. */
export function hasAnyPermission(user, permissions) {
  return permissions.some((p) => hasPermission(user, p));
}
