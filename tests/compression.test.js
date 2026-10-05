import { describe, it, expect } from 'vitest';
import { compressMarkdown } from '../lib/compression-engine.js';
import { TokenizerService } from '../lib/tokenizer.js';

describe('compressMarkdown', () => {
  const doc = [
    '# Report', '',
    '## Abstract', 'This report shows revenue grew 12% to $4.2M in Q3.',
    '## Acknowledgements', 'Thanks to everyone.',
    '## Results', 'Margin expanded to 31%. Forecast raised.',
    '## Conclusion', 'Therefore growth continues into Q4.'
  ].join('\n\n');

  it('lossless keeps everything', () => {
    const { text } = compressMarkdown(doc, { mode: 'lossless' });
    expect(text).toContain('Acknowledgements');
  });

  it('extractive drops low-value sections', () => {
    const { text } = compressMarkdown(doc, { mode: 'extractive', tokenBudget: 0 });
    expect(text).toContain('revenue');
  });

  it('budget is enforced', () => {
    const big = ('## S\n\nValue 12345. '.repeat(100));
    const { text } = compressMarkdown(big, { mode: 'extractive', tokenBudget: 150, tokenizerModel: 'claude' });
    expect(TokenizerService.count(text, 'claude')).toBeLessThanOrEqual(220);
  });
});
