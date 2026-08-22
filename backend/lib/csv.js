// Excel-safe CSV cell escaping, shared by the inventory/transaction report
// exports and the report-export lib so every CSV output escapes identically.
// Formula injection risk: a cell beginning with =, +, -, @, tab, or CR is
// interpreted by Excel as a formula/command. Prefixing a single quote marks
// the cell as text, neutralizing the trigger without changing its visible
// content. RFC 4180 double-quote wrapping is preserved for the existing
// comma/quote/newline cases.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function escapeCsvCell(val) {
  if (val === null || val === undefined) return '';
  let str = String(val);
  if (FORMULA_TRIGGER.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default { escapeCsvCell };
