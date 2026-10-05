/**
 * TokenTrim - Universal source-type registry
 * Single source of truth for every convertible format.
 * Local-first: all parsing stays client-side.
 *
 * Each entry: { id, label, badge, icon, exts, mimes, kind }
 * kind: 'paged' (pdf/pptx) | 'flow' (docx/xlsx/text) | 'vision' (image)
 */

export const SOURCE_TYPES = {
  pdf: {
    id: 'pdf', label: 'PDF', badge: 'PDF', icon: 'picture_as_pdf', kind: 'paged',
    exts: ['.pdf'],
    mimes: ['application/pdf'],
    rangeLabel: 'Pages to extract',
    rangePlaceholder: 'e.g. 1-20, 29-31'
  },
  docx: {
    id: 'docx', label: 'Word', badge: 'DOCX', icon: 'description', kind: 'flow',
    exts: ['.docx'],
    mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    rangeLabel: null, rangePlaceholder: null
  },
  pptx: {
    id: 'pptx', label: 'PowerPoint', badge: 'PPTX', icon: 'slideshow', kind: 'paged',
    exts: ['.pptx', '.ppt'],
    mimes: [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint'
    ],
    rangeLabel: 'Slides to extract',
    rangePlaceholder: 'e.g. 1-10, 15'
  },
  image: {
    id: 'image', label: 'Image', badge: 'IMG', icon: 'image', kind: 'vision',
    exts: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tiff', '.tif', '.heic', '.heif', '.avif'],
    mimes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff', 'image/heic', 'image/heif', 'image/avif'],
    rangeLabel: null, rangePlaceholder: null
  },
  xlsx: {
    id: 'xlsx', label: 'Spreadsheet', badge: 'XLSX', icon: 'table_chart', kind: 'flow',
    exts: ['.xlsx', '.xls'],
    mimes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ],
    rangeLabel: null, rangePlaceholder: null
  },
  csv: {
    id: 'csv', label: 'CSV', badge: 'CSV', icon: 'table_chart', kind: 'flow',
    exts: ['.csv', '.tsv'],
    mimes: ['text/csv', 'text/tab-separated-values', 'application/csv'],
    rangeLabel: null, rangePlaceholder: null
  },
  text: {
    id: 'text', label: 'Text', badge: 'TXT', icon: 'notes', kind: 'flow',
    exts: ['.txt', '.md', '.markdown', '.rtf'],
    mimes: ['text/plain', 'text/markdown', 'text/x-markdown', 'application/rtf', 'text/rtf'],
    rangeLabel: null, rangePlaceholder: null
  },
  html: {
    id: 'html', label: 'Web page', badge: 'HTML', icon: 'language', kind: 'flow',
    exts: ['.html', '.htm', '.xhtml', '.mhtml'],
    mimes: ['text/html', 'application/xhtml+xml', 'multipart/related'],
    rangeLabel: null, rangePlaceholder: null
  },
  epub: {
    id: 'epub', label: 'eBook', badge: 'EPUB', icon: 'menu_book', kind: 'flow',
    exts: ['.epub'],
    mimes: ['application/epub+zip'],
    rangeLabel: null, rangePlaceholder: null
  }
};

const EXT_TO_TYPE = {};
for (const t of Object.values(SOURCE_TYPES)) {
  for (const e of t.exts) EXT_TO_TYPE[e] = t.id;
}

const MIME_TO_TYPE = {};
for (const t of Object.values(SOURCE_TYPES)) {
  for (const m of t.mimes) MIME_TO_TYPE[m.toLowerCase()] = t.id;
}

/**
 * Detect the canonical source type from a File-like { name, type }.
 * Returns one of the SOURCE_TYPES ids, or null when unsupported.
 */
export function detectSourceType(file) {
  if (!file) return null;
  const name = String(file.name || '').toLowerCase();
  const mime = String(file.type || '').toLowerCase().split(';')[0].trim();
  // Extension first (most reliable for OOXML which browsers report oddly)
  for (const [ext, id] of Object.entries(EXT_TO_TYPE)) {
    if (name.endsWith(ext)) return id;
  }
  // Then MIME
  if (mime && MIME_TO_TYPE[mime]) return MIME_TO_TYPE[mime];
  // Fuzzy MIME fallbacks
  if (mime.includes('presentation')) return 'pptx';
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('sheet')) return 'xlsx';
  if (mime.includes('wordprocessingml')) return 'docx';
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'text/html') return 'html';
  if (mime.startsWith('text/')) return 'text';
  return null;
}

export function getSourceType(id) {
  return SOURCE_TYPES[id] || null;
}

export function supportedExtensions() {
  return Object.values(SOURCE_TYPES).flatMap((t) => t.exts);
}

export function acceptAttribute() {
  const exts = supportedExtensions().join(',');
  const mimes = Object.values(SOURCE_TYPES).flatMap((t) => t.mimes).join(',');
  return `${exts},${mimes}`;
}

export function isPagedType(id) {
  return getSourceType(id)?.kind === 'paged';
}

export default { SOURCE_TYPES, detectSourceType, getSourceType, supportedExtensions, acceptAttribute, isPagedType };
