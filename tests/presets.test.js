import { describe, it, expect } from 'vitest';
import { getPreset, applyPresetToOptions } from '../lib/presets.js';

describe('presets', () => {
  it('unknown falls back to claude', () => {
    expect(getPreset('nope').id).toBe('claude');
  });

  it('apply maps preset to options', () => {
    const o = applyPresetToOptions('local', { tokenBudget: 0 });
    expect(o.tokenizerModel).toBe('local');
    expect(o.tableStyle).toBe('csv');
    expect(o.tokenBudget).toBe(0);
  });

  it('default budget comes from preset when unset', () => {
    const o = applyPresetToOptions('gemini', {});
    expect(o.tokenBudget).toBe(16000);
  });
});
