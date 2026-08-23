import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isStaleChunkError,
  attemptStaleChunkRecovery,
  hasAlreadyAttemptedRecovery,
  clearRecoveryGuard,
  markPaymentInFlight,
  clearPaymentInFlight,
  isPaymentInFlight,
} from '../staleChunkRecovery';

beforeEach(() => {
  sessionStorage.clear();
  clearPaymentInFlight();
});

describe('isStaleChunkError', () => {
  it('recognizes the exact browser wordings observed in production', () => {
    expect(isStaleChunkError('Failed to fetch dynamically imported module: https://pusostore.com/assets/Checkout-abc123.js')).toBe(true);
    expect(isStaleChunkError('Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html".')).toBe(true);
    expect(isStaleChunkError('error loading dynamically imported module')).toBe(true); // Firefox
    expect(isStaleChunkError('Importing a module script failed')).toBe(true); // Safari
    expect(isStaleChunkError(new Error('Failed to fetch dynamically imported module'))).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isStaleChunkError('FAILED TO FETCH DYNAMICALLY IMPORTED MODULE')).toBe(true);
  });

  it('3. does not flag an ordinary application error', () => {
    expect(isStaleChunkError("Cannot read properties of undefined (reading 'map')")).toBe(false);
    expect(isStaleChunkError(new TypeError('order is not defined'))).toBe(false);
    expect(isStaleChunkError('Maximum update depth exceeded')).toBe(false);
  });

  it('4. does not flag an ordinary network/API error', () => {
    expect(isStaleChunkError('Network Error')).toBe(false);
    expect(isStaleChunkError('Request failed with status code 500')).toBe(false);
    expect(isStaleChunkError('timeout of 10000ms exceeded')).toBe(false);
  });

  it('handles non-string, non-Error inputs without throwing', () => {
    expect(isStaleChunkError(undefined)).toBe(false);
    expect(isStaleChunkError(null)).toBe(false);
    expect(isStaleChunkError({})).toBe(false);
  });
});

describe('attemptStaleChunkRecovery', () => {
  it('1. triggers exactly one reload for a stale-chunk error', () => {
    const reload = vi.fn();
    const result = attemptStaleChunkRecovery('Failed to fetch dynamically imported module', { reload });

    expect(result).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('2. does not reload again for the same failure/reload cycle — no infinite loop', () => {
    const reload = vi.fn();
    attemptStaleChunkRecovery('Failed to fetch dynamically imported module', { reload });
    const second = attemptStaleChunkRecovery('Failed to fetch dynamically imported module', { reload });
    const third = attemptStaleChunkRecovery('Failed to load module script', { reload });

    expect(second).toBe(false);
    expect(third).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('3. declines for an ordinary application error', () => {
    const reload = vi.fn();
    const result = attemptStaleChunkRecovery(new TypeError('order is undefined'), { reload });

    expect(result).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('4. declines for an ordinary network/API error', () => {
    const reload = vi.fn();
    const result = attemptStaleChunkRecovery('Network Error', { reload });

    expect(result).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('declines while a payment submission is in flight, even for a genuine stale-chunk error', () => {
    const reload = vi.fn();
    markPaymentInFlight();

    const result = attemptStaleChunkRecovery('Failed to fetch dynamically imported module', { reload });

    expect(result).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(hasAlreadyAttemptedRecovery()).toBe(false); // never consumed the one-shot guard either
  });

  it('markPaymentInFlight/clearPaymentInFlight/isPaymentInFlight toggle correctly', () => {
    expect(isPaymentInFlight()).toBe(false);
    markPaymentInFlight();
    expect(isPaymentInFlight()).toBe(true);
    clearPaymentInFlight();
    expect(isPaymentInFlight()).toBe(false);
  });

  it('5. clearRecoveryGuard resets the guard so a later, separate deployment can recover again', () => {
    const reload = vi.fn();
    attemptStaleChunkRecovery('Failed to fetch dynamically imported module', { reload });
    expect(hasAlreadyAttemptedRecovery()).toBe(true);

    clearRecoveryGuard();
    expect(hasAlreadyAttemptedRecovery()).toBe(false);

    const result = attemptStaleChunkRecovery('Failed to fetch dynamically imported module', { reload });
    expect(result).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('defaults to a real window.location.reload when no reload override is supplied', () => {
    // jsdom's window.location.reload isn't configurable, so it can't be
    // vi.spyOn'd directly — same workaround Checkout.test.jsx already uses
    // for stubbing navigation: replace the whole location object.
    const originalLocation = window.location;
    delete window.location;
    window.location = { reload: vi.fn() };

    try {
      const result = attemptStaleChunkRecovery('Failed to fetch dynamically imported module');
      expect(result).toBe(true);
      expect(window.location.reload).toHaveBeenCalledTimes(1);
    } finally {
      window.location = originalLocation;
    }
  });
});
