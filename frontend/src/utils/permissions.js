/**
 * Mirrors backend/lib/permissions.js exactly — kept in sync manually since
 * frontend and backend are separate codebases with no shared package. Used
 * for nav/route visibility only; the backend's requirePermission() is the
 * real enforcement, this just avoids showing an admin a link that would
 * 403 the moment they clicked it. If you change one file, change both.
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

const ALL_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS));

function impliedPermissions(permission) {
  if (permission.endsWith('.manage')) {
    const viewEquivalent = `${permission.slice(0, -'.manage'.length)}.view`;
    if (ALL_PERMISSIONS.includes(viewEquivalent)) return [permission, viewEquivalent];
  }
  return [permission];
}

const DEPARTMENT_DEFAULTS = Object.freeze({
  executive: ['*'],
  finance: [
    PERMISSIONS.REPORTS_EXECUTIVE_VIEW, PERMISSIONS.REPORTS_SALES_VIEW, PERMISSIONS.REPORTS_FINANCE_VIEW,
    PERMISSIONS.ORDERS_VIEW, PERMISSIONS.RETURNS_VIEW, PERMISSIONS.RETURNS_APPROVE,
  ],
  operations: [
    PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_MANAGE, PERMISSIONS.FULFILLMENT_MANAGE,
    PERMISSIONS.RETURNS_VIEW, PERMISSIONS.RETURNS_APPROVE,
    PERMISSIONS.REPORTS_SALES_VIEW, PERMISSIONS.REPORTS_PRODUCTS_VIEW, PERMISSIONS.REPORTS_OPERATIONS_VIEW,
    PERMISSIONS.SETTINGS_COMMERCE_MANAGE, PERMISSIONS.PASSES_CHECKIN,
  ],
  warehouse: [PERMISSIONS.ORDERS_VIEW, PERMISSIONS.FULFILLMENT_MANAGE, PERMISSIONS.PRODUCTS_VIEW, PERMISSIONS.PASSES_CHECKIN],
  marketing: [
    PERMISSIONS.HOMEPAGE_MANAGE, PERMISSIONS.CAMPAIGNS_MANAGE, PERMISSIONS.FITCHECK_CAMPAIGNS_MANAGE,
    PERMISSIONS.PROMOTIONS_MANAGE, PERMISSIONS.PASSES_MANAGE,
    PERMISSIONS.REPORTS_FITCHECK_VIEW, PERMISSIONS.REPORTS_ORGANIZATIONS_VIEW, PERMISSIONS.REPORTS_CUSTOMERS_VIEW,
    PERMISSIONS.SETTINGS_FITCHECK_MANAGE,
  ],
  support: [
    PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_MANAGE, PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.RETURNS_VIEW, PERMISSIONS.RETURNS_APPROVE, PERMISSIONS.REPORTS_CUSTOMERS_VIEW,
  ],
  // Launch-readiness permission-model fix — mirrors backend/lib/permissions.js exactly.
  scanner: [PERMISSIONS.PASSES_CHECKIN],
  order_management: [PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_MANAGE],
});

function getEffectivePermissions(staffProfile) {
  if (staffProfile.department === 'executive') return new Set(['*']);
  const bundle = DEPARTMENT_DEFAULTS[staffProfile.department] ?? [];
  const explicit = staffProfile.permissions ?? [];
  return new Set([...bundle, ...explicit].flatMap(impliedPermissions));
}

/** `user` is authStore's user object — { role, staffProfile } once populated by login/me. */
export function hasPermission(user, permission) {
  if (!user || user.role !== 'admin') return false;
  if (!user.staffProfile) return true; // bootstrap rule — see backend/lib/permissions.js's header comment

  const effective = getEffectivePermissions(user.staffProfile);
  if (effective.has('*')) return true;
  return effective.has(permission);
}

export function hasAnyPermission(user, permissions) {
  return permissions.some((p) => hasPermission(user, p));
}
