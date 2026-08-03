import ExcelJS from 'exceljs';

/**
 * Shared CSV/Excel writers for every admin report's export endpoint —
 * generalizes the hand-rolled CSV escaping already used by
 * routes/orders.js's /admin/export and routes/products.js's /admin/export,
 * so a third near-duplicate implementation doesn't appear here (CLAUDE.md:
 * "no abstraction before the second real use case" — this is the second
 * and third use, generalized rather than copy-pasted a third time).
 */

function escapeCsvCell(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** columns: [{ header, key }]; rows: array of plain objects keyed by column key. */
export function toCSV(columns, rows) {
  const headerLine = columns.map((c) => escapeCsvCell(c.header)).join(',');
  const bodyLines = rows.map((row) => columns.map((c) => escapeCsvCell(row[c.key])).join(','));
  return [headerLine, ...bodyLines].join('\n');
}

export function sendCSV(res, filename, columns, rows) {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(toCSV(columns, rows));
}

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A1A' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } };

/**
 * `sheets`: [{ name, columns: [{ header, key, width? }], rows, totals?: { key: 'Total label' } }]
 * `summary`: optional [[label, value], ...] pairs — rendered as a Summary
 * sheet placed first, since a manager opening the file should see the
 * headline numbers before any per-row detail.
 */
export async function sendXLSX(res, filename, { summary, sheets }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PusoStore';
  workbook.created = new Date();

  if (summary?.length) {
    const ws = workbook.addWorksheet('Summary');
    ws.columns = [{ header: 'Metric', key: 'metric', width: 32 }, { header: 'Value', key: 'value', width: 24 }];
    ws.getRow(1).font = HEADER_FONT;
    ws.getRow(1).fill = HEADER_FILL;
    for (const [metric, value] of summary) ws.addRow({ metric, value });
  }

  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name);
    ws.columns = sheet.columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 22 }));
    ws.getRow(1).font = HEADER_FONT;
    ws.getRow(1).fill = HEADER_FILL;
    sheet.rows.forEach((row) => ws.addRow(row));

    if (sheet.totals) {
      const totalsRow = {};
      for (const col of sheet.columns) {
        if (col.key in sheet.totals) {
          totalsRow[col.key] = sheet.rows.reduce((s, r) => s + (Number(r[col.key]) || 0), 0);
        }
      }
      const [firstKey] = sheet.columns.map((c) => c.key);
      if (!(firstKey in totalsRow)) totalsRow[firstKey] = 'Total';
      const row = ws.addRow(totalsRow);
      row.font = { bold: true };
      row.border = { top: { style: 'thin' } };
    }
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

/** Shared entry point every report export route calls — picks the writer by `?format=`. */
export async function sendReportExport(res, { format, baseFilename, summary, sheets }) {
  if (format === 'xlsx') {
    await sendXLSX(res, `${baseFilename}.xlsx`, { summary, sheets });
    return;
  }
  // CSV has no real multi-sheet concept — export the primary (first) sheet only.
  const [primary] = sheets;
  sendCSV(res, `${baseFilename}.csv`, primary.columns, primary.rows);
}
