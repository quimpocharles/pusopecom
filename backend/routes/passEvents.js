import express from 'express';
import crypto from 'crypto';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import * as passEventRepository from '../repositories/passEventRepository.js';
import * as passRepository from '../repositories/passRepository.js';
import { authenticate, isAdmin, optionalAuth, requirePermission } from '../middleware/auth.js';
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

// Live seat availability for one RESERVED_SEAT section of an event — the
// seat-map's data source. Deliberately narrow (one section per call) since
// a real venue's full seat count can be large; the frontend fetches
// section-by-section as the fan navigates the map.
router.get('/:id/sections/:sectionId/seats', async (req, res) => {
  try {
    const seats = await passRepository.findEventSeats({ passEventId: req.params.id, venueSectionId: req.params.sectionId });
    // holdToken is a bearer credential — whoever holds it can release or
    // redeem that seat (see passRepository.releaseSeat/redeemSeat). This is
    // a public, unauthenticated listing, so it must never leak another
    // fan's token; the caller's own browser already knows which seats *it*
    // holds from the response POST /seats/:seatId/hold gave it directly.
    const publicSeats = seats.map(({ holdToken, ...seat }) => seat);
    res.json({ success: true, data: publicSeats });
  } catch (error) {
    logger.error({ err: error }, 'Get event seats error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve seats' });
  }
});

// --- Seat hold/release — pre-checkout, no login required (guest browsing) ---

router.post('/:id/seats/:seatId/hold', optionalAuth, async (req, res) => {
  try {
    const event = await passEventRepository.findById(req.params.id);
    if (!event || !event.active) return res.status(404).json({ success: false, message: 'Event not found' });
    if (!isOnSale(event)) return res.status(400).json({ success: false, message: 'This event is not currently on sale.' });

    const holdToken = crypto.randomUUID();
    const eventSeat = await passRepository.holdSeat({ passEventId: req.params.id, seatId: req.params.seatId, holdToken });
    res.json({ success: true, data: { holdToken, seat: eventSeat, heldUntil: eventSeat.heldUntil } });
  } catch (error) {
    if (error instanceof passRepository.SeatUnavailableError) {
      return res.status(409).json({ success: false, message: 'That seat is no longer available.' });
    }
    logger.error({ err: error }, 'Hold seat error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to hold seat' });
  }
});

router.delete('/:id/seats/:seatId/hold', async (req, res) => {
  try {
    const { holdToken } = req.body;
    if (!holdToken) return res.status(400).json({ success: false, message: 'holdToken is required' });
    await passRepository.releaseSeat({ passEventId: req.params.id, seatId: req.params.seatId, holdToken });
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Release seat error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to release seat' });
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

router.post('/', authenticate, isAdmin, requirePermission(PERMISSIONS.PASSES_MANAGE), async (req, res) => {
  try {
    const event = await passEventRepository.create(req.body);
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
    const event = await passEventRepository.updateById(req.params.id, req.body);
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

// A RESERVED_SEAT tier's PassEventSeat rows are initialized the moment the
// tier is created — see passRepository.initializeEventSeats's own comment
// for why this happens up front rather than lazily.
router.post('/:id/tiers', authenticate, isAdmin, requirePermission(PERMISSIONS.PASSES_MANAGE), async (req, res) => {
  try {
    const tier = await passEventRepository.createTier({ ...req.body, passEventId: req.params.id });
    if (tier.venueSection.seatingType === 'RESERVED_SEAT') {
      await passRepository.initializeEventSeats({ passEventId: req.params.id, venueSectionId: tier.venueSectionId });
    }
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
