import { describe, it, expect } from 'vitest';
import { bm25Select } from '../lib/relevance-scorer.js';

describe('bm25Select', () => {
  const md = ['# Doc', '', '## Payment terms', 'Net 30. Late fee 1.5% per month.', '', '## Office snacks', 'We like pretzels on Fridays.', '', '## Termination', 'Either party may terminate with 30 days notice.'].join('\n');

  it('keeps relevant sections for query', () => {
    const { sections, text } = bm25Select(md, 'payment terms late fee', { topK: 2 });
    expect(sections.length).toBeGreaterThan(0);
    expect(text).toContain('Net 30');
    expect(text).not.toContain('pretzels');
  });

  it('empty query returns full doc', () => {
    const { text } = bm25Select(md, '', {});
    expect(text).toContain('pretzels');
  });

  it('no-match query keeps full doc with noMatch flag', () => {
    const { sections, text, noMatch } = bm25Select(md, 'quantum zebras xyzzy', { topK: 2 });
    expect(noMatch).toBe(true);
    expect(sections).toHaveLength(0);
    expect(text).toContain('pretzels');
    expect(text).toContain('Net 30');
  });
});
