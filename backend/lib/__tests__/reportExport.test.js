import { describe, it, expect, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { toCSV, sendCSV, sendXLSX, sendReportExport } from '../reportExport.js';

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

describe('sendReportExport', () => {
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
