import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { escapeCsvCell } from './csv.js';

/**
 * Shared CSV/Excel/PDF writers for every admin report's export endpoint —
 * generalizes the hand-rolled CSV escaping already used by
 * routes/orders.js's /admin/export and routes/products.js's /admin/export,
 * so a third near-duplicate implementation doesn't appear here (CLAUDE.md:
 * "no abstraction before the second real use case" — this is the second
 * and third use, generalized rather than copy-pasted a third time).
 *
 * PDF is a clean data-table export (pdfkit), not a chart-embedded render —
 * confirmed decision, Reports Module Redesign Phase 3 plan. No headless
 * browser, no chart rasterization.
 */

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
 *
 * Separated from writing to `res` so email attachments (buildReportAttachments)
 * can reuse the exact same sheet-construction logic via workbook.xlsx.writeBuffer().
 */
export function buildXLSXWorkbook({ summary, sheets }) {
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

  return workbook;
}

export async function sendXLSX(res, filename, { summary, sheets }) {
  const workbook = buildXLSXWorkbook({ summary, sheets });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

// ── PDF ──────────────────────────────────────────────────────────────────
// pdfkit has no built-in table support — pagination (when to addPage() and
// re-draw the header row) and column layout are tracked by hand below.

const PDF_MARGIN = 40;
const PDF_ROW_HEIGHT = 20;

function drawTable(doc, { heading, columns, rows, totals }) {
  const pageWidth = doc.page.width - PDF_MARGIN * 2;
  const colWidth = pageWidth / columns.length;
  const bottom = doc.page.height - PDF_MARGIN;

  function drawRow(cells, { bold = false } = {}) {
    const y = doc.y;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
    columns.forEach((col, i) => {
      const val = cells[col.key];
      doc.text(val === null || val === undefined ? '' : String(val), PDF_MARGIN + i * colWidth, y, {
        width: colWidth - 6,
        height: PDF_ROW_HEIGHT - 4,
        ellipsis: true,
      });
    });
    doc.y = y + PDF_ROW_HEIGHT;
  }

  function drawHeaderRow() {
    const headerCells = {};
    columns.forEach((c) => { headerCells[c.key] = c.header; });
    drawRow(headerCells, { bold: true });
    doc.moveTo(PDF_MARGIN, doc.y).lineTo(PDF_MARGIN + pageWidth, doc.y).strokeColor('#cccccc').stroke();
    doc.y += 4;
  }

  function ensureSpace(needed) {
    if (doc.y + needed > bottom) {
      doc.addPage();
      drawHeaderRow();
    }
  }

  ensureSpace(PDF_ROW_HEIGHT * 2);
  if (heading) {
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000').text(heading, PDF_MARGIN, doc.y);
    doc.moveDown(0.5);
  }

  drawHeaderRow();

  for (const row of rows) {
    ensureSpace(PDF_ROW_HEIGHT);
    drawRow(row);
  }

  if (totals) {
    const totalsRow = {};
    for (const col of columns) {
      if (col.key in totals) {
        totalsRow[col.key] = rows.reduce((s, r) => s + (Number(r[col.key]) || 0), 0);
      }
    }
    const [firstKey] = columns.map((c) => c.key);
    if (!(firstKey in totalsRow)) totalsRow[firstKey] = 'Total';
    ensureSpace(PDF_ROW_HEIGHT);
    drawRow(totalsRow, { bold: true });
  }

  doc.y += PDF_ROW_HEIGHT / 2;
}

function humanizeFilename(baseFilename) {
  const stripped = baseFilename.replace(/-report(-.*)?$/, '');
  const words = stripped.split('-').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return `${words.join(' ')} Report`;
}

/** Builds the PDF into an in-memory Buffer (bufferPages so page count/index math never drifts mid-stream). */
export function buildPDFBuffer({ title, summary, sheets }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: PDF_MARGIN, size: 'A4', bufferPages: true });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#000000').text(title);
    doc.font('Helvetica').fontSize(9).fillColor('#666666')
      .text(`Generated ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} PHT`);
    doc.fillColor('#000000');
    doc.moveDown(1);

    if (summary?.length) {
      drawTable(doc, {
        heading: 'Summary',
        columns: [{ header: 'Metric', key: 'metric' }, { header: 'Value', key: 'value' }],
        rows: summary.map(([metric, value]) => ({ metric, value })),
      });
    }

    for (const sheet of sheets) {
      drawTable(doc, { heading: sheet.name, columns: sheet.columns, rows: sheet.rows, totals: sheet.totals });
    }

    doc.end();
  });
}

export async function sendPDF(res, filename, { summary, sheets, title }) {
  const buffer = await buildPDFBuffer({ title: title || humanizeFilename(filename.replace(/\.pdf$/, '')), summary, sheets });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

/** Shared entry point every report export route calls — picks the writer by `?format=`. */
export async function sendReportExport(res, { format, baseFilename, summary, sheets }) {
  if (format === 'xlsx') {
    await sendXLSX(res, `${baseFilename}.xlsx`, { summary, sheets });
    return;
  }
  if (format === 'pdf') {
    await sendPDF(res, `${baseFilename}.pdf`, { summary, sheets, title: humanizeFilename(baseFilename) });
    return;
  }
  // CSV has no real multi-sheet concept — export the primary (first) sheet only.
  const [primary] = sheets;
  sendCSV(res, `${baseFilename}.csv`, primary.columns, primary.rows);
}

/**
 * For the scheduled 5 AM emails (dailyBusinessReportService's 6-way split)
 * — the same {summary, sheets} shape every interactive export already
 * produces, turned into email-ready attachment buffers instead of an HTTP
 * response.
 */
export async function buildReportAttachments({ summary, sheets, baseFilename, title }) {
  const resolvedTitle = title || humanizeFilename(baseFilename);
  const workbook = buildXLSXWorkbook({ summary, sheets });
  const [workbookBuffer, pdfBuffer] = await Promise.all([
    workbook.xlsx.writeBuffer(),
    buildPDFBuffer({ title: resolvedTitle, summary, sheets }),
  ]);
  const [primary] = sheets;
  const csvBuffer = Buffer.from(toCSV(primary.columns, primary.rows), 'utf-8');

  return [
    {
      filename: `${baseFilename}.xlsx`,
      content: Buffer.from(workbookBuffer),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    { filename: `${baseFilename}.csv`, content: csvBuffer, contentType: 'text/csv' },
    { filename: `${baseFilename}.pdf`, content: pdfBuffer, contentType: 'application/pdf' },
  ];
}
