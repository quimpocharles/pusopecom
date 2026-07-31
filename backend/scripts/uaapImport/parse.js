/**
 * Pure parser for the "UAAP Merch" sheet of uaap-merch-monitoring.xlsx.
 * Takes raw rows (as XLSX.utils.sheet_to_json(sheet, { header: 1 }) already
 * produces) and returns normalized product records — no file I/O, no
 * database access, so this is fully unit-testable against a small fixture
 * instead of only against the real 119-row file.
 *
 * Sheet shape, confirmed by inspection: a header row for each category
 * section has `row[1] === 'COLOR'`, and either a size-breakdown
 * (`row[2] === 'XS'`, sizes at columns 2-8) or a flat quantity
 * (`row[2] === 'QTY'`, single value at column 2). Every row after a header,
 * until the next header, is one school's product for that category.
 */

const SIZE_LABELS = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

// Standard UAAP member schools. ADMU and ATENEO both appear in the source
// file for the same school (Ateneo de Manila University) — normalized to
// one canonical name here rather than imported as two different teams.
export const SCHOOL_MAP = {
  ADU: 'Adamson University',
  ADMU: 'Ateneo de Manila University',
  ATENEO: 'Ateneo de Manila University',
  DLSU: 'De La Salle University',
  FEU: 'Far Eastern University',
  NU: 'National University',
  UE: 'University of the East',
  UP: 'University of the Philippines',
  UST: 'University of Santo Tomas',
};

// Maps each category header's literal text to a Product enum category and
// a readable display name used to build the product's `name`. Row 77's
// category name is blank in the source file — inferred as "BALLER VERSION
// 1" from the file's own v.1/v.2 pairing pattern (row 84 is literally
// "BALLER VERSION 2", and rows 78-83 use "v.1" in their item names the
// same way rows 85+ use "v.2"). Flagged here, not silently assumed
// elsewhere, so it's the one place to correct if that inference is wrong.
export const CATEGORY_MAP = {
  CLASSIC: { category: 'tshirt', sport: 'general', display: 'Classic Tee' },
  'TSHIRT EMBLEM': { category: 'tshirt', sport: 'general', display: 'Emblem Tee' },
  'VOLLEYBALL v.1': { category: 'jersey', sport: 'volleyball', display: 'Volleyball Jersey' },
  'VOLLEYBALL BLACK V.2': { category: 'jersey', sport: 'volleyball', display: 'Volleyball Jersey (Black v.2)' },
  'RETRO TSHIRT': { category: 'tshirt', sport: 'general', display: 'Retro Tee' },
  'ATHLETIC VERSION': { category: 'tshirt', sport: 'general', display: 'Athletic Tee' },
  'VARSITY JACKET': { category: 'jacket', sport: 'general', display: 'Varsity Jacket' },
  SWEATSHIRT: { category: 'sweatshirt', sport: 'general', display: 'Sweatshirt' },
  HOODIES: { category: 'hoodie', sport: 'general', display: 'Hoodie' },
  CAPS: { category: 'cap', sport: 'general', display: 'Cap' },
  'STICKER PACK BASKETBALL VERSION 2': { category: 'accessories', sport: 'basketball', display: 'Basketball Sticker Pack (v.2)' },
  'STICKER PACK VOLLEYBALL': { category: 'accessories', sport: 'volleyball', display: 'Volleyball Sticker Pack' },
  'STICKER LONG': { category: 'accessories', sport: 'general', display: 'Long Sticker' },
  'BALLER VERSION 1': { category: 'accessories', sport: 'general', display: 'Baller Bracelet (v.1)' }, // inferred, see comment above
  'BALLER VERSION 2': { category: 'accessories', sport: 'general', display: 'Baller Bracelet (v.2)' },
  LANYARD: { category: 'accessories', sport: 'general', display: 'Lanyard' },
  'SCARVES VERSION 1': { category: 'accessories', sport: 'general', display: 'Scarf (v.1)' },
  'SCARVES VERSION 2': { category: 'accessories', sport: 'general', display: 'Scarf (v.2)' },
  KEYCHAIN: { category: 'accessories', sport: 'general', display: 'Keychain' },
};

export class ParseError extends Error {
  constructor(message, rowIndex) {
    super(`Row ${rowIndex}: ${message}`);
    this.rowIndex = rowIndex;
  }
}

function parseMoney(value) {
  if (!value) return 0;
  return parseFloat(String(value).replace(/,/g, '')) || 0;
}

function resolveSchool(itemName, rowIndex) {
  const firstToken = itemName.trim().split(/\s+/)[0].toUpperCase();
  const school = SCHOOL_MAP[firstToken];
  if (!school) {
    throw new ParseError(`Unrecognized school abbreviation "${firstToken}" in item name "${itemName}"`, rowIndex);
  }
  return school;
}

/**
 * @param {Array<Array<string>>} rows - raw sheet rows, row[0] is the header row
 * @returns {{ products: object[], warnings: string[] }}
 */
export function parseInventory(rows) {
  const products = [];
  const warnings = [];
  let currentCategory = null;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => String(c).trim() === '')) continue;

    // A header row is identified by column 2 being the literal label 'XS'
    // or 'QTY' — never a real value on a data row. This is more robust
    // than checking column 1 for 'COLOR': the very first category header
    // in the real sheet (CLASSIC) has a blank column 1, not 'COLOR' —
    // every category after it does include 'COLOR', but the first one is
    // inconsistent with the rest of the file.
    const isHeaderRow = row[2] === 'XS' || row[2] === 'QTY';
    if (isHeaderRow) {
      let categoryName = String(row[0] || '').trim();
      if (!categoryName && i === 77) categoryName = 'BALLER VERSION 1'; // see CATEGORY_MAP comment
      const mapped = CATEGORY_MAP[categoryName];
      if (!mapped) {
        warnings.push(`Row ${i}: unrecognized category header "${categoryName}" — rows under it will be skipped`);
        currentCategory = null;
        continue;
      }
      currentCategory = { name: categoryName, ...mapped, isFlatQty: row[2] === 'QTY' };
      continue;
    }

    if (!currentCategory) {
      warnings.push(`Row ${i}: data row found before any recognized category header — skipped`);
      continue;
    }

    const itemName = String(row[0] || '').trim();
    if (!itemName) continue;

    const color = String(row[1] || '').trim() || 'Default';
    const school = resolveSchool(itemName, i);

    let sizes;
    if (currentCategory.isFlatQty) {
      const stock = parseInt(row[2], 10) || 0;
      sizes = [{ size: 'One Size', stock }];
    } else {
      sizes = SIZE_LABELS.map((label, idx) => ({
        size: label,
        stock: parseInt(row[2 + idx], 10) || 0,
      })).filter((s) => s.stock > 0);
    }

    const totalStock = sizes.reduce((sum, s) => sum + s.stock, 0);
    if (totalStock === 0) {
      warnings.push(`Row ${i} ("${itemName}"): zero total stock across all sizes — included anyway, worth a manual look`);
    }

    const price = parseMoney(row[10]);

    products.push({
      sourceRow: i,
      name: `${school} ${currentCategory.display}`,
      description: `${currentCategory.display} in ${color}, officially licensed ${school} UAAP merchandise.`,
      price,
      category: currentCategory.category,
      sport: currentCategory.sport,
      gender: 'unisex',
      team: school,
      league: 'UAAP',
      color,
      sizes,
    });
  }

  return { products, warnings };
}
