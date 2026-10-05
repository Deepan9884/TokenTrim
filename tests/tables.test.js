import { describe, it, expect } from 'vitest';
import { optimizeMarkdownTables, detectTextTables } from '../lib/table-optimizer.js';

describe('detectTextTables', () => {
  it('converts spaced columnar text into a markdown table', () => {
    const out = detectTextTables('Name   Value   Cost\nAlpha   10   6\nBeta   12   7');
    expect(out).toContain('| Name | Value | Cost |');
    expect(out).toContain('| --- |');
  });

  it('leaves existing markdown tables untouched', () => {
    const md = '| A | B |\n| 1 | 2 |';
    expect(detectTextTables(md)).toBe(md);
  });

  it('detects 2-space columnar runs (pdf.js extractor output)', () => {
    const out = detectTextTables('Name  Value  Cost\nAlpha  10  6\nBeta  12  7');
    expect(out).toContain('| Name | Value | Cost |');
  });

  it('rejects prose with inconsistent columns', () => {
    const prose = 'This is a normal sentence here.\nAnother plain sentence follows along.';
    expect(detectTextTables(prose)).toBe(prose);
  });
});

describe('optimizeMarkdownTables', () => {
  it('drops empty columns and repeated headers', () => {
    const md = [
      '| Name | Empty | Value |',
      '| --- | --- | --- |',
      '| A |  | 10 |',
      '| Name | Empty | Value |',
      '| B |  | 20 |'
    ].join('\n');
    const { text, stats } = optimizeMarkdownTables(md, { style: 'markdown' });
    expect(text).not.toContain('|  |');
    expect(stats.tables).toBe(1);
    expect(stats.columnsDropped).toBe(1);
    expect(text).toContain('| A | 10 |');
  });

  it('csv style emits comma rows', () => {
    const md = ['| H1 | H2 |', '| --- | --- |', '| a | b |'].join('\n');
    const { text } = optimizeMarkdownTables(md, { style: 'csv' });
    expect(text).toContain('H1,H2');
    expect(text).toContain('a,b');
  });
});
