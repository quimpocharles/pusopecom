import { readFileSync } from 'fs';
import JSZip from 'jszip';

/**
 * Extracts the row -> image-buffer mapping from the "Picture" sheet's
 * embedded drawing. Confirmed by direct inspection: images are anchored in
 * the "Picture" sheet (xl/worksheets/sheet2.xml, via drawing1.xml), whose
 * rows mirror the "UAAP Merch" sheet 1:1 — so an anchor's row number is
 * directly the same `sourceRow` the parser already produces.
 *
 * Deliberately does not trust each anchor's <xdr:cNvPr name="..."> display
 * name to identify its target file — spot-checking the raw XML found cases
 * where that name (e.g. "image8.jpg") did not match what the anchor's own
 * r:embed relationship actually resolved to. The relationship ID is the
 * only reliable link between an anchor and its actual media file.
 */
export async function extractRowImages(xlsxPath) {
  const buffer = readFileSync(xlsxPath);
  const zip = await JSZip.loadAsync(buffer);

  const drawingXml = await zip.file('xl/drawings/drawing1.xml').async('string');
  const relsXml = await zip.file('xl/drawings/_rels/drawing1.xml.rels').async('string');

  // rId -> media/imageN.jpg
  const relMap = {};
  for (const match of relsXml.matchAll(/<Relationship Id="(rId\d+)"[^>]*Target="\.\.\/media\/([^"]+)"/g)) {
    relMap[match[1]] = match[2];
  }

  // Each <xdr:oneCellAnchor> block: extract its <xdr:row> and r:embed.
  const anchors = [];
  for (const block of drawingXml.matchAll(/<xdr:oneCellAnchor>([\s\S]*?)<\/xdr:oneCellAnchor>/g)) {
    const content = block[1];
    const rowMatch = content.match(/<xdr:row>(\d+)<\/xdr:row>/);
    const embedMatch = content.match(/r:embed="(rId\d+)"/);
    if (!rowMatch || !embedMatch) continue;
    const row = parseInt(rowMatch[1], 10);
    const fileName = relMap[embedMatch[1]];
    if (fileName) anchors.push({ row, fileName });
  }

  const rowToBuffer = {};
  const warnings = [];
  for (const { row, fileName } of anchors) {
    if (rowToBuffer[row]) {
      warnings.push(`Row ${row} has more than one anchored image — keeping the first, ignoring "${fileName}"`);
      continue;
    }
    const file = zip.file(`xl/media/${fileName}`);
    if (!file) {
      warnings.push(`Anchor at row ${row} references "${fileName}" but that file isn't in xl/media/`);
      continue;
    }
    rowToBuffer[row] = await file.async('nodebuffer');
  }

  return { rowToBuffer, warnings, anchorCount: anchors.length };
}
