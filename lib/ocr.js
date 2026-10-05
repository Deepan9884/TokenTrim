/**
 * TokenTrim - OCR engine (Tesseract.js, fully local).
 * Uses vendored assets — no CDN, no network:
 *   lib/tesseract.min.js          (UMD, loaded via <script> in popup/sidepanel)
 *   lib/tesseract-worker.min.js   (worker script)
 *   lib/tesseract-core/           (WASM core + loaders)
 *   lib/tessdata/eng.traineddata.gz (language data)
 *
 * Configure once with local chrome-extension:// URLs so the worker never
 * hits the network. Falls back to defaults (CDN) only when chrome.runtime
 * is unavailable (e.g. unit tests) — OCR then throws OCR_REQUIRED unless
 * an engine is present.
 */

export function getTesseract() {
  try {
    if (typeof window !== 'undefined' && window.Tesseract) return window.Tesseract;
    if (typeof Tesseract !== 'undefined') return Tesseract;
  } catch { /* ignore */ }
  return null;
}

export function ocrAvailable() {
  return !!getTesseract();
}

function extUrl(path) {
  try {
    if (typeof chrome !== 'undefined' && chrome?.runtime?.getURL) {
      return chrome.runtime.getURL(path);
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Build createWorker options pointing at vendored local assets.
 * Returns {} when extension URLs are unavailable (tests / non-extension
 * pages) so callers fall back to Tesseract defaults.
 */
export function tesseractWorkerOptions(opts = {}) {
  const workerPath = extUrl('lib/tesseract-worker.min.js');
  const corePath = extUrl('lib/tesseract-core');
  const langPath = extUrl('lib/tessdata');
  const options = {};
  if (workerPath) options.workerPath = workerPath;
  if (corePath) options.corePath = corePath;
  if (langPath) options.langPath = langPath;
  // Extension pages: load the worker file directly instead of via a Blob
  // URL (avoids MV3 blob-worker CSP issues).
  if (workerPath) options.workerBlobURL = false;
  // Vendored language file is gzipped (eng.traineddata.gz).
  options.gzip = opts.gzip !== false;
  if (typeof opts.logger === 'function') options.logger = opts.logger;
  if (typeof opts.cacheMethod === 'string') options.cacheMethod = opts.cacheMethod;
  return options;
}

export function isScannedPage(pageText, options = {}) {
  const t = String(pageText || '').trim();
  if (!t) return true;
  if (t.length < (options.minChars || 40)) return true;
  const words = (t.match(/[A-Za-z]{2,}/g) || []).length;
  return words < (options.minWords || 6);
}

export async function ocrPageWithTesseract(imageData, opts = {}) {
  const T = getTesseract();
  if (!T) {
    const err = new Error('OCR_REQUIRED');
    err.detail = 'Local OCR engine failed to load. Reload the extension and try again.';
    throw err;
  }
  const lang = opts.lang || 'eng';
  try {
    if (T.createWorker) {
      const worker = await T.createWorker(lang, 1, tesseractWorkerOptions(opts));
      try {
        const { data } = await worker.recognize(imageData);
        return String(data?.text || '');
      } finally {
        try { await worker.terminate(); } catch { /* ignore */ }
      }
    }
    const { data } = await T.recognize(imageData, lang);
    return String(data?.text || '');
  } catch (e) {
    if (e && e.message === 'OCR_REQUIRED') throw e;
    const err = new Error('OCR_FAILED');
    err.detail = String(e?.message || e).slice(0, 200);
    try { err.cause = e; } catch { /* ignore */ }
    throw err;
  }
}

export default { isScannedPage, ocrPageWithTesseract, ocrAvailable, getTesseract, tesseractWorkerOptions };
