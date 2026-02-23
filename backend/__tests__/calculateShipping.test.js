import { describe, it, expect } from 'vitest';
import { calculateShipping } from '../lib/shipping/calculateShipping.js';

// PSGC region codes from select-philippines-address
const NCR      = '13'; // National Capital Region
const VISAYAS  = '07'; // Central Visayas (representative Visayas code)
const MINDANAO = '11'; // Davao Region (representative Mindanao code)
const UNKNOWN  = 'XX'; // Not a real region code

describe('calculateShipping — domestic Philippines', () => {
  it('Visayas region, ₱1,500 → domestic_flat_rate ₱180', () => {
    const result = calculateShipping({ cartTotal: 1500, country: 'Philippines', region: VISAYAS });
    expect(result.method).toBe('domestic_flat_rate');
    expect(result.fee).toBe(180);
  });

  it('NCR region, ₱1,500 → domestic_flat_rate ₱99', () => {
    const result = calculateShipping({ cartTotal: 1500, country: 'Philippines', region: NCR });
    expect(result.method).toBe('domestic_flat_rate');
    expect(result.fee).toBe(99);
  });

  it('any region, cartTotal exactly ₱2,000 → domestic_free ₱0', () => {
    const result = calculateShipping({ cartTotal: 2000, country: 'Philippines', region: NCR });
    expect(result.method).toBe('domestic_free');
    expect(result.fee).toBe(0);
  });

  it('any region, cartTotal ₱2,500 → domestic_free ₱0', () => {
    const result = calculateShipping({ cartTotal: 2500, country: 'Philippines', region: MINDANAO });
    expect(result.method).toBe('domestic_free');
    expect(result.fee).toBe(0);
  });

  it('unrecognized region_code → fallback ₱200', () => {
    const result = calculateShipping({ cartTotal: 1500, country: 'Philippines', region: UNKNOWN });
    expect(result.method).toBe('domestic_flat_rate');
    expect(result.fee).toBe(200);
  });
});

describe('calculateShipping — international', () => {
  it('Singapore → international ₱2,100', () => {
    const result = calculateShipping({ cartTotal: 500, country: 'Singapore' });
    expect(result.method).toBe('international');
    expect(result.fee).toBe(2100);
  });

  it('United States → international ₱2,100', () => {
    const result = calculateShipping({ cartTotal: 500, country: 'United States' });
    expect(result.method).toBe('international');
    expect(result.fee).toBe(2100);
  });

  it('Japan → international ₱2,100', () => {
    const result = calculateShipping({ cartTotal: 500, country: 'Japan' });
    expect(result.method).toBe('international');
    expect(result.fee).toBe(2100);
  });

  it('Zimbabwe (in dropdown, not in region map) → contact_us, fee null', () => {
    const result = calculateShipping({ cartTotal: 500, country: 'Zimbabwe' });
    expect(result.method).toBe('contact_us');
    expect(result.fee).toBeNull();
    expect(result.region).toBeNull();
  });
});

describe('calculateShipping — venue pickup', () => {
  it('Philippines + isPickup=true → venue_pickup ₱0', () => {
    const result = calculateShipping({ cartTotal: 1500, country: 'Philippines', region: NCR, isPickup: true });
    expect(result.method).toBe('venue_pickup');
    expect(result.fee).toBe(0);
  });

  it('United States + isPickup=true → international (not venue_pickup)', () => {
    const result = calculateShipping({ cartTotal: 1500, country: 'United States', isPickup: true });
    expect(result.method).toBe('international');
    expect(result.fee).toBe(2100);
  });
});
