import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getReadHistory, recordArticleVisit, getMostRecentSlug } from '../helpReadHistory';

const KEY = 'pusoHelpCenterReadHistory';

beforeEach(() => {
  localStorage.clear();
});

describe('getReadHistory / recordArticleVisit', () => {
  it('returns an empty object when nothing has been recorded yet', () => {
    expect(getReadHistory()).toEqual({});
  });

  it('records a visit with an ISO 8601 timestamp', () => {
    recordArticleVisit('viewing-orders');
    const history = getReadHistory();
    expect(Object.keys(history)).toEqual(['viewing-orders']);
    expect(() => new Date(history['viewing-orders']).toISOString()).not.toThrow();
    expect(new Date(history['viewing-orders']).toISOString()).toBe(history['viewing-orders']);
  });

  it('updates the timestamp on a second visit to the same article', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T00:00:00.000Z'));
    recordArticleVisit('viewing-orders');
    const first = getReadHistory()['viewing-orders'];

    vi.setSystemTime(new Date('2026-10-05T00:00:00.000Z'));
    recordArticleVisit('viewing-orders');
    const second = getReadHistory()['viewing-orders'];

    expect(second).not.toBe(first);
    expect(new Date(second).getTime()).toBeGreaterThan(new Date(first).getTime());
    vi.useRealTimers();
  });

  it('persists across separate calls (simulating navigation/remount)', () => {
    recordArticleVisit('order-detail-and-timeline');
    // A fresh call, as a remounted component would make, sees the same data.
    expect(getReadHistory()).toHaveProperty('order-detail-and-timeline');
  });

  it('does nothing for a falsy slug', () => {
    recordArticleVisit(undefined);
    recordArticleVisit('');
    expect(getReadHistory()).toEqual({});
  });

  it('does not throw when localStorage.getItem throws (storage disabled/inaccessible)', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => getReadHistory()).not.toThrow();
    expect(getReadHistory()).toEqual({});
    spy.mockRestore();
  });

  it('does not throw when localStorage.setItem throws (quota exceeded/private mode)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => recordArticleVisit('viewing-orders')).not.toThrow();
    spy.mockRestore();
  });

  it('recovers gracefully from malformed JSON already in storage', () => {
    localStorage.setItem(KEY, '{not valid json');
    expect(getReadHistory()).toEqual({});
  });

  it('recovers gracefully when the stored value is not an object (e.g. an array or a string)', () => {
    localStorage.setItem(KEY, JSON.stringify(['not', 'an', 'object']));
    expect(getReadHistory()).toEqual({});
    localStorage.setItem(KEY, JSON.stringify('just a string'));
    expect(getReadHistory()).toEqual({});
  });
});

describe('getMostRecentSlug', () => {
  it('returns null for an empty history', () => {
    expect(getMostRecentSlug({})).toBeNull();
    expect(getMostRecentSlug(undefined)).toBeNull();
  });

  it('returns the slug with the latest valid timestamp', () => {
    const history = {
      a: '2026-10-01T00:00:00.000Z',
      b: '2026-10-05T00:00:00.000Z',
      c: '2026-10-03T00:00:00.000Z',
    };
    expect(getMostRecentSlug(history)).toBe('b');
  });

  it('ignores invalid timestamps rather than crashing or letting them win', () => {
    const history = {
      a: '2026-10-01T00:00:00.000Z',
      b: 'not-a-date',
    };
    expect(getMostRecentSlug(history)).toBe('a');
  });
});
