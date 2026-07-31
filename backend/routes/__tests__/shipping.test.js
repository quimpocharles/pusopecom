import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';
import * as venuePickupConfigRepository from '../../repositories/venuePickupConfigRepository.js';

const { default: shippingRouter } = await import('../shipping.js');

const app = express();
app.use(express.json());
app.use('/api/shipping', shippingRouter);

afterAll(async () => {
  await prisma.$disconnect();
});

function futureSlot(overrides = {}) {
  const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days out
  const pickupDate = future.toISOString().slice(0, 10);
  return {
    venueName: 'Test Venue',
    venueAddress: '123 Test St',
    pickupDate,
    pickupHours: '3:00 PM - 9:00 PM',
    pickupStartTime: '15:00',
    enabled: true,
    ...overrides,
  };
}

describe('POST /shipping/options', () => {
  it('400s on an invalid cartTotal', async () => {
    const res = await request(app).post('/api/shipping/options').send({ cartTotal: -5, country: 'Philippines' });
    expect(res.status).toBe(400);
  });

  it('400s on a missing/invalid country', async () => {
    const res = await request(app).post('/api/shipping/options').send({ cartTotal: 500 });
    expect(res.status).toBe(400);
  });

  it('domestic Philippines order below the free threshold gets the flat rate', async () => {
    const res = await request(app).post('/api/shipping/options').send({ cartTotal: 500, country: 'Philippines', region: '13' });
    expect(res.status).toBe(200);
    const standard = res.body.data.shippingOptions.find((o) => o.method === 'domestic_flat_rate');
    expect(standard.fee).toBe(99);
    expect(standard.isFree).toBe(false);
  });

  it('domestic Philippines order at/above the free threshold is free', async () => {
    const res = await request(app).post('/api/shipping/options').send({ cartTotal: 2500, country: 'Philippines', region: '13' });
    const domestic = res.body.data.shippingOptions.find((o) => o.method === 'domestic_free');
    expect(domestic.isFree).toBe(true);
    expect(domestic.fee).toBe(0);
  });

  it('includes an active venue pickup slot as a shipping option', async () => {
    await venuePickupConfigRepository.upsert({ enabled: true, deadlineHours: 6, slots: [futureSlot()] });

    const res = await request(app).post('/api/shipping/options').send({ cartTotal: 500, country: 'Philippines' });
    const pickup = res.body.data.shippingOptions.find((o) => o.method === 'venue_pickup');
    expect(pickup).toBeDefined();
    expect(pickup.fee).toBe(0);
    expect(pickup.isFree).toBe(true);
    expect(pickup.slotId).toBeTypeOf('string');
    expect(pickup.venueName).toBe('Test Venue');

    await venuePickupConfigRepository.upsert({ enabled: false, deadlineHours: 6, slots: [] });
  }, 15000);

  it('excludes a venue pickup slot whose deadline has already passed', async () => {
    // Starts in real-world 2 hours, but the deadline is 6 hours before
    // start — already past. isSlotActive reads pickupDate/pickupStartTime
    // as PHT (UTC+8) wall-clock values, so shift by +8h before extracting
    // them to land back on the intended real UTC instant.
    const soonUtc = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const soonPht = new Date(soonUtc.getTime() + 8 * 60 * 60 * 1000);
    const pickupDate = soonPht.toISOString().slice(0, 10);
    const pickupStartTime = `${String(soonPht.getUTCHours()).padStart(2, '0')}:${String(soonPht.getUTCMinutes()).padStart(2, '0')}`;
    await venuePickupConfigRepository.upsert({
      enabled: true,
      deadlineHours: 6,
      slots: [futureSlot({ pickupDate, pickupStartTime })],
    });

    const res = await request(app).post('/api/shipping/options').send({ cartTotal: 500, country: 'Philippines' });
    const pickup = res.body.data.shippingOptions.find((o) => o.method === 'venue_pickup');
    expect(pickup).toBeUndefined();

    await venuePickupConfigRepository.upsert({ enabled: false, deadlineHours: 6, slots: [] });
  }, 15000);

  it('international shipping for a mapped country', async () => {
    const res = await request(app).post('/api/shipping/options').send({ cartTotal: 500, country: 'Singapore' });
    const intl = res.body.data.shippingOptions.find((o) => o.method === 'international');
    expect(intl).toBeDefined();
    expect(intl.region).toBe('SEA');
  });

  it('falls back to contact_us for an unmapped country', async () => {
    const res = await request(app).post('/api/shipping/options').send({ cartTotal: 500, country: 'Antarctica' });
    const contactUs = res.body.data.shippingOptions.find((o) => o.method === 'contact_us');
    expect(contactUs).toBeDefined();
  });
});
