import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatRelativeTime } from '../relativeTime';

const NOW = new Date('2026-10-14T12:00:00.000Z');

afterEach(() => {
  vi.useRealTimers();
});

describe('formatRelativeTime', () => {
  it('returns null for a missing timestamp', () => {
    expect(formatRelativeTime(null)).toBeNull();
    expect(formatRelativeTime(undefined)).toBeNull();
    expect(formatRelativeTime('')).toBeNull();
  });

  it('returns null for an invalid/malformed timestamp instead of crashing', () => {
    expect(formatRelativeTime('not-a-date')).toBeNull();
    expect(formatRelativeTime('2026-13-99')).toBeNull();
  });

  it('says "just now" for anything under a minute, including a future/clock-skew timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(formatRelativeTime(new Date(NOW.getTime() - 10_000).toISOString())).toBe('just now');
    expect(formatRelativeTime(new Date(NOW.getTime() + 5_000).toISOString())).toBe('just now');
  });

  it('uses correct minute singular/plural', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(formatRelativeTime(new Date(NOW.getTime() - 60_000).toISOString())).toBe('1 minute ago');
    expect(formatRelativeTime(new Date(NOW.getTime() - 12 * 60_000).toISOString())).toBe('12 minutes ago');
  });

  it('uses correct hour singular/plural', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(formatRelativeTime(new Date(NOW.getTime() - 60 * 60_000).toISOString())).toBe('1 hour ago');
    expect(formatRelativeTime(new Date(NOW.getTime() - 5 * 60 * 60_000).toISOString())).toBe('5 hours ago');
  });

  it('says "yesterday" for exactly one day, and "N days ago" beyond that', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(formatRelativeTime(new Date(NOW.getTime() - 25 * 60 * 60_000).toISOString())).toBe('yesterday');
    expect(formatRelativeTime(new Date(NOW.getTime() - 5 * 24 * 60 * 60_000).toISOString())).toBe('5 days ago');
  });
});
