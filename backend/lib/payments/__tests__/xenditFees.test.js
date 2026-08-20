import { describe, it, expect } from 'vitest';
import { calculateGatewayFee, isValidChannel, getChannel, CHANNELS } from '../xenditFees.js';

describe('xenditFees', () => {
  it('lists a channel for every code getChannel/calculateGatewayFee can resolve', () => {
    expect(CHANNELS.length).toBeGreaterThan(0);
    for (const channel of CHANNELS) {
      expect(isValidChannel(channel.code)).toBe(true);
      expect(getChannel(channel.code)).toEqual(channel);
    }
  });

  it('computes a percent fee (GCash)', () => {
    expect(calculateGatewayFee('GCASH', 1000)).toBe(20); // 2%
  });

  it('computes a percent-plus-flat fee (Card)', () => {
    expect(calculateGatewayFee('CARD', 1000)).toBe(44); // 2.9% + ₱15
  });

  it('computes a percent fee (Apple Pay)', () => {
    expect(calculateGatewayFee('APPLE_PAY', 1000)).toBe(20); // 2%
  });

  it('rounds to the nearest centavo', () => {
    const fee = calculateGatewayFee('QRPH', 333.33);
    expect(fee).toBe(Math.round(333.33 * 0.007 * 100) / 100);
  });

  it('throws on an unrecognized channel — never silently charges ₱0', () => {
    expect(() => calculateGatewayFee('BITCOIN', 1000)).toThrow('Unknown payment channel');
  });

  it('isValidChannel rejects an unrecognized code', () => {
    expect(isValidChannel('BITCOIN')).toBe(false);
    expect(isValidChannel(undefined)).toBe(false);
  });
});
