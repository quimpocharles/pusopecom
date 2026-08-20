import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import * as passEventRepository from '../repositories/passEventRepository.js';
import * as passRepository from '../repositories/passRepository.js';
import { ensureLeagueOrganization } from '../services/organizationMigrationService.js';
import { authenticate, isAdmin, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../lib/permissions.js';

const router = express.Router();

function isOnSale(event, now = new Date()) {
  if (event.salesStartAt && now < new Date(event.salesStartAt)) return false;
  if (event.salesEndAt && now > new Date(event.salesEndAt)) return false;
  return true;
}

// --- Public browse/detail ---

router.get('/', async (req, res) => {
  try {
    const { organizationId, skip, take } = req.query;
    const events = await passEventRepository.findUpcoming({
      organizationId: organizationId || undefined,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
    res.json({ success: true, data: events });
  } catch (error) {
    logger.error({ err: error }, 'Get pass events error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve events' });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const event = await passEventRepository.findBySlug(req.params.slug);
    if (!event || !event.active) return res.status(404).json({ success: false, message: 'Event not found' });
    res.json({ success: true, data: { ...event, onSale: isOnSale(event) } });
  } catch (error) {
    logger.error({ err: error }, 'Get pass event error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve event' });
  }
});

// --- My PUSO Locker — a fan's own Passes ---

router.get('/my/passes', authenticate, async (req, res) => {
  try {
    const passes = await passRepository.findByUserId(req.user._id);
    res.json({ success: true, data: passes });
  } catch (error) {
    logger.error({ err: error }, 'Get my passes error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve your passes' });
  }
});

// --- Admin: PassEvent + PassTier management ---

router.get('/admin/all', authenticate, isAdmin, requirePermission(PERMISSIONS.PASSES_MANAGE), async (req, res) => {
  try {
    const events = await passEventRepository.find({ orderBy: { startsAt: 'desc' } });
    res.json({ success: true, data: events });
  } catch (error) {
    logger.error({ err: error }, 'Get admin pass events error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve events' });
  }
});

// Unlike GET /:slug (public), this ignores `active` — an admin managing an
// event's tiers needs to reach it regardless of whether it's currently
// visible to fans.
router.get('/admin/:id', authenticate, isAdmin, requirePermission(PERMISSIONS.PASSES_MANAGE), async (req, res) => {
  try {
    const event = await passEventRepository.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    res.json({ success: true, data: event });
  } catch (error) {
    logger.error({ err: error }, 'Get admin pass event error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve event' });
  }
});

// Resolves the admin form's `leagueId` (picked straight from the existing
// League model, so admins never re-enter league data as a separate
// Organization) into the real organizationId PassEvent's schema requires —
// PassEvent.organizationId stays the Organization-first anchor, never a
// flat league string, per CLAUDE.md. `organizationId`, if sent directly
// (an Institution/Athlete pick), passes through untouched.
async function resolveOrganizationId(body) {
  const { leagueId, ...rest } = body;
  if (leagueId && !rest.organizationId) {
    rest.organizationId = await ensureLeagueOrganization(leagueId);
  }
  return rest;
}

router.post('/', authenticate, isAdmin, requirePermission(PERMISSIONS.PASSES_MANAGE), async (req, res) => {
  try {
    const data = await resolveOrganizationId(req.body);
    const event = await passEventRepository.create(data);
    res.status(201).json({ success: true, message: 'Event created successfully', data: event });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'An event with this slug already exists.' });
    }
    logger.error({ err: error }, 'Create pass event error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to create event' });
  }
});

router.put('/:id', authenticate, isAdmin, requirePermission(PERMISSIONS.PASSES_MANAGE), async (req, res) => {
  try {
    const data = await resolveOrganizationId(req.body);
    const event = await passEventRepository.updateById(req.params.id, data);
    res.json({ success: true, message: 'Event updated successfully', data: event });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Event not found' });
    logger.error({ err: error }, 'Update pass event error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update event' });
  }
});

router.delete('/:id', authenticate, isAdmin, requirePermission(PERMISSIONS.PASSES_MANAGE), async (req, res) => {
  try {
    await passEventRepository.deleteById(req.params.id);
    res.json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Event not found' });
    logger.error({ err: error }, 'Delete pass event error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to delete event' });
  }
});

router.post('/:id/tiers', authenticate, isAdmin, requirePermission(PERMISSIONS.PASSES_MANAGE), async (req, res) => {
  try {
    const tier = await passEventRepository.createTier({ ...req.body, passEventId: req.params.id });
    res.status(201).json({ success: true, message: 'Tier created successfully', data: tier });
  } catch (error) {
    logger.error({ err: error }, 'Create pass tier error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to create tier' });
  }
});

router.put('/tiers/:tierId', authenticate, isAdmin, requirePermission(PERMISSIONS.PASSES_MANAGE), async (req, res) => {
  try {
    const tier = await passEventRepository.updateTier(req.params.tierId, req.body);
    res.json({ success: true, message: 'Tier updated successfully', data: tier });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Tier not found' });
    logger.error({ err: error }, 'Update pass tier error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update tier' });
  }
});

router.delete('/tiers/:tierId', authenticate, isAdmin, requirePermission(PERMISSIONS.PASSES_MANAGE), async (req, res) => {
  try {
    await passEventRepository.deleteTier(req.params.tierId);
    res.json({ success: true, message: 'Tier deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Tier not found' });
    logger.error({ err: error }, 'Delete pass tier error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to delete tier' });
  }
});

// --- Staff check-in tool ---
// A separate, narrower permission (PASSES_CHECKIN) from PASSES_MANAGE —
// gate staff scanning passes shouldn't need full event-management rights,
// the same VIEW/MANAGE-style split RETURNS_VIEW/RETURNS_APPROVE already uses.

// Event picker for the scanner — deliberately PASSES_CHECKIN, not
// PASSES_MANAGE like /admin/all above, so check-in-only staff aren't
// locked out of picking which event they're working. A narrow field list,
// not passEventRepository's DEFAULT_INCLUDE (venue+organization+tiers.
// venueSection) — a picker needs a name and a venue, nothing else.
router.get('/checkin/upcoming', authenticate, isAdmin, requirePermission(PERMISSIONS.PASSES_CHECKIN), async (req, res) => {
  try {
    const events = await passEventRepository.find({
      where: { active: true, endsAt: { gte: new Date() } },
      orderBy: { startsAt: 'asc' },
      include: { venue: { select: { name: true } } },
    });
    res.json({ success: true, data: events.map((e) => ({ _id: e._id, name: e.name, slug: e.slug, startsAt: e.startsAt, venue: e.venue })) });
  } catch (error) {
    logger.error({ err: error }, 'Get upcoming events for check-in error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve events' });
  }
});

// Bulk, read-only pre-sync payload for the scanner's offline pre-sync —
// a narrow scalar select (passRepository.findByEventId), not the same
// pass/pass-lookup shape the two routes below return, since this needs to
// stay light across up to ~5000 rows. Tier names come back once as a
// small side list rather than repeated per pass.
router.get('/:eventId/passes/sync', authenticate, isAdmin, requirePermission(PERMISSIONS.PASSES_CHECKIN), async (req, res) => {
  try {
    const event = await passEventRepository.findById(req.params.eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const passes = await passRepository.findByEventId(req.params.eventId);
    const tiers = (event.tiers || []).map((t) => ({ _id: t._id, name: t.name }));
    res.json({ success: true, data: { passes, tiers } });
  } catch (error) {
    logger.error({ err: error }, 'Pass sync error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to sync passes' });
  }
});

router.get('/passes/lookup/:qrToken', authenticate, isAdmin, requirePermission(PERMISSIONS.PASSES_CHECKIN), async (req, res) => {
  try {
    const pass = await passRepository.findByQrToken(req.params.qrToken);
    if (!pass) return res.status(404).json({ success: false, message: 'Pass not found' });
    res.json({ success: true, data: pass });
  } catch (error) {
    logger.error({ err: error }, 'Pass lookup error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to look up pass' });
  }
});

router.post('/passes/:passId/checkin', authenticate, isAdmin, requirePermission(PERMISSIONS.PASSES_CHECKIN), async (req, res) => {
  try {
    const result = await passRepository.transition(req.params.passId, 'checked_in', {
      actor: 'admin',
      actorUserId: req.user._id,
      metadata: req.body?.gate ? { gate: req.body.gate } : undefined,
    });
    if (!result.applied) {
      const message = result.reason === 'not_found' ? 'Pass not found' : 'This pass was already checked in.';
      return res.status(400).json({ success: false, message });
    }
    res.json({ success: true, message: 'Checked in', data: result });
  } catch (error) {
    if (error instanceof passRepository.InvalidPassTransitionError) {
      return res.status(400).json({ success: false, message: `This pass is ${error.fromStatus} and cannot be checked in.` });
    }
    logger.error({ err: error }, 'Pass check-in error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to check in pass' });
  }
});

export default router;
