/**
 * TokenTrim E2E fixture generator.
 * Builds minimal, valid single/multi-page PDFs (correct xref) + a DOCX.
 * Run: npm run e2e:fixtures
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const dir = dirname(fileURLToPath(import.meta.url));
mkdirSync(dir, { recursive: true });

function escapePdfText(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/**
 * pages: Array< Array<string | string[]> >.
 * string = plain line; string[] = table row, cells placed at x=72/200/320
 * so the extractor sees wide column gaps (2-space runs in output).
 */
const CELL_X = [72, 200, 320];
function rowOps(cells, y) {
  let s = `1 0 0 1 ${CELL_X[0]} ${y} Tm (${escapePdfText(cells[0])}) Tj`;
  for (let i = 1; i < cells.length; i++) {
    s += `\n${CELL_X[i] - CELL_X[i - 1]} 0 Td (${escapePdfText(cells[i])}) Tj`;
  }
  return s;
}
/** pages: string[][] (lines per page). blankPage: no text ops. */
function buildPdf(pages, { blank = false } = {}) {
  const objects = [];
  const nPages = pages.length;
  // 1: catalog, 2: pages, 3..3+nPages-1: page, then contents, then font
  const pageObjNums = [];
  for (let i = 0; i < nPages; i++) pageObjNums.push(3 + i);
  const contentObjNums = pageObjNums.map((_, i) => 3 + nPages + i);
  const fontObjNum = 3 + nPages * 2;

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageObjNums.map(n => `${n} 0 R`).join(' ')}] /Count ${nPages} >>`;
  pageObjNums.forEach((num, i) => {
    objects[num] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjNums[i]} 0 R /Resources << /Font << /F1 ${fontObjNum} 0 R >> >> >>`;
  });
  contentObjNums.forEach((num, i) => {
    let stream;
    if (blank) {
      stream = '';
    } else {
      let y = 750;
      const parts = ['BT /F1 12 Tf 14 TL'];
      for (const row of pages[i]) {
        if (Array.isArray(row)) parts.push(rowOps(row, y));
        else parts.push(`1 0 0 1 72 ${y} Tm (${escapePdfText(row)}) Tj`);
        y -= 14;
      }
      parts.push('ET');
      stream = parts.join('\n');
    }
    objects[num] = `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`;
  });
  objects[fontObjNum] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  let out = '%PDF-1.4\n';
  const offsets = {};
  for (let n = 1; n <= fontObjNum; n++) {
    offsets[n] = Buffer.byteLength(out, 'latin1');
    out += `${n} 0 obj\n${objects[n]}\nendobj\n`;
  }
  const xrefPos = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${fontObjNum + 1}\n`;
  out += '0000000000 65535 f \n';
  for (let n = 1; n <= fontObjNum; n++) {
    out += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${fontObjNum + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(out, 'latin1');
}

const fixtures = {
  'simple.pdf': buildPdf([['Hello TokenTrim', 'This is a test document.', 'It has three short lines.']]),
  'table.pdf': buildPdf([['Quarterly Results', ['Name', 'Value', 'Cost'], ['Alpha', '10', '6'], ['Beta', '12', '7'], 'End of table.']]),
  'headers.pdf': buildPdf([
    ['Acme Report', 'Body of page one with unique alpha content.', 'Page 1'],
    ['Acme Report', 'Body of page two with unique beta content.', 'Page 2'],
    ['Acme Report', 'Body of page three with unique gamma content.', 'Page 3']
  ]),
  'large.pdf': buildPdf(
    Array.from({ length: 20 }, (_, i) => [
      `Large Document - Page ${i + 1}`,
      'Introduction paragraph shared across the volume.',
      `This is filler content for section ${i + 1} with reference number ${1000 + i}.`,
      'Middle paragraph explaining quarterly figures and outlook.',
      `Closing remarks for section ${i + 1}.`,
      `Page ${i + 1}`
    ])
  ),
  'research.pdf': buildPdf([[
    'Abstract', 'Revenue grew 12 percent to 4.2 million dollars.',
    'Method', 'We surveyed 500 users across three regions.',
    'Results', 'Margin expanded to 31 percent in Q3.',
    'Conclusion', 'Growth is expected to continue into Q4.',
    'References', 'Smith 2023.'
  ]]),
  'contract.pdf': buildPdf([[
    'Service Agreement', 'Payment: Net 30 days from invoice date.',
    'Termination: Either party may terminate with 30 days notice.',
    'Liability: Total liability is capped at fees paid.',
    'Confidentiality: Both parties agree to keep terms confidential.'
  ]]),
  'xlarge.pdf': buildPdf(
    Array.from({ length: 150 }, (_, i) => [
      `Extended Reference Volume - Page ${i + 1}`,
      'Introduction paragraph shared across the volume.',
      `This is substantive filler content for section ${i + 1} with reference number ${20000 + i}.`,
      'Middle paragraph explaining quarterly figures and analytical outlook in depth.',
      `Closing remarks for section ${i + 1} with forward guidance.`,
      `Page ${i + 1}`
    ])
  ),
  'scanned.pdf': buildPdf([[]], { blank: true })
};

for (const [name, buf] of Object.entries(fixtures)) {
  writeFileSync(join(dir, name), buf);
  console.log(`wrote ${name} (${buf.length} bytes)`);
}

writeFileSync(join(dir, 'corrupt.pdf'), Buffer.from('NOT-A-PDF' + 'x'.repeat(200)));
console.log('wrote corrupt.pdf');
writeFileSync(join(dir, 'empty.pdf'), Buffer.alloc(0));
console.log('wrote empty.pdf');

// ---- DOCX ----
const contentTypes = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
const rels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
const document = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello TokenTrim DOCX</w:t></w:r></w:p><w:p><w:r><w:t>This is a test Word document with a small table.</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Name</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Value</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>Alpha</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>10</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:t>End of document.</w:t></w:r></w:p></w:body></w:document>`;

const zip = new JSZip();
zip.file('[Content_Types].xml', contentTypes);
zip.file('_rels/.rels', rels);
zip.file('word/document.xml', document);
const docxBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
writeFileSync(join(dir, 'simple.docx'), docxBuf);
console.log(`wrote simple.docx (${docxBuf.length} bytes)`);
console.log('done');
