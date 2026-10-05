import { describe, it, expect } from 'vitest';
import { ocrAvailable, tesseractWorkerOptions, isScannedPage } from '../lib/ocr.js';
import { tryLocalOcr, preprocessImageForOcr, parseImageToMarkdown, cleanOcrText, assessOcrQuality } from '../lib/converters/image-handler.js';

describe('local OCR wiring', () => {
  it('reports engine absent in node (no window.Tesseract)', () => {
    expect(ocrAvailable()).toBe(false);
  });

  it('builds empty worker options without chrome.runtime (falls back to defaults)', () => {
    const opts = tesseractWorkerOptions({});
    expect(opts).toBeDefined();
    expect(opts.workerPath).toBeUndefined();
    expect(opts.gzip).toBe(true);
  });

  it('tryLocalOcr throws OCR_REQUIRED when engine is not loaded', async () => {
    const file = { name: 'photo.png', type: 'image/png', size: 1024 };
    await expect(tryLocalOcr(file, { lang: 'eng' })).rejects.toThrow('OCR_REQUIRED');
  });

  it('preprocess falls back to the original file outside the browser', async () => {
    const file = { name: 'photo.png', type: 'image/png', size: 1024 };
    const out = await preprocessImageForOcr(file);
    expect(out).toBe(file);
  });

  it('parseImageToMarkdown still yields vision-ready output when OCR engine missing', async () => {
    const file = { name: 'photo.png', type: 'image/png', size: 1024 * 100 };
    const res = await parseImageToMarkdown(file, {});
    expect(res.ocrUsed).toBe(false);
    expect(res.needsVision).toBe(true);
    expect(res.markdown).toContain('Transcribe all visible text exactly');
  });

  it('isScannedPage flags empty/short text', () => {
    expect(isScannedPage('')).toBe(true);
    expect(isScannedPage('hi')).toBe(true);
    expect(isScannedPage('This is a full sentence with plenty of real words in it.')).toBe(false);
  });

  it('cleanOcrText removes isolated noise lines and normalizes punctuation', () => {
    const noisy = `
    Header Title
    ~~~ ~~~ |||
    This is line one , with bad space .
    ---
    This is line two!
    `;
    const cleaned = cleanOcrText(noisy);
    expect(cleaned).toContain('Header Title');
    expect(cleaned).not.toContain('~~~ ~~~ |||');
    expect(cleaned).toContain('line one, with bad space.');
    expect(cleaned).toContain('This is line two!');
  });

  it('assessOcrQuality flags low confidence and distorted gibberish', () => {
    const good = assessOcrQuality('This is high quality text extracted from a clear document.', 88);
    expect(good.readable).toBe(true);
    expect(good.quality).toBe('good');

    const distorted = assessOcrQuality('~ | / - _ . : ^ ^ ^', 20);
    expect(distorted.readable).toBe(false);
    expect(distorted.quality).toBe('distorted');
  });
});
