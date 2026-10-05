import { describe, it, expect } from 'vitest';
import { TokenizerService } from '../lib/tokenizer.js';

describe('TokenizerService', () => {
  it('counts all models deterministically', () => {
    const text = 'Hello world. This is a TokenTrim test document with numbers 12345.';
    const all = TokenizerService.countAll(text);
    expect(all.claude).toBeGreaterThan(0);
    expect(all.chatgpt).toBeGreaterThan(0);
    expect(all.gemini).toBeGreaterThan(0);
    expect(all.local).toBeGreaterThan(0);
    // local model is denser than chatgpt for same text
    expect(all.local).toBeGreaterThanOrEqual(all.chatgpt);
  });

  it('ledger computes savings', () => {
    const raw = '# Title\n\n' + 'Hello world. '.repeat(100);
    const opt = '# Title\n\nHello world.';
    const l = TokenizerService.ledger(raw, opt, 'claude');
    expect(l.originalTokens).toBeGreaterThan(l.optimizedTokens);
    expect(l.savingsPercent).toBeGreaterThan(50);
  });

  it('truncateToBudget fits budget', () => {
    const text = ('Sentence number one. Sentence number two! Is this sentence three? '.repeat(50));
    const { text: out, truncated } = TokenizerService.truncateToBudget(text, 200, 'claude');
    expect(truncated).toBe(true);
    expect(TokenizerService.count(out, 'claude')).toBeLessThanOrEqual(230);
  });

  it('empty text is zero', () => {
    expect(TokenizerService.count('', 'claude')).toBe(0);
  });

  it('estimates image vision tokens and ledger savings', () => {
    const tokens = TokenizerService.estimateImageTokens({ width: 1600, height: 759 }, 'claude');
    expect(tokens).toBeGreaterThanOrEqual(1000);
    const ledger = TokenizerService.imageLedger(tokens, 'Hello world from OCR', 'claude');
    expect(ledger.originalTokens).toBe(tokens);
    expect(ledger.optimizedTokens).toBeLessThan(50);
    expect(ledger.savingsPercent).toBeGreaterThanOrEqual(95);
  });
});
