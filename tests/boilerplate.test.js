import { describe, it, expect } from 'vitest';
import { stripBoilerplate } from '../lib/boilerplate-remover.js';

describe('stripBoilerplate', () => {
  it('removes repeated running headers', () => {
    const pages = [
      'Acme Report\nContent page one here.\nPage 1',
      'Acme Report\nContent page two here.\nPage 2',
      'Acme Report\nContent page three here.\nPage 3'
    ];
    const text = pages.join('\n');
    const { text: out, removedLines } = stripBoilerplate(text, pages, { aggressiveness: 'standard' });
    expect(out).not.toContain('Acme Report');
    expect(removedLines).toBeGreaterThanOrEqual(3);
    expect(out).toContain('Content page one');
  });

  it('keeps single-occurrence ALL-CAPS headings', () => {
    const pages = ['EDUCATION\nMIT 2020\nEXPERIENCE\nAcme 2021'];
    const { text: out } = stripBoilerplate(pages.join('\n'), ['only one page'], { aggressiveness: 'standard' });
    expect(out).toContain('EDUCATION');
  });

  it('never collapses mid-page body that differs only by numbers', () => {
    const page = (n, num) => [
      `Large Doc - Page ${n}`,
      `Opening notes for part ${n} of the annual review.`,
      `Revenue was ${num} thousand in the east region division.`,
      `Operations update for part ${n} with staffing commentary.`,
      `Closing remarks for part ${n} of the annual review.`,
      `Page ${n}`
    ].join('\n');
    const pages = [page(1, 1001), page(2, 1002)];
    const { text: out } = stripBoilerplate(pages.join('\n'), pages, { aggressiveness: 'standard' });
    // Body lines differing only by numbers survive (no digit normalization)
    expect(out).toContain('1001');
    expect(out).toContain('1002');
    expect(out).toContain('staffing commentary');
    // True edge header/footer with page numbers go
    expect(out).not.toContain('Large Doc - Page');
  });

  it('fuzzy-matches running titles with page numbers', () => {
    const pages = [
      'Quarterly Results - Page 1\nRevenue up.\nConfidential',
      'Quarterly Results - Page 2\nMargin up.\nConfidential',
      'Quarterly Results - Page 3\nForecast up.\nConfidential'
    ];
    const { text: out } = stripBoilerplate(pages.join('\n'), pages, { aggressiveness: 'standard' });
    expect(out).not.toMatch(/Quarterly Results/);
    expect(out).toContain('Revenue up');
  });
});
