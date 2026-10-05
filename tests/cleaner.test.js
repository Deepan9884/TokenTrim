import { describe, it, expect } from 'vitest';
import { cleanMarkdown } from '../lib/markdown-cleaner.js';

describe('cleanMarkdown', () => {
  it('adds no branding footer', () => {
    const out = cleanMarkdown('# Hi\n\nHello.');
    expect(out).not.toContain('TokenTrim');
    expect(out).toContain('# Hi');
  });

  it('collapses excessive newlines', () => {
    const out = cleanMarkdown('a\n\n\n\n\nb');
    expect(out).not.toMatch(/\n{4,}/);
  });

  it('compact demotes H4+', () => {
    const out = cleanMarkdown('#### Deep\n\nText', { headingDensity: 'compact' });
    expect(out).toContain('**Deep**');
  });
});
