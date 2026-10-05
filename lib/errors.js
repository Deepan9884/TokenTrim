/**
 * TokenTrim - Actionable error catalog
 * Every error code maps to title + message + hint + retry guidance.
 */

export const ERROR_CATALOG = {
  PASSWORD_PROTECTED: {
    title: 'Password-protected file',
    message: 'This file is password-protected. Please unlock it first.',
    hint: 'Open the PDF, remove the password (Print → Save as PDF), then retry.',
    retryable: false
  },
  CORRUPT_FILE: {
    title: 'Corrupted or invalid file',
    message: 'This file appears to be corrupted or invalid.',
    hint: 'Try re-exporting the file. If it opens in a reader but fails here, report it via feedback.',
    retryable: true
  },
  EMPTY_FILE: {
    title: 'No extractable text',
    message: 'No extractable text found. If this is a scanned/image PDF, it needs OCR first.',
    hint: 'Tip: open the PDF and try selecting text. If you cannot select text, enable OCR in settings.',
    retryable: false
  },
  PDF_TIMEOUT: {
    title: 'Conversion timed out',
    message: 'Conversion timed out (large or complex PDF).',
    hint: 'Try a smaller file, a page range (e.g. 1–10), or Lossless mode.',
    retryable: true
  },
  PDF_LIB_FAILED: {
    title: 'PDF engine failed',
    message: 'PDF engine failed to load. Reload the extension and try again.',
    hint: 'Reload chrome://extensions → TokenTrim, then retry. Reinstall from the latest zip if it persists.',
    retryable: true
  },
  FILE_TOO_LARGE: {
    title: 'File too large',
    message: 'File exceeds the size limit.',
    hint: 'Free limit is 50 MB (Pro: 200 MB). Split the file or select a page/slide range.',
    retryable: false
  },
  INVALID_TYPE: {
    title: 'Unsupported file type',
    message: 'Please select a supported file: PDF, Word (.docx), PowerPoint (.pptx), image (PNG/JPG/WebP), spreadsheet (.xlsx/.csv), text (.txt/.md), web page (.html), or eBook (.epub).',
    hint: 'Legacy .doc/.ppt/.xls are not supported yet — resave as .docx/.pptx/.xlsx and retry.',
    retryable: false
  },
  LEGACY_FORMAT: {
    title: 'Legacy binary Office file',
    message: 'Legacy binary Office formats (.ppt, .doc, .xls) cannot be parsed directly in the browser.',
    hint: 'Please open the file in Office / Google Slides and Save As modern .pptx / .docx / .xlsx, then convert.',
    retryable: false
  },
  NO_FILE: {
    title: 'No file selected',
    message: 'No file selected.',
    hint: 'Drop a file or click Browse.',
    retryable: false
  },
  PAGE_RANGE_INVALID: {
    title: 'Invalid page selection',
    message: 'That page selection is not valid for this document.',
    hint: 'Use like 1-5, 8, 11-13 with pages inside the document. Blank means all pages.',
    retryable: false
  },
  OCR_REQUIRED: {
    title: 'Local OCR engine failed to load',
    message: 'The local OCR engine failed to load, so no text could be extracted.',
    hint: 'Reload the extension (chrome://extensions → TokenTrim) and retry. Images still export as vision-ready Markdown you can paste into any vision LLM.',
    retryable: true
  },
  OCR_FAILED: {
    title: 'Could not read text in image',
    message: 'Local OCR ran but could not recognize text in this image.',
    hint: 'Retry with a sharper, brighter, straight-on photo. Large clear text works best; tiny or stylized fonts may need a vision LLM instead.',
    retryable: true
  },
  PRO_REQUIRED_IMAGE: {
    title: 'Pro feature: Image conversion',
    message: 'Image to Markdown (OCR & Vision) is exclusively available on TokenTrim Pro.',
    hint: 'Upgrade to Pro or activate your license key in Settings to convert PNG, JPG, and WebP images.',
    retryable: false
  },
  UNKNOWN_ERROR: {
    title: 'Conversion issue',
    message: 'Failed to convert document. Please try again.',
    hint: 'If it persists, use feedback with the document type (no file content is sent).',
    retryable: true
  }
};

export function getErrorInfo(code, details = null) {
  const entry = ERROR_CATALOG[code] || ERROR_CATALOG.UNKNOWN_ERROR;
  return { code, ...entry, details };
}

export default { ERROR_CATALOG, getErrorInfo };
