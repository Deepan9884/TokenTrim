import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parsePageRange, clampPages, formatPages } from '../lib/page-range.js';
import { DocumentConverter } from '../lib/converter.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('parsePageRange', () => {
  it('blank and "all" mean no filter', () => {
    expect(parsePageRange('')).toEqual({ pages: null });
    expect(parsePageRange('  ')).toEqual({ pages: null });
    expect(parsePageRange('all')).toEqual({ pages: null });
  });

  it('parses singles, ranges, and mixes', () => {
    expect(parsePageRange('5')).toEqual({ pages: [5] });
    expect(parsePageRange('1-3')).toEqual({ pages: [1, 2, 3] });
    expect(parsePageRange('1-20, 29-31')).toEqual({
      pages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 29, 30, 31]
    });
    expect(parsePageRange('1-5, 8, 11-13')).toEqual({
      pages: [1, 2, 3, 4, 5, 8, 11, 12, 13]
    });
  });

  it('dedupes, sorts, and tolerates dashes/spaces', () => {
    expect(parsePageRange('5, 3, 5, 1–2')).toEqual({ pages: [1, 2, 3, 5] });
  });

  it('rejects garbage, zero, and reversed ranges', () => {
    expect(parsePageRange('abc').error).toMatch(/invalid/i);
    expect(parsePageRange('0-3').error).toMatch(/start at 1/i);
    expect(parsePageRange('20-1').error).toMatch(/reversed/i);
    expect(parsePageRange('1-3, xyz').error).toMatch(/invalid/i);
  });
});

describe('clampPages + formatPages', () => {
  it('clamps to the document and errors when nothing remains', () => {
    expect(clampPages([1, 2, 99], 3)).toEqual({ pages: [1, 2] });
    expect(clampPages([99, 100], 3).error).toMatch(/3 pages/);
  });

  it('formats compact labels', () => {
    expect(formatPages([1, 2, 3, 5, 7, 8, 9])).toBe('1-3, 5, 7-9');
    expect(formatPages([2])).toBe('2');
  });
});

describe('converter multi-range extraction (real PDF)', () => {
  const buf = readFileSync(join(root, 'tests', 'e2e', 'fixtures', 'large.pdf'));
  const file = new File([buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)], 'large.pdf', { type: 'application/pdf' });

  it('extracts only the requested pages across multiple ranges', async () => {
    const c = new DocumentConverter();
    const res = await c.convert(file, {
      preset: 'claude', compressionMode: 'lossless', tokenBudget: 0,
      pageRange: { pages: [1, 2, 20] }
    }, () => {});
    expect(res.metadata.pages).toBe(3);
    expect(res.markdown).toContain('1000');
    expect(res.markdown).toContain('1019');
    expect(res.markdown).not.toContain('1010');
    expect(res.report.rangeLabel).toBe('1-2, 20');
  }, 60000);

  it('legacy {from,to} still works', async () => {
    const c = new DocumentConverter();
    const res = await c.convert(file, {
      preset: 'claude', compressionMode: 'lossless', tokenBudget: 0,
      pageRange: { from: 2, to: 2 }
    }, () => {});
    expect(res.metadata.pages).toBe(1);
    expect(res.markdown).toContain('1001');
    expect(res.markdown).not.toContain('1000');
  }, 60000);

  it('out-of-range selection throws PAGE_RANGE_INVALID', async () => {
    const c = new DocumentConverter();
    await expect(c.convert(file, {
      preset: 'claude', compressionMode: 'lossless', tokenBudget: 0,
      pageRange: { pages: [99, 100] }
    }, () => {})).rejects.toThrow('PAGE_RANGE_INVALID');
  }, 60000);
});
