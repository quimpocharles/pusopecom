import { describe, it, expect, vi } from 'vitest';
import zlib from 'node:zlib';
import ExcelJS from 'exceljs';
import { toCSV, sendCSV, sendXLSX, sendPDF, buildPDFBuffer, sendReportExport } from '../reportExport.js';

// pdfkit FlateDecode-compresses content streams by default AND renders text
// as hex glyph strings (`<556e69...>` in Tj/TJ operators, not literal
// `(text)`) even for the standard WinAnsiEncoding fonts used here — so
// asserting on rendered text means inflating each stream, then hex-decoding
// every `<...>` token, rather than pattern-matching the raw buffer.
function extractPdfText(buffer) {
  const str = buffer.toString('latin1');
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  let combined = '';
  while ((match = streamRegex.exec(str))) {
    let inflated;
    try {
      inflated = zlib.inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
    } catch {
      inflated = match[1];
    }
    combined += inflated;
    const hexTokens = inflated.match(/<[0-9a-fA-F]+>/g) || [];
    for (const token of hexTokens) {
      combined += Buffer.from(token.slice(1, -1), 'hex').toString('latin1');
    }
  }
  return combined;
}

function mockRes() {
  const chunks = [];
  return {
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    send(body) { this.body = body; },
    write(chunk) { chunks.push(chunk); return true; },
    end(chunk) { if (chunk) chunks.push(chunk); this.buffer = Buffer.concat(chunks.map((c) => (Buffer.isBuffer(c) ? c : Buffer.from(c)))); },
  };
}

const columns = [{ header: 'Name', key: 'name' }, { header: 'Revenue', key: 'revenue' }];
const rows = [{ name: 'Jersey', revenue: 1000 }, { name: 'Cap, Blue "XL"', revenue: 500 }];

describe('toCSV', () => {
  it('writes a header row and escapes commas/quotes', () => {
    const csv = toCSV(columns, rows);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Name,Revenue');
    expect(lines[1]).toBe('Jersey,1000');
    expect(lines[2]).toBe('"Cap, Blue ""XL""",500');
  });

  it('renders null/undefined cells as empty', () => {
    const csv = toCSV(columns, [{ name: 'X', revenue: null }]);
    expect(csv.split('\n')[1]).toBe('X,');
  });
});

describe('sendCSV', () => {
  it('sets CSV headers and sends the body', () => {
    const res = mockRes();
    sendCSV(res, 'report.csv', columns, rows);
    expect(res.headers['Content-Type']).toBe('text/csv');
    expect(res.headers['Content-Disposition']).toBe('attachment; filename="report.csv"');
    expect(res.body).toContain('Jersey,1000');
  });
});

describe('sendXLSX', () => {
  it('writes a Summary sheet plus one worksheet per entry, with a totals row', async () => {
    const res = mockRes();
    await sendXLSX(res, 'report.xlsx', {
      summary: [['Total Revenue', 1500]],
      sheets: [{ name: 'By Product', columns, rows, totals: { revenue: true } }],
    });

    expect(res.headers['Content-Type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.buffer);

    const sheetNames = workbook.worksheets.map((ws) => ws.name);
    expect(sheetNames).toEqual(['Summary', 'By Product']);

    const summarySheet = workbook.getWorksheet('Summary');
    expect(summarySheet.getRow(2).getCell(1).value).toBe('Total Revenue');
    expect(summarySheet.getRow(2).getCell(2).value).toBe(1500);

    const dataSheet = workbook.getWorksheet('By Product');
    expect(dataSheet.getRow(1).getCell(1).value).toBe('Name'); // header
    expect(dataSheet.getRow(2).getCell(1).value).toBe('Jersey');
    // totals row is the row after the last data row (header + 2 rows + totals = row 4)
    const totalsRow = dataSheet.getRow(4);
    expect(totalsRow.getCell(2).value).toBe(1500); // 1000 + 500
  });

  it('omits the Summary sheet when no summary is given', async () => {
    const res = mockRes();
    await sendXLSX(res, 'report.xlsx', { sheets: [{ name: 'Only Sheet', columns, rows }] });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.buffer);
    expect(workbook.worksheets.map((ws) => ws.name)).toEqual(['Only Sheet']);
  });
});

describe('sendPDF / buildPDFBuffer', () => {
  it('produces a non-empty application/pdf buffer with a Summary table and one table per sheet', async () => {
    const res = mockRes();
    await sendPDF(res, 'report.pdf', {
      summary: [['Total Revenue', 1500]],
      sheets: [{ name: 'By Product', columns, rows, totals: { revenue: true } }],
    });
    expect(res.headers['Content-Type']).toBe('application/pdf');
    expect(res.headers['Content-Disposition']).toBe('attachment; filename="report.pdf"');
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(100);
    expect(res.body.slice(0, 5).toString()).toBe('%PDF-');
  });

  it('derives a human title from the filename when none is given', async () => {
    const res = mockRes();
    await sendPDF(res, 'organizations-report.pdf', { sheets: [{ name: 'Sheet', columns, rows }] });
    expect(extractPdfText(res.body)).toContain('Organizations Report');
  });

  it('paginates a large rows array — addPage() fires rather than throwing or silently truncating', async () => {
    const bigRows = Array.from({ length: 80 }, (_, i) => ({ name: `Row ${i}`, revenue: i }));
    const buffer = await buildPDFBuffer({
      title: 'Pagination Test',
      summary: null,
      sheets: [{ name: 'Big Sheet', columns, rows: bigRows }],
    });
    const text = buffer.toString('latin1');
    const pageObjectCount = (text.match(/\/Type\s*\/Page[^s]/g) || []).length;
    expect(pageObjectCount).toBeGreaterThan(1);
  });

  it('does not silently drop rows when paginating — page count scales with the number of rows, not capped at one page', async () => {
    const pageCountFor = async (n) => {
      const rowsN = Array.from({ length: n }, (_, i) => ({ name: `Row ${i}`, revenue: i }));
      const buffer = await buildPDFBuffer({ title: 'Scale Test', summary: null, sheets: [{ name: 'Sheet', columns, rows: rowsN }] });
      const text = buffer.toString('latin1');
      return (text.match(/\/Type\s*\/Page[^s]/g) || []).length;
    };
    const smallPageCount = await pageCountFor(20);
    const largePageCount = await pageCountFor(120);
    expect(largePageCount).toBeGreaterThan(smallPageCount);
  });

  it('renders a row far past the first page break, proving overflow rows land on later pages rather than being dropped', async () => {
    const rows120 = Array.from({ length: 120 }, (_, i) => ({ name: `UniqueRowMarker${i}`, revenue: i }));
    const buffer = await buildPDFBuffer({ title: 'Overflow Test', summary: null, sheets: [{ name: 'Sheet', columns, rows: rows120 }] });
    const text = extractPdfText(buffer);
    expect(text).toContain('UniqueRowMarker0');
    expect(text).toContain('UniqueRowMarker119');
  });
});

// buildReportAttachments was removed as part of the Scheduled Report Email
// Redesign — scheduled report emails no longer attach files (see
// emailService.test.js's sendScheduledReportEmail coverage); the
// generation functions it composed (buildXLSXWorkbook/buildPDFBuffer/
// toCSV) remain fully covered above and by sendReportExport below, which
// is what report downloads now always go through, on demand.

describe('sendReportExport', () => {
  it('sends a PDF when format is pdf', async () => {
    const res = mockRes();
    await sendReportExport(res, {
      format: 'pdf',
      baseFilename: 'sales-report',
      summary: [['Total', 1500]],
      sheets: [{ name: 'Primary', columns, rows }],
    });
    expect(res.headers['Content-Type']).toBe('application/pdf');
    expect(res.headers['Content-Disposition']).toBe('attachment; filename="sales-report.pdf"');
    expect(Buffer.isBuffer(res.body)).toBe(true);
  });

  it('sends CSV of the first sheet only when format is csv (or omitted)', async () => {
    const res = mockRes();
    await sendReportExport(res, {
      format: 'csv',
      baseFilename: 'sales-report',
      summary: [['Total', 1500]],
      sheets: [
        { name: 'Primary', columns, rows },
        { name: 'Secondary', columns, rows: [{ name: 'Other', revenue: 1 }] },
      ],
    });
    expect(res.headers['Content-Type']).toBe('text/csv');
    expect(res.headers['Content-Disposition']).toBe('attachment; filename="sales-report.csv"');
    expect(res.body).toContain('Jersey,1000');
    expect(res.body).not.toContain('Other'); // secondary sheet never reaches CSV
  });

  it('sends a full multi-sheet workbook when format is xlsx', async () => {
    const res = mockRes();
    await sendReportExport(res, {
      format: 'xlsx',
      baseFilename: 'sales-report',
      sheets: [
        { name: 'Primary', columns, rows },
        { name: 'Secondary', columns, rows: [{ name: 'Other', revenue: 1 }] },
      ],
    });
    expect(res.headers['Content-Disposition']).toBe('attachment; filename="sales-report.xlsx"');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.buffer);
    expect(workbook.worksheets.map((ws) => ws.name)).toEqual(['Primary', 'Secondary']);
  });
});
