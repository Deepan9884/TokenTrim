/**
 * TokenTrim - Image → Markdown (vision-friendly, local-first).
 * OCR runs fully locally via vendored Tesseract.js (see lib/ocr.js).
 * Photos/screenshots are pre-processed (upscale + grayscale + contrast)
 * before recognition so small or dim text extracts reliably. When OCR
 * yields nothing useful we still emit vision-ready Markdown so any
 * vision LLM can transcribe the image.
 */

import { getTesseract, tesseractWorkerOptions } from '../ocr.js';

function bytesToMB(n) { return (n / (1024 * 1024)).toFixed(2); }

export async function imageDimensions(file) {
  try {
    if (typeof createImageBitmap !== 'undefined') {
      const bmp = await createImageBitmap(file);
      const w = bmp.width, h = bmp.height;
      try { bmp.close(); } catch { /* ignore */ }
      return { width: w, height: h };
    }
  } catch { /* fall through */ }
  try {
    const url = URL.createObjectURL(file);
    const dims = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = url;
      setTimeout(() => resolve({ width: 0, height: 0 }), 3000);
    });
    try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    return dims;
  } catch { return { width: 0, height: 0 }; }
}

function getCanvas(w, h) {
  try {
    if (typeof document !== 'undefined' && document.createElement) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    }
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  } catch { /* ignore */ }
  return null;
}

async function loadBitmap(file) {
  try {
    if (typeof createImageBitmap !== 'undefined') return await createImageBitmap(file);
  } catch { /* fall through to <img> */ }
  try {
    if (typeof Image === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return null;
    const url = URL.createObjectURL(file);
    try {
      return await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
        setTimeout(() => resolve(null), 5000);
      });
    } finally {
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    }
  } catch { return null; }
}

function bitmapSize(bmp) {
  const w = bmp?.naturalWidth || bmp?.width || 0;
  const h = bmp?.naturalHeight || bmp?.height || 0;
  return { w, h };
}

export function cleanOcrText(raw) {
  let t = String(raw || '').trim();
  if (!t) return '';
  t = t.replace(/\r\n?/g, '\n');

  // Strip non-printable control characters (keep standard whitespace and line breaks)
  t = t.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Strip isolated noise lines (lines of pure punctuation or symbols from OCR noise)
  const lines = t.split('\n');
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true; // keep paragraph spacing
    // Keep lines with alphanumeric characters
    if (/[a-zA-Z0-9\u00C0-\u024F]/.test(trimmed)) return true;
    // Drop lines that are pure repetitive symbols or punctuation noise (e.g. ~~~~, ----, ____, ||||)
    return false;
  });

  t = filtered.join('\n');
  // Collapse excessive line breaks (3+ -> 2)
  t = t.replace(/\n{3,}/g, '\n\n');
  // Collapse multiple horizontal spaces
  t = t.replace(/[ \t]{2,}/g, ' ');
  // Fix OCR spacing before punctuation: "word , text ." -> "word, text."
  t = t.replace(/\s+([,.:;?!])/g, '$1');
  return t.trim();
}

export function assessOcrQuality(text, confidence) {
  const clean = String(text || '').trim();
  if (!clean) return { quality: 'empty', readable: false, wordRatio: 0, confidence: 0 };
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { quality: 'empty', readable: false, wordRatio: 0, confidence: 0 };
  const alphanumericWords = words.filter((w) => /[a-zA-Z0-9\u00C0-\u024F]/.test(w));
  const wordRatio = words.length > 0 ? alphanumericWords.length / words.length : 0;
  const conf = typeof confidence === 'number' && Number.isFinite(confidence) ? confidence : 75;

  const isDistorted = alphanumericWords.length === 0 || (conf < 25 && wordRatio < 0.25);
  return {
    quality: isDistorted ? 'distorted' : (conf < 60 ? 'low' : 'good'),
    readable: !isDistorted,
    wordRatio,
    confidence: conf
  };
}

/**
 * Pre-process an image for OCR: normalize scale and smooth to clean grayscale
 * while preserving natural character anti-aliasing and gradients for Leptonica/Tesseract.
 * Returns a PNG Blob. Falls back to original file outside browser.
 */
export async function preprocessImageForOcr(file) {
  try {
    const bmp = await loadBitmap(file);
    if (!bmp) return file;
    const { w, h } = bitmapSize(bmp);
    if (!w || !h) return file;

    const longEdge = Math.max(w, h);
    let scale = 1;
    // Normalize resolution: upscale small crops/screenshots for optimal character recognition (font height >= 30px)
    if (longEdge > 2600) {
      scale = 2600 / longEdge;
    } else if (longEdge < 1000) {
      scale = Math.min(2.5, 1600 / longEdge);
    }

    const dw = Math.max(1, Math.round(w * scale));
    const dh = Math.max(1, Math.round(h * scale));
    const canvas = getCanvas(dw, dh);
    if (!canvas) return file;
    const ctx = canvas.getContext?.('2d');
    if (!ctx) return file;

    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, dw, dh);
    try { bmp.close?.(); } catch { /* ignore */ }

    // Convert to clean grayscale while preserving gradients and font anti-aliasing
    try {
      const imgData = ctx.getImageData(0, 0, dw, dh);
      const d = imgData.data;
      const len = d.length;

      for (let i = 0; i < len; i += 4) {
        const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
        d[i] = g;
        d[i + 1] = g;
        d[i + 2] = g;
      }
      ctx.putImageData(imgData, 0, 0);
    } catch { /* getImageData may fail in some environments — canvas is still usable */ }

    const blob = await new Promise((resolve) => {
      try {
        if (canvas.convertToBlob) { canvas.convertToBlob({ type: 'image/png' }).then(resolve, () => resolve(null)); return; }
        if (canvas.toBlob) { canvas.toBlob((b) => resolve(b), 'image/png'); return; }
      } catch { /* ignore */ }
      resolve(null);
    });
    return blob || file;
  } catch { return file; }
}

export async function tryLocalOcr(file, opts = {}) {
  const T = getTesseract();
  if (!T || !(T.createWorker || T.recognize)) {
    const err = new Error('OCR_REQUIRED');
    err.detail = 'Local OCR engine failed to load. Reload the extension and try again.';
    throw err;
  }
  const lang = opts.lang || 'eng';
  const target = await preprocessImageForOcr(file);
  try {
    if (T.createWorker) {
      const worker = await T.createWorker(lang, 1, tesseractWorkerOptions(opts));
      try {
        let { data } = await worker.recognize(target);
        if ((!data?.text || (data.confidence != null && data.confidence < 50)) && target !== file) {
          try {
            const rawAttempt = await worker.recognize(file);
            if ((rawAttempt?.data?.confidence ?? 0) > (data?.confidence ?? 0)) {
              data = rawAttempt.data;
            }
          } catch { /* retain initial attempt */ }
        }
        return { text: String(data?.text || ''), confidence: data?.confidence ?? null, engine: 'tesseract' };
      } finally {
        try { await worker.terminate(); } catch { /* ignore */ }
      }
    }
    const { data } = await T.recognize(target, lang);
    return { text: String(data?.text || ''), confidence: data?.confidence ?? null, engine: 'tesseract' };
  } catch (e) {
    if (e && (e.message === 'OCR_REQUIRED' || e.message === 'OCR_FAILED')) throw e;
    const err = new Error('OCR_FAILED');
    err.detail = String(e?.message || e).slice(0, 200);
    throw err;
  }
}

export async function parseImageToMarkdown(file, opts = {}) {
  const { ocrText = null, ocrConfidence = null, lang = 'eng' } = opts;
  const name = file?.name || 'image';
  const dims = await imageDimensions(file).catch(() => ({ width: 0, height: 0 }));
  const dimStr = dims.width ? `${dims.width}×${dims.height}px` : 'unknown dimensions';

  let text = ocrText;
  let confidence = ocrConfidence;
  let engine = null;
  if (text == null && opts.attemptOcr !== false) {
    try {
      const r = await tryLocalOcr(file, { lang, logger: opts.logger });
      text = r.text;
      confidence = r.confidence;
      engine = r.engine;
    } catch (e) {
      // OCR_REQUIRED = engine missing; OCR_FAILED = recognition blew up.
      // Either way fall through to vision-ready output below.
      if (e && e.message !== 'OCR_REQUIRED' && e.message !== 'OCR_FAILED') throw e;
      text = '';
    }
  }

  const clean = cleanOcrText(text);
  const quality = assessOcrQuality(clean, confidence);

  // 1. Google Lens Mode: If any text was recognized, return the extracted text directly as clean Markdown!
  // No AI-upload prompts, no broken image tags, no metadata noise.
  if (clean && clean.length > 0) {
    const confStr = confidence != null ? ` (OCR confidence ${Math.round(confidence)}%)` : '';
    let md = `# ${name.replace(/\.[a-z0-9]+$/i, '')}\n\n`;
    md += `## Extracted text${confStr}\n\n${clean}\n\n`;
    return { markdown: md.trim(), rawText: clean, ocrUsed: true, engine, dims };
  }

  // 2. Only if NO text was detected in the image at all:
  let md = `# ${name.replace(/\.[a-z0-9]+$/i, '')}\n\n`;
  md += `![${name}](${name})\n\n`;
  md += `> Image: ${file?.type || 'image'} • ${bytesToMB(file?.size || 0)} MB • ${dimStr}\n\n`;
  md += `*(No text detected in this image)*\n\n`;
  md += `## How to use with ChatGPT / Claude Vision\n\n`;
  md += `Attach this image in ChatGPT or Claude (click 📎) and paste the prompt below:\n\n`;
  md += `\`\`\`\nTranscribe all visible text exactly from this image, then describe tables, charts, and key visuals as Markdown.\n\`\`\`\n\n`;
  return { markdown: md, rawText: md, ocrUsed: false, engine, dims, needsVision: true };
}

export default { parseImageToMarkdown, tryLocalOcr, imageDimensions, preprocessImageForOcr, cleanOcrText, assessOcrQuality };
