import { describe, it, expect } from 'vitest';
import { escapeCsvCell } from '../csv.js';

// Un-wraps a single RFC 4180 layer (quotes + doubled quotes) so tests can
// assert on the raw inner value regardless of whether quoting kicked in.
function unquote(str) {
  if (str.startsWith('"') && str.endsWith('"') && str.length >= 2) {
    return str.slice(1, -1).replace(/""/g, '"');
  }
  return str;
}

describe('escapeCsvCell — CSV formula-injection (P1)', () => {
  it.each([
    ['equal sign', '=HYPERLINK("http://evil","x")'],
    ['plus sign', '+cmd|/c calc'],
    ['minus sign', '-10+20'],
    ['at sign', '@SUM(A1:A2)'],
    ['tab', '\t=1+1'],
    ['carriage return', '\r=1+1'],
  ])('neutralizes a cell beginning with %s using a leading apostrophe', (_label, input) => {
    const inner = unquote(escapeCsvCell(input));
    expect(inner.startsWith("'")).toBe(true);
    expect(inner.slice(1)).toBe(input);
  });

  it('preserves existing comma/quote/newline escaping', () => {
    expect(escapeCsvCell('Cap, Blue "XL"')).toBe('"Cap, Blue ""XL"""');
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('leaves normal values unchanged', () => {
    expect(escapeCsvCell('Jersey')).toBe('Jersey');
    expect(escapeCsvCell('1000')).toBe('1000');
    expect(escapeCsvCell(2500)).toBe('2500');
    expect(escapeCsvCell('2XL')).toBe('2XL');
  });

  it('renders null/undefined as empty', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
  });

  it('does not neutralize a value that is not a formula', () => {
    expect(escapeCsvCell("'=SAFE")).toBe("'=SAFE");
  });
});
