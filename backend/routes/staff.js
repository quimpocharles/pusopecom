import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import * as userRepository from '../repositories/userRepository.js';
import * as staffProfileRepository from '../repositories/staffProfileRepository.js';
import { authenticate, isAdmin, requirePermission, requireFounder } from '../middleware/auth.js';
import { PERMISSIONS, ALL_PERMISSIONS, DEPARTMENT_DEFAULTS } from '../lib/permissions.js';

const router = express.Router();

// Launch-readiness audit fix — settings.security.manage stays the broad
// gate (any admin lacking it gets the normal 403 above), but staff
// permission administration itself is narrowed further by requireFounder
// (middleware/auth.js) to specific founder User IDs, not "any executive."
// `executive` is a wildcard department, so department alone can't express
// "this executive, not that one" — Chris Quimpo (department: executive) is
// meant to keep full access to everything else on the platform, just not
// this one capability.
router.use(authenticate, isAdmin, requirePermission(PERMISSIONS.SETTINGS_SECURITY_MANAGE), requireFounder);

// Derived from DEPARTMENT_DEFAULTS itself, not a separately hardcoded list —
// a new department now only needs adding in one place (lib/permissions.js).
const VALID_DEPARTMENTS = new Set(Object.keys(DEPARTMENT_DEFAULTS));

/**
 * Settings IA redesign — the first real route ever wired to
 * staffProfileRepository.js. The model and repository existed since the
 * Enterprise Fulfillment Blueprint; nothing ever exposed them. Every
 * admin-role User is listed here even if they have no StaffProfile yet —
 * that's the "unassigned" state a Roles page needs to show, not an error.
 */
// The vocabulary itself — served from lib/permissions.js so the Security
// settings page never hardcodes its own copy that could drift from what
// requirePermission() actually enforces.
router.get('/permissions', (req, res) => {
  res.json({ success: true, data: { permissions: ALL_PERMISSIONS, departmentDefaults: DEPARTMENT_DEFAULTS } });
});

router.get('/', async (req, res) => {
  try {
    const admins = await userRepository.find({ where: { role: 'admin' }, orderBy: { firstName: 'asc' } });
    const profiles = await staffProfileRepository.findByUserIds(admins.map((u) => u._id));
    const profileByUserId = new Map(profiles.map((p) => [p.userId, p]));

    const staff = admins.map((u) => ({
      userId: u._id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      staffProfile: profileByUserId.get(u._id) || null,
    }));

    res.json({ success: true, data: staff });
  } catch (error) {
    logger.error({ err: error }, 'List staff error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to list staff' });
  }
});

router.patch('/:userId', async (req, res) => {
  try {
    const { department, title, permissions } = req.body;
    // department is required by the schema on the create path (a
    // StaffProfile can't exist without one) — this route always upserts,
    // so it's required here too even when the intent is "just tweak
    // permissions for someone who already has a profile."
    if (!department || !VALID_DEPARTMENTS.has(department)) {
      return res.status(400).json({ success: false, message: `department is required and must be one of: ${[...VALID_DEPARTMENTS].join(', ')}` });
    }
    if (permissions !== undefined) {
      if (!Array.isArray(permissions)) {
        return res.status(400).json({ success: false, message: 'permissions must be an array of strings' });
      }
      const unknown = permissions.filter((p) => !ALL_PERMISSIONS.includes(p));
      if (unknown.length > 0) {
        return res.status(400).json({ success: false, message: `Unknown permission(s): ${unknown.join(', ')}` });
      }
    }

    const targetUser = await userRepository.findById(req.params.userId);
    if (!targetUser || targetUser.role !== 'admin') {
      return res.status(404).json({ success: false, message: 'Admin user not found' });
    }

    const profile = await staffProfileRepository.upsert({
      userId: req.params.userId,
      department,
      title,
      permissions,
      updatedByUserId: req.user._id,
    });

    res.json({ success: true, data: profile });
  } catch (error) {
    logger.error({ err: error }, 'Update staff profile error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update staff profile' });
  }
});

export default router;
