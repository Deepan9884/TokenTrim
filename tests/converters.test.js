import { describe, it, expect } from 'vitest';
import { detectSourceType, getSourceType, SOURCE_TYPES } from '../lib/converters/source-types.js';
import { parseImageToMarkdown, imageDimensions } from '../lib/converters/image-handler.js';
import { DocumentConverter } from '../lib/converter.js';

describe('detectSourceType', () => {
  it('identifies PowerPoint formats', () => {
    expect(detectSourceType({ name: 'pitch.pptx' })).toBe('pptx');
    expect(detectSourceType({ name: 'deck.ppt' })).toBe('pptx');
    expect(detectSourceType({ name: 'presentation', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })).toBe('pptx');
  });

  it('identifies Image formats', () => {
    expect(detectSourceType({ name: 'diagram.png' })).toBe('image');
    expect(detectSourceType({ name: 'photo.jpg' })).toBe('image');
    expect(detectSourceType({ name: 'screenshot.webp' })).toBe('image');
    expect(detectSourceType({ name: 'scan.tiff' })).toBe('image');
    expect(detectSourceType({ name: 'camera.heic' })).toBe('image');
    expect(detectSourceType({ name: 'graphic', type: 'image/png' })).toBe('image');
  });

  it('identifies Spreadsheets, Text, Word, and PDF', () => {
    expect(detectSourceType({ name: 'sheet.xlsx' })).toBe('xlsx');
    expect(detectSourceType({ name: 'data.csv' })).toBe('csv');
    expect(detectSourceType({ name: 'notes.txt' })).toBe('text');
    expect(detectSourceType({ name: 'readme.md' })).toBe('text');
    expect(detectSourceType({ name: 'doc.docx' })).toBe('docx');
    expect(detectSourceType({ name: 'report.pdf' })).toBe('pdf');
  });
});

describe('Image Conversion', () => {
  it('generates vision-ready markdown when no OCR engine is present', async () => {
    const file = {
      name: 'architecture.png',
      type: 'image/png',
      size: 1024 * 500
    };

    const res = await parseImageToMarkdown(file, { attemptOcr: false });
    expect(res.markdown).toContain('# architecture');
    expect(res.markdown).toContain('![architecture.png](architecture.png)');
    expect(res.markdown).toContain('Image: image/png');
    expect(res.markdown).toContain('Transcribe all visible text exactly');
    expect(res.needsVision).toBe(true);
  });

  it('integrates OCR text into markdown when OCR text is provided', async () => {
    const file = {
      name: 'receipt.jpg',
      type: 'image/jpeg',
      size: 1024 * 120
    };

    const res = await parseImageToMarkdown(file, {
      ocrText: 'Total: $42.50\nStore #1042\nDate: 2026-09-22',
      ocrConfidence: 94
    });

    expect(res.markdown).toContain('# receipt');
    expect(res.markdown).toContain('Extracted text (OCR confidence 94%)');
    expect(res.markdown).toContain('Total: $42.50');
    expect(res.ocrUsed).toBe(true);
  });

  it('runs through DocumentConverter.convert for image', async () => {
    const converter = new DocumentConverter();
    const file = {
      name: 'mockup.png',
      type: 'image/png',
      size: 1024 * 80
    };

    const result = await converter.convert(file, { attemptOcr: false });
    expect(result.markdown).toContain('# mockup');
    expect(result.stats).toBeDefined();
    expect(result.metadata.type).toBe('image');
  });
});

describe('PowerPoint (PPT / PPTX) Conversion', () => {
  it('detects legacy binary .ppt files and throws LEGACY_FORMAT', async () => {
    const converter = new DocumentConverter();
    // OLE header: 0xD0, 0xCF, 0x11, 0xE0
    const oleBytes = new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
    const file = {
      name: 'legacy_deck.ppt',
      type: 'application/vnd.ms-powerpoint',
      size: oleBytes.length,
      arrayBuffer: async () => oleBytes.buffer
    };

    await expect(converter.convert(file)).rejects.toThrow('LEGACY_FORMAT');
  });

  it('handles corrupt PPTX archive gracefully', async () => {
    const converter = new DocumentConverter();
    const garbageBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const file = {
      name: 'broken.pptx',
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      size: garbageBytes.length,
      arrayBuffer: async () => garbageBytes.buffer
    };

    await expect(converter.convert(file)).rejects.toThrow('CORRUPT_FILE');
  });

  it('rejects image conversion when user is on Free tier (isPro: false)', async () => {
    const converter = new DocumentConverter();
    const file = {
      name: 'screenshot.png',
      type: 'image/png',
      size: 1024 * 50
    };

    await expect(converter.convert(file, { isPro: false })).rejects.toThrow('PRO_REQUIRED_IMAGE');
  });
});

describe('Tier Format Permissions & Limits', () => {
  it('License restricts Image to Pro and limits PPT on Free', async () => {
    const { License } = await import('../lib/license.js');
    License.plan = 'free';
    expect(License.isFormatAllowed('pdf')).toBe(true);
    expect(License.isFormatAllowed('docx')).toBe(true);
    expect(License.isFormatAllowed('pptx')).toBe(true);
    expect(License.isFormatAllowed('image')).toBe(false);
    expect(License.maxPptSlides()).toBe(10);

    License.plan = 'pro';
    expect(License.isFormatAllowed('image')).toBe(true);
    expect(License.maxPptSlides()).toBe(Infinity);
  });
});


