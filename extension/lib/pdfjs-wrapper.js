/**
 * TokenTrim - PDF.js ES Module Wrapper
 * lib/pdf.js (pdf.js v4 ESM build) is STATICALLY imported so esbuild bundles
 * it into dist/popup.js. This deliberately avoids any runtime fetch/import
 * of a separate file, which MV3 browsers may refuse ("Failed to fetch
 * dynamically imported module" for chrome-extension:// resources).
 *
 * lib/pdf.worker.js is ALSO statically imported (side-effect only). In a
 * window context its top-level code just registers
 * `globalThis.pdfjsWorker.WorkerMessageHandler` and stops (its
 * `initializeFromPort` guard requires `typeof window === 'undefined'`).
 * That registration is what pdf.js uses for its in-thread "fake worker":
 * `PDFWorker._setupFakeWorkerGlobal` returns the global WITHOUT fetching
 * anything. So even if the separate worker file is missing/unreadable in
 * the installed extension (or a threaded Worker cannot start), extraction
 * proceeds in-thread instead of failing with PDF_LIB_FAILED.
 * The threaded worker (via workerSrc below) is still tried first for speed.
 */

import * as pdfjsEsm from './pdf.js';
import './pdf.worker.js';

let pdfjsLib = null;
let isInitialized = false;

/**
 * Initialize PDF.js and configure worker path
 * @returns {Promise<Object>} The pdfjsLib object
 */
export async function initializePdfjs() {
  if (isInitialized && pdfjsLib) {
    return pdfjsLib;
  }

  // Preferred: the bundled ESM module.
  if (pdfjsEsm && pdfjsEsm.getDocument) {
    pdfjsLib = pdfjsEsm;
  } else if (
    typeof globalThis !== 'undefined' &&
    globalThis.pdfjsLib &&
    globalThis.pdfjsLib.getDocument
  ) {
    pdfjsLib = globalThis.pdfjsLib;
  } else {
    // Fallback: legacy UMD bundle loaded via classic <script>
    // (sets window.pdfjsLib) — only if someone swaps lib/pdf.js for UMD.
    await waitForPdfjsGlobal();
    const g = typeof window !== 'undefined' ? window : globalThis;
    pdfjsLib = g && (g.pdfjsLib || g.pdfjsDistBuild);
  }

  if (!pdfjsLib || !pdfjsLib.getDocument) {
    throw new Error('PDF.js library not found. The extension bundle is incomplete — reinstall the extension.');
  }

  // Configure worker path (documented approach).
  // pdf.js creates its own Worker from workerSrc (as a module worker) and,
  // if that fails (missing file, CSP, etc.), automatically falls back to its
  // in-thread "fake worker" so extraction still proceeds. We must NOT force
  // a manually-created Worker via workerPort here — that defeats the
  // automatic fallback and turns any worker hiccup into a hard
  // PDF_LIB_FAILED. converter.js may still try workerPort as a best-effort
  // optimization, but it must tolerate failure.
  configureWorkerPath(pdfjsLib);

  isInitialized = true;
  return pdfjsLib;
}

/**
 * Wait for a UMD global (window.pdfjsLib) to appear.
 * Only used as fallback when the bundled ESM module is unavailable.
 */
function waitForPdfjsGlobal() {
  return new Promise((resolve, reject) => {
    const g = (typeof window !== 'undefined' ? window : globalThis);
    // Check if already loaded
    if (g && (g.pdfjsLib || g.pdfjsDistBuild)) {
      resolve();
      return;
    }

    // Wait briefly — if a classic <script> UMD bundle is present it loads fast.
    // Short timeout (3s) so we fail fast instead of hanging the UI for 10s.
    let attempts = 0;
    const maxAttempts = 30; // 3 seconds max

    const checkInterval = setInterval(() => {
      attempts++;
      const gg = (typeof window !== 'undefined' ? window : globalThis);
      if (gg && (gg.pdfjsLib || gg.pdfjsDistBuild)) {
        clearInterval(checkInterval);
        resolve();
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        reject(new Error('PDF.js failed to load (bundled module missing and no UMD global found)'));
      }
    }, 100);
  });
}

/**
 * Configure PDF.js worker path based on context
 * @param {Object} lib - The pdfjsLib object
 */
export function getWorkerUrl() {
  try {
    const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL && chrome.runtime.id;
    if (isExtension) {
      return chrome.runtime.getURL('lib/pdf.worker.js');
    }
    const base = (import.meta && import.meta.url) || '';
    const looksBundled = base.endsWith('/popup.js') || base.endsWith('/dist/popup.js') || /\/dist\//.test(base);
    return looksBundled
      ? new URL('./lib/pdf.worker.js', base).href
      : new URL('./pdf.worker.js', import.meta.url).href;
  } catch (error) {
    return 'lib/pdf.worker.js';
  }
}

function configureWorkerPath(lib) {
  // Documented pdf.js setup: point workerSrc at our bundled worker file.
  // If the worker cannot start, pdf.js logs "Setting up fake worker" and
  // continues in-thread — extraction still works, just slower.
  // workerPort is deliberately left alone (null) so the auto-fallback works.
  try {
    if (
      lib &&
      lib.GlobalWorkerOptions &&
      !lib.GlobalWorkerOptions.workerSrc
    ) {
      lib.GlobalWorkerOptions.workerSrc = getWorkerUrl();
    }
  } catch (error) {
    console.warn('[TokenTrim] Could not set pdf.js workerSrc, will use fake worker:', error);
  }
}

/**
 * Get the pdfjsLib instance (initializes if needed)
 * @returns {Promise<Object>} The pdfjsLib object
 */
export async function getPdfjsLib() {
  if (!isInitialized) {
    await initializePdfjs();
  }
  return pdfjsLib;
}

// Export for direct access after initialization
export { pdfjsLib as default };

// Also expose globally for backward compatibility
if (typeof window !== 'undefined') {
  window.pdfjsWrapper = {
    initializePdfjs,
    getPdfjsLib,
    get pdfjsLib() { return pdfjsLib; }
  };
}
