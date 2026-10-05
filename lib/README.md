# TokenTrim Library Folder

## Setup Instructions

### PDF.js (legacy build for Manifest V3 compatibility)

1. Run: `.\setup-pdfjs.ps1` (or manually below)
2. Or visit: https://github.com/mozilla/pdf.js/releases
3. Download the latest release (e.g., `pdfjs-4.x.x-legacy-dist.zip`)
4. Extract into this `lib/` folder:
   - `pdf.js`
   - `pdf.worker.js`

### Tesseract.js (local OCR for images — fully offline)

1. Run: `.\setup-tesseract.ps1` (downloads pinned v5.1.1 + English data)
2. Or vendor manually:
   - `tesseract.min.js` → `lib/tesseract.min.js` (UMD build)
   - `worker.min.js` → `lib/tesseract-worker.min.js`
   - `tesseract-core*.js` + `tesseract-core*.wasm` → `lib/tesseract-core/`
   - `eng.traineddata.gz` → `lib/tessdata/`

Your structure should look like:

```
lib/
  ├── pdf.js
  ├── pdf.worker.js
  ├── tesseract.min.js
  ├── tesseract-worker.min.js
  ├── tesseract-core/
  │    ├── tesseract-core.wasm.js
  │    ├── tesseract-core.wasm
  │    └── ... (simd / lstm variants)
  ├── tessdata/
  │    └── eng.traineddata.gz
  └── README.md (this file)
```

## Why Legacy Build?

Chrome extensions with Manifest V3 require the legacy PDF.js build because:
- The modern build uses ES6 modules which conflict with extension CSP
- The legacy build works with `importScripts()` in service workers

## Why Vendored Tesseract?

- OCR runs 100% on-device: no image bytes leave the browser.
- MV3 extensions cannot rely on CDN scripts at runtime, so the engine,
  worker, WASM core, and language data ship inside the package.
- `lib/ocr.js` points the worker at these local files via
  `chrome.runtime.getURL(...)` (`workerPath` / `langPath` / `corePath`).
