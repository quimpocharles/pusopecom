import { describe, it, expect } from 'vitest';
import { bookPickup, getTrackingStatus } from '../manualGateway.js';

describe('manualGateway', () => {
  it('echoes back the staff-entered trackingNumber', async () => {
    const result = await bookPickup({}, { trackingNumber: 'ABC123' });
    expect(result).toEqual({ trackingNumber: 'ABC123', labelUrl: null });
  });

  it('requires a trackingNumber', async () => {
    await expect(bookPickup({}, {})).rejects.toThrow(/trackingNumber/);
  });

  it('has no live status to poll', async () => {
    await expect(getTrackingStatus('ABC123')).rejects.toThrow(/no API to poll/);
  });
});
