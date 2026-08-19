import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import * as organizationRepository from '../repositories/organizationRepository.js';
import * as teamRepository from '../repositories/teamRepository.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// A minimal read-only lookup for admin pickers (e.g. the Pass Event form's
// Organization/Team selector) — not owned by any one department's
// permission, so gated on admin-role only rather than a specific
// PERMISSIONS entry, the same low-sensitivity-read posture
// routes/integrations.js's status endpoint already uses. No write surface
// here; Organization/Team management itself has no admin UI yet.
router.use(authenticate, isAdmin);

router.get('/admin/list', async (req, res) => {
  try {
    const organizations = await organizationRepository.find({ where: { active: true }, orderBy: { name: 'asc' } });
    res.json({ success: true, data: organizations });
  } catch (error) {
    logger.error({ err: error }, 'List organizations error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve organizations' });
  }
});

router.get('/admin/:id/teams', async (req, res) => {
  try {
    const teams = await teamRepository.findByOrganization(req.params.id, { where: { active: true }, orderBy: { name: 'asc' } });
    res.json({ success: true, data: teams });
  } catch (error) {
    logger.error({ err: error }, 'List teams error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve teams' });
  }
});

export default router;
