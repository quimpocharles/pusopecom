import { describe, it, expect } from 'vitest';
import { parseInventory, ParseError } from '../uaapImport/parse.js';

// Small fixture mirroring the real sheet's exact shape, not the real file —
// keeps this test fast and independent of the actual xlsx.
function fixtureRows() {
  return [
    ['ITEM (S)', 'COLOR', 'SIZE BREAKDOWN', '', '', '', '', '', '', 'QTY', 'UNIT \r\nPRICE', 'TOTAL'],
    ['CLASSIC', '', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '', '', ''],
    ['ADU Classic', 'Blue', '2', '2', '2', '2', '2', '2', '2', '14', '800.00', '11,200'],
    ['ADMU Classic', 'Royal Blue', '2', '2', '', '', '2', '', '2', '8', '800.00', '6,400'],
    ['CAPS', 'COLOR', 'QTY', '', '', '', '', '', '', 'QTY', '', ''],
    ['FEU', 'Green/Yellow', '10', '', '', '', '', '', '', '10', '950.00', '9,500'],
  ];
}

describe('parseInventory', () => {
  it('parses a size-breakdown category into per-size stock, dropping zero-stock sizes', () => {
    const { products } = parseInventory(fixtureRows());
    const classic = products.find((p) => p.sourceRow === 2);
    expect(classic.name).toBe('Adamson University Classic Tee');
    expect(classic.category).toBe('tshirt');
    expect(classic.sizes).toEqual([
      { size: 'XS', stock: 2 }, { size: 'S', stock: 2 }, { size: 'M', stock: 2 },
      { size: 'L', stock: 2 }, { size: 'XL', stock: 2 }, { size: '2XL', stock: 2 }, { size: '3XL', stock: 2 },
    ]);
  });

  it('drops sizes with zero stock rather than including them as empty rows', () => {
    const { products } = parseInventory(fixtureRows());
    const admu = products.find((p) => p.sourceRow === 3);
    // Source row has blanks for M and L — should not appear at all.
    expect(admu.sizes.map((s) => s.size)).toEqual(['XS', 'S', 'XL', '3XL']);
    expect(admu.sizes.every((s) => s.stock > 0)).toBe(true);
  });

  it('normalizes ADMU and ATENEO to the same canonical school name', () => {
    const rows = fixtureRows();
    rows.push(['ATENEO A. Version', 'Royal Blue', '2', '', '', '', '', '', '', '2', '800.00', '1,600']);
    // Needs an ATHLETIC VERSION header to be valid — append minimally.
    rows.splice(6, 0, ['ATHLETIC VERSION', 'COLOR', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '', '', '']);
    const { products } = parseInventory(rows);
    const admuClassic = products.find((p) => p.sourceRow === 3); // "ADMU Classic"
    const ateneoAthletic = products.find((p) => p.name.includes('Athletic'));
    expect(admuClassic.team).toBe('Ateneo de Manila University');
    expect(ateneoAthletic.team).toBe('Ateneo de Manila University');
  });

  it('parses a flat-quantity category (accessories) as a single "One Size" entry', () => {
    const { products } = parseInventory(fixtureRows());
    const caps = products.find((p) => p.category === 'cap');
    expect(caps.sizes).toEqual([{ size: 'One Size', stock: 10 }]);
    expect(caps.price).toBe(950);
  });

  it('parses comma-formatted prices correctly', () => {
    const { products } = parseInventory(fixtureRows());
    expect(products.find((p) => p.sourceRow === 2).price).toBe(800);
  });

  it('throws ParseError with the offending row number for an unrecognized school abbreviation', () => {
    const rows = fixtureRows();
    rows.push(['XYZ Classic', 'Purple', '1', '', '', '', '', '', '', '1', '800.00', '800']);
    expect(() => parseInventory(rows)).toThrow(ParseError);
  });

  it('warns (does not throw) on an unrecognized category header, and skips its rows', () => {
    const rows = [
      ['ITEM (S)', 'COLOR'],
      ['MYSTERY CATEGORY', 'COLOR', 'QTY'],
      ['ADU Mystery', 'Blue', '5', '', '', '', '', '', '', '5', '100.00', '500'],
    ];
    const { products, warnings } = parseInventory(rows);
    expect(products).toHaveLength(0);
    expect(warnings.some((w) => w.includes('unrecognized category header'))).toBe(true);
  });

  it('assigns volleyball sport only to volleyball categories, general to everything else in the fixture', () => {
    const { products } = parseInventory(fixtureRows());
    expect(products.every((p) => p.sport === 'general')).toBe(true);
  });

  it('builds a description referencing the color and school', () => {
    const { products } = parseInventory(fixtureRows());
    const classic = products.find((p) => p.sourceRow === 2);
    expect(classic.description).toContain('Blue');
    expect(classic.description).toContain('Adamson University');
  });
});
