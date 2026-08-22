import { describe, it, expect } from 'vitest';
import { canonicalEmail } from '../email.js';

describe('canonicalEmail — identity consistency across local and Google OAuth', () => {
  it.each([
    ['lowercases and trims', '  A.B@gmail.com  ', 'ab@gmail.com'],
    ['removes Gmail dots', 'a.b.c@gmail.com', 'abc@gmail.com'],
    ['strips Gmail plus-tag', 'ab+tag@gmail.com', 'ab@gmail.com'],
    ['removes dots and plus-tag together', 'a.b+tag@gmail.com', 'ab@gmail.com'],
    ['googlemail.com treated as gmail', 'a.b@googlemail.com', 'ab@googlemail.com'],
    ['leaves other domains untouched', 'user@company.com', 'user@company.com'],
    ['leaves dots on non-Gmail domains', 'a.b@company.com', 'a.b@company.com'],
  ])('normalizes %s', (_label, input, expected) => {
    expect(canonicalEmail(input)).toBe(expected);
  });

  it('handles non-string input without throwing', () => {
    expect(canonicalEmail(null)).toBe(null);
    expect(canonicalEmail(undefined)).toBe(undefined);
  });
});
