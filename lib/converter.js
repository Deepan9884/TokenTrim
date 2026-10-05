/**
 * TokenTrim - Document to Markdown Converter Module
 * Orchestrator: parse → structure → boilerplate remove → table optimize →
 * clean → compress → query filter → budget → tokenize → report
 * 100% local. No network calls. No branding footer in output.
 */

import { getPdfjsLib, getWorkerUrl } from './pdfjs-wrapper.js';
import { TokenizerService } from './tokenizer.js';
import { stripBoilerplate } from './boilerplate-remover.js';
import { optimizeMarkdownTables, detectTextTables } from './table-optimizer.js';
import { cleanMarkdown } from './markdown-cleaner.js';
import { compressMarkdown } from './compression-engine.js';
import { bm25Select } from './relevance-scorer.js';
import { getPreset } from './presets.js';
import { clampPages, formatPages } from './page-range.js';
import { isScannedPage, ocrPageWithTesseract, ocrAvailable } from './ocr.js';
import { detectSourceType, getSourceType } from './converters/source-types.js';
import { parsePptxToMarkdown } from './converters/pptx-parser.js';
import { parseXlsxToMarkdown, parseDelimitedToMarkdown } from './converters/sheet-parser.js';
import { parseTextToMarkdown, htmlToMarkdownSmart, parseEpubToMarkdown } from './converters/text-parser.js';
import { parseImageToMarkdown } from './converters/image-handler.js';

const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;
const ABSOLUTE_MAX_BYTES = 200 * 1024 * 1024;

function normalizeOptions(options = {}) {
  const presetKey = options.preset || 'claude';
  const preset = getPreset(presetKey);
  return {
    preset: preset.id,
    tokenizerModel: options.tokenizerModel || preset.tokenizerModel || 'claude',
    stripHeaders: options.stripHeaders !== false,
    formatTables: options.formatTables !== false,
    headingDensity: options.headingDensity || preset.headingDensity || 'full',
    tableStyle: options.tableStyle || preset.tableStyle || 'markdown',
    citationHandling: options.citationHandling || preset.citationHandling || 'keep',
    boilerplateAggressiveness: options.boilerplateAggressiveness || preset.boilerplateAggressiveness || 'standard',
    compressionMode: options.compressionMode || 'lossless',
    tokenBudget: typeof options.tokenBudget === 'number' ? options.tokenBudget : 0,
    docPreset: options.docPreset || 'general',
    docKeep: options.docKeep || [],
    query: options.query || '',
    queryTopK: options.queryTopK || 5,
    pageRange: options.pageRange || null, // { pages: [...] } or legacy { from, to } — slides for pptx
    slideRange: options.slideRange || options.pageRange || null,
    includeNotes: options.includeNotes !== false,
    includeHidden: options.includeHidden !== false,
    ocrEnabled: options.ocrEnabled === true,
    ocrLang: options.ocrLang || 'eng',
    attemptOcr: options.attemptOcr !== false,
    maxBytes: options.maxBytes || DEFAULT_MAX_BYTES,
    listMarker: options.listMarker || '-',
    detectTextTables: options.detectTextTables !== false, // PDF only; DOCX opts out
    isPro: typeof options.isPro === 'boolean' ? options.isPro : true,
    maxPptSlides: typeof options.maxPptSlides === 'number' ? options.maxPptSlides : 10
  };
}

function applyPageRange(pageTexts, pageRange) {
  const total = pageTexts.length;
  const all = { texts: pageTexts, pages: pageTexts.map((_, i) => i + 1), filtered: false };
  if (!pageRange) return all;
  // Legacy { from, to } → expand to an explicit page list.
  let wanted = null;
  if (Array.isArray(pageRange.pages)) wanted = pageRange.pages;
  else if (typeof pageRange.from === 'number') {
    const from = Math.floor(pageRange.from);
    const to = pageRange.to !== undefined ? Math.floor(pageRange.to) : total;
    if (!(from >= 1) || !(to >= from)) return { ...all, error: 'PAGE_RANGE_INVALID' };
    wanted = [];
    for (let p = from; p <= to; p++) wanted.push(p);
  } else return all;
  const clamped = clampPages(wanted, total);
  if (clamped.error) return { ...all, error: 'PAGE_RANGE_INVALID', errorDetail: clamped.error };
  const pages = clamped.pages;
  if (pages.length >= total) return all; // covers everything → no filter
  return { texts: pages.map(p => pageTexts[p - 1]), pages, filtered: true };
}

export class DocumentConverter {
  constructor() {
    this.pdfjsLib = null;
    this.initialized = false;
    this.initError = null;
  }

  async initialize() {
    if (this.initialized) return true;
    try {
      this.pdfjsLib = await getPdfjsLib();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize PDF.js:', error);
      this.initError = error;
      return false;
    }
  }

  validateFile(file, maxBytesOverride = 0) {
    if (!file) return { valid: false, error: 'NO_FILE' };
    const sourceType = detectSourceType(file);
    if (!sourceType) return { valid: false, error: 'INVALID_TYPE' };
    const maxSize = maxBytesOverride > 0
      ? Math.min(maxBytesOverride, ABSOLUTE_MAX_BYTES)
      : DEFAULT_MAX_BYTES;
    if (file.size > maxSize) return { valid: false, error: 'FILE_TOO_LARGE', maxSize };
    if (file.size === 0) return { valid: false, error: 'EMPTY_FILE' };
    return { valid: true, sourceType };
  }

  detectType(file) {
    return detectSourceType(file);
  }

  async convert(file, options = {}, progressCallback = null) {
    const opts = normalizeOptions(options);
    const validation = this.validateFile(file, opts.maxBytes);
    if (!validation.valid) throw new Error(validation.error);
    const sourceType = validation.sourceType || detectSourceType(file) || 'pdf';
    switch (sourceType) {
      case 'docx': return await this.convertDocx(file, opts, progressCallback);
      case 'pptx': return await this.convertPptx(file, opts, progressCallback);
      case 'image': return await this.convertImage(file, opts, progressCallback);
      case 'xlsx': return await this.convertXlsx(file, opts, progressCallback);
      case 'csv': return await this.convertCsv(file, opts, progressCallback);
      case 'text': return await this.convertPlainText(file, opts, progressCallback);
      case 'html': return await this.convertHtml(file, opts, progressCallback);
      case 'epub': return await this.convertEpub(file, opts, progressCallback);
      case 'pdf':
      default: return await this.convertPdf(file, opts, progressCallback);
    }
  }

  async convertDocx(file, options = {}, progressCallback = null) {
    const opts = normalizeOptions(options);
    if (progressCallback) progressCallback(10, 'Reading Word document...');
    const arrayBuffer = await this.readFileAsArrayBuffer(file);
    if (progressCallback) progressCallback(30, 'Extracting document content...');

    const mammothLib = (typeof window !== 'undefined' && window.mammoth)
      ? window.mammoth
      : (typeof mammoth !== 'undefined' ? mammoth : null);
    if (!mammothLib) throw new Error('DOCX converter library not loaded');

    let html = '';
    try {
      const result = await mammothLib.convertToHtml({ arrayBuffer });
      html = result.value || '';
    } catch (err) {
      console.error('Mammoth extraction failed:', err);
      throw new Error('CORRUPT_FILE');
    }
    if (!html.trim()) throw new Error('EMPTY_FILE');

    if (progressCallback) progressCallback(55, 'Formatting Markdown & tables...');
    const rawMarkdown = this.htmlToMarkdown(html, opts.formatTables);
    // DOCX tables arrive as real tables via Mammoth; skip text-table detection
    // (indented prose/code must not become tables).
    const pipeline = this.runPipeline(rawMarkdown, [], { ...opts, detectTextTables: false }, progressCallback, 60);
    if (progressCallback) progressCallback(100, 'Conversion complete!');
    return {
      markdown: pipeline.markdown,
      stats: this.calculateStats(file, pipeline.markdown, 1, rawMarkdown, opts.tokenizerModel),
      report: pipeline.report,
      metadata: { filename: file.name, type: 'docx', pages: 1, size: file.size }
    };
  }

  async convertPptx(file, options = {}, progressCallback = null) {
    const opts = normalizeOptions(options);
    if (progressCallback) progressCallback(10, 'Reading presentation...');
    const arrayBuffer = await this.readFileAsArrayBuffer(file);
    if (progressCallback) progressCallback(35, 'Extracting slides...');
    let parsed;
    try {
      parsed = await parsePptxToMarkdown(arrayBuffer, {
        includeNotes: opts.includeNotes,
        includeHidden: opts.includeHidden
      });
    } catch (err) {
      if (err.message === 'EMPTY_FILE' || err.message === 'CORRUPT_FILE' || err.message === 'LEGACY_FORMAT') throw err;
      console.error('PPTX extraction failed:', err);
      throw new Error('CORRUPT_FILE');
    }
    // Slide range = reuse pageRange semantics
    const range = opts.slideRange || opts.pageRange;
    let workingText = parsed.rawText;
    let slideCount = parsed.slides;
    let rangeInfo = null;
    if (range) {
      const allSlides = Array.from({ length: parsed.slides }, (_, i) => i + 1);
      // Split markdown per slide on "## Slide N" markers, then filter
      const parts = parsed.markdown.split(/(?=^## Slide \d+)/m).filter((s) => s.trim());
      const wanted = Array.isArray(range.pages) ? range.pages : null;
      if (wanted) {
        const clamped = clampPages(wanted, parsed.slides);
        if (clamped.error) {
          const e = new Error('PAGE_RANGE_INVALID');
          try { e.detail = clamped.error; } catch { /* ignore */ }
          throw e;
        }
        const keep = new Set(clamped.pages);
        const filtered = parts.filter((_, i) => keep.has(i + 1));
        if (filtered.length && filtered.length < parts.length) {
          workingText = filtered.join('\n\n');
          parsed.markdown = filtered.join('\n\n');
          slideCount = filtered.length;
          rangeInfo = { pages: clamped.pages, label: formatPages(clamped.pages), filtered: true };
        }
      } else if (typeof range.from === 'number') {
        const from = Math.floor(range.from);
        const to = range.to !== undefined ? Math.floor(range.to) : parsed.slides;
        if (!(from >= 1) || !(to >= from)) throw new Error('PAGE_RANGE_INVALID');
        const clamped = clampPages(Array.from({ length: to - from + 1 }, (_, i) => from + i), parsed.slides);
        if (clamped.error) throw new Error('PAGE_RANGE_INVALID');
        const keep = new Set(clamped.pages);
        const filtered = parts.filter((_, i) => keep.has(i + 1));
        if (filtered.length && filtered.length < parts.length) {
          parsed.markdown = filtered.join('\n\n');
          workingText = parsed.markdown;
          slideCount = filtered.length;
          rangeInfo = { pages: clamped.pages, label: formatPages(clamped.pages), filtered: true };
        }
      }
      void allSlides;
    }
    if (opts.isPro === false && parsed.slides > opts.maxPptSlides && !range) {
      const parts = parsed.markdown.split(/(?=^## Slide \d+)/m).filter((s) => s.trim());
      const filtered = parts.slice(0, opts.maxPptSlides);
      parsed.markdown = filtered.join('\n\n') + '\n\n> ⚠️ *Free Plan limit: Extracted first ' + opts.maxPptSlides + ' of ' + parsed.slides + ' slides. Upgrade to Pro for unlimited slides.*\n';
      workingText = filtered.join('\n\n');
      slideCount = opts.maxPptSlides;
      const pages = Array.from({ length: opts.maxPptSlides }, (_, i) => i + 1);
      rangeInfo = { pages, label: `1-${opts.maxPptSlides} (Free limit)`, filtered: true };
    }
    if (!parsed.markdown.trim()) throw new Error('EMPTY_FILE');
    if (progressCallback) progressCallback(70, 'Optimizing for AI...');
    const pipeline = this.runPipeline(parsed.markdown, [], { ...opts, detectTextTables: false }, progressCallback, 72, {
      totalPages: parsed.slides,
      rangePages: rangeInfo?.pages || null,
      rangeLabel: rangeInfo?.label || null,
      rangeFiltered: !!rangeInfo?.filtered
    });
    if (progressCallback) progressCallback(100, 'Conversion complete!');
    return {
      markdown: pipeline.markdown,
      stats: this.calculateStats(file, pipeline.markdown, slideCount, workingText, opts.tokenizerModel),
      report: { ...pipeline.report, sourceType: 'pptx', slides: slideCount },
      metadata: { filename: file.name, type: 'pptx', pages: slideCount, size: file.size }
    };
  }

  async convertImage(file, options = {}, progressCallback = null) {
    const opts = normalizeOptions(options);
    if (opts.isPro === false) {
      throw new Error('PRO_REQUIRED_IMAGE');
    }
    if (progressCallback) progressCallback(15, 'Reading image...');
    let parsed;
    try {
      parsed = await parseImageToMarkdown(file, {
        lang: opts.ocrLang,
        attemptOcr: opts.attemptOcr && (opts.ocrEnabled || true),
        logger: (m) => {
          try {
            if (!progressCallback || !m) return;
            const status = String(m.status || '');
            const p = typeof m.progress === 'number' ? m.progress : 0;
            if (status.includes('recognizing')) {
              progressCallback(Math.round(20 + p * 35), 'Reading text in image (OCR)...');
            } else if (status.includes('loading') || status.includes('initializing')) {
              progressCallback(18, 'Loading local OCR engine...');
            }
          } catch { /* progress optional */ }
        }
      });
    } catch (err) {
      if (err.message === 'OCR_REQUIRED' || err.message === 'OCR_FAILED' || err.message === 'EMPTY_FILE') throw err;
      throw new Error('CORRUPT_FILE');
    }
    if (progressCallback) progressCallback(60, 'Formatting Markdown...');
    // Images: keep vision-ready structure; still run light clean + budget
    const pipeline = this.runPipeline(parsed.markdown, [], {
      ...opts, stripHeaders: false, detectTextTables: false, compressionMode: 'lossless'
    }, progressCallback, 65, { ocrUsed: !!parsed.ocrUsed });
    if (opts.tokenBudget > 0) {
      const r = TokenizerService.truncateToBudget(pipeline.markdown, opts.tokenBudget, opts.tokenizerModel);
      pipeline.markdown = r.text;
      pipeline.report.truncated = r.truncated;
      if (r.truncated) pipeline.report.warnings.push('Output truncated to fit token budget.');
    }
    if (progressCallback) progressCallback(100, 'Conversion complete!');
    if (parsed.needsVision && !parsed.ocrUsed) {
      pipeline.report.warnings.push('No readable text found — exported as vision-ready Markdown. Paste into a vision-capable chat, or retry with a sharper/brighter photo.');
    }
    return {
      markdown: pipeline.markdown,
      stats: this.calculateStats(file, pipeline.markdown, 1, parsed.rawText, opts.tokenizerModel, { sourceType: 'image', dims: parsed.dims }),
      report: { ...pipeline.report, sourceType: 'image', ocrUsed: !!parsed.ocrUsed },
      metadata: { filename: file.name, type: 'image', pages: 1, size: file.size }
    };
  }

  async convertXlsx(file, options = {}, progressCallback = null) {
    const opts = normalizeOptions(options);
    if (progressCallback) progressCallback(15, 'Reading spreadsheet...');
    const arrayBuffer = await this.readFileAsArrayBuffer(file);
    let parsed;
    try {
      parsed = await parseXlsxToMarkdown(arrayBuffer);
    } catch (err) {
      if (err.message === 'EMPTY_FILE' || err.message === 'CORRUPT_FILE') throw err;
      throw new Error('CORRUPT_FILE');
    }
    if (progressCallback) progressCallback(65, 'Formatting tables...');
    const pipeline = this.runPipeline(parsed.markdown, [], { ...opts, stripHeaders: false, detectTextTables: false }, progressCallback, 70, {
      sheets: parsed.sheets, rows: parsed.rows
    });
    if (progressCallback) progressCallback(100, 'Conversion complete!');
    return {
      markdown: pipeline.markdown,
      stats: this.calculateStats(file, pipeline.markdown, parsed.sheets || 1, parsed.rawText, opts.tokenizerModel),
      report: { ...pipeline.report, sourceType: 'xlsx' },
      metadata: { filename: file.name, type: 'xlsx', pages: parsed.sheets || 1, size: file.size }
    };
  }

  async convertCsv(file, options = {}, progressCallback = null) {
    const opts = normalizeOptions(options);
    if (progressCallback) progressCallback(20, 'Reading CSV...');
    const text = await this.readFileAsText(file);
    let parsed;
    try {
      parsed = parseDelimitedToMarkdown(text, file.name || '');
    } catch (err) {
      if (err.message === 'EMPTY_FILE') throw err;
      throw new Error('CORRUPT_FILE');
    }
    if (progressCallback) progressCallback(65, 'Formatting table...');
    const pipeline = this.runPipeline(parsed.markdown, [], { ...opts, stripHeaders: false, detectTextTables: false }, progressCallback, 70);
    if (progressCallback) progressCallback(100, 'Conversion complete!');
    return {
      markdown: pipeline.markdown,
      stats: this.calculateStats(file, pipeline.markdown, 1, parsed.rawText, opts.tokenizerModel),
      report: { ...pipeline.report, sourceType: 'csv' },
      metadata: { filename: file.name, type: 'csv', pages: 1, size: file.size }
    };
  }

  async convertPlainText(file, options = {}, progressCallback = null) {
    const opts = normalizeOptions(options);
    if (progressCallback) progressCallback(20, 'Reading text...');
    const text = await this.readFileAsText(file);
    let parsed;
    try {
      parsed = parseTextToMarkdown(text);
    } catch (err) {
      if (err.message === 'EMPTY_FILE') throw err;
      throw new Error('CORRUPT_FILE');
    }
    if (progressCallback) progressCallback(60, 'Optimizing...');
    const pipeline = this.runPipeline(parsed.markdown, [], { ...opts, stripHeaders: false, detectTextTables: false }, progressCallback, 65);
    if (progressCallback) progressCallback(100, 'Conversion complete!');
    return {
      markdown: pipeline.markdown,
      stats: this.calculateStats(file, pipeline.markdown, 1, parsed.rawText, opts.tokenizerModel),
      report: { ...pipeline.report, sourceType: 'text' },
      metadata: { filename: file.name, type: 'text', pages: 1, size: file.size }
    };
  }

  async convertHtml(file, options = {}, progressCallback = null) {
    const opts = normalizeOptions(options);
    if (progressCallback) progressCallback(20, 'Reading page...');
    const text = await this.readFileAsText(file);
    let parsed;
    try {
      parsed = htmlToMarkdownSmart(text, opts.formatTables);
    } catch (err) {
      if (err.message === 'EMPTY_FILE') throw err;
      throw new Error('CORRUPT_FILE');
    }
    if (progressCallback) progressCallback(60, 'Cleaning article...');
    const pipeline = this.runPipeline(parsed.markdown, [], opts, progressCallback, 65);
    if (progressCallback) progressCallback(100, 'Conversion complete!');
    return {
      markdown: pipeline.markdown,
      stats: this.calculateStats(file, pipeline.markdown, 1, parsed.rawText, opts.tokenizerModel),
      report: { ...pipeline.report, sourceType: 'html' },
      metadata: { filename: file.name, type: 'html', pages: 1, size: file.size }
    };
  }

  async convertEpub(file, options = {}, progressCallback = null) {
    const opts = normalizeOptions(options);
    if (progressCallback) progressCallback(15, 'Reading eBook...');
    const arrayBuffer = await this.readFileAsArrayBuffer(file);
    let parsed;
    try {
      parsed = await parseEpubToMarkdown(arrayBuffer);
    } catch (err) {
      if (err.message === 'EMPTY_FILE' || err.message === 'CORRUPT_FILE') throw err;
      throw new Error('CORRUPT_FILE');
    }
    if (progressCallback) progressCallback(65, 'Structuring chapters...');
    const pipeline = this.runPipeline(parsed.markdown, [], opts, progressCallback, 70, { chapters: parsed.chapters });
    if (progressCallback) progressCallback(100, 'Conversion complete!');
    return {
      markdown: pipeline.markdown,
      stats: this.calculateStats(file, pipeline.markdown, parsed.chapters || 1, parsed.rawText, opts.tokenizerModel),
      report: { ...pipeline.report, sourceType: 'epub' },
      metadata: { filename: file.name, type: 'epub', pages: parsed.chapters || 1, size: file.size }
    };
  }

  async readFileAsText(file) {
    if (file && typeof file.text === 'function') {
      try { return await file.text(); } catch (e) { console.warn('file.text failed, falling back to FileReader', e); }
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(String(e.target.result || ''));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  htmlToMarkdown(html, formatTables = true) {
    const TurndownClass = (typeof window !== 'undefined' && window.TurndownService)
      ? window.TurndownService
      : (typeof TurndownService !== 'undefined' ? TurndownService : null);
    if (TurndownClass) {
      const turndownService = new TurndownClass({
        headingStyle: 'atx', hr: '---', bulletListMarker: '-',
        codeBlockStyle: 'fenced', emDelimiter: '*'
      });
      const gfmPlugin = (typeof window !== 'undefined' && window.turndownPluginGfm)
        ? window.turndownPluginGfm : null;
      if (gfmPlugin && gfmPlugin.gfm) turndownService.use(gfmPlugin.gfm);
      turndownService.addRule('wordTables', {
        filter: 'table',
        replacement: function (content, node) {
          if (!formatTables) return '\n\n' + content + '\n\n';
          const rows = Array.from(node.querySelectorAll('tr'));
          if (rows.length === 0) return '';
          const grid = rows.map(tr => Array.from(tr.querySelectorAll('th, td'))
            .map(cell => (cell.textContent || '').replace(/[\r\n]+/g, ' ').trim()));
          const maxCols = Math.max(...grid.map(r => r.length), 0);
          if (maxCols === 0) return '';
          const normalized = grid.map(row => {
            const r = [...row];
            while (r.length < maxCols) r.push('');
            return r;
          });
          const header = normalized[0];
          const separator = header.map(() => '---');
          const body = normalized.slice(1);
          let md = '\n\n| ' + header.join(' | ') + ' |\n';
          md += '| ' + separator.join(' | ') + ' |\n';
          body.forEach(r => { md += '| ' + r.join(' | ') + ' |\n'; });
          return md + '\n\n';
        }
      });
      return turndownService.turndown(html);
    }
    return html
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '');
  }

  async convertPdf(file, options = {}, progressCallback = null) {
    const opts = normalizeOptions(options);
    if (progressCallback) progressCallback(5, 'Initializing PDF parser...');
    const initialized = await this.initialize();
    if (!initialized) {
      const reason = this.initError || new Error('PDF engine failed to initialize');
      try {
        return await this.fallbackConversion(file, reason, opts);
      } catch (fallbackError) {
        console.warn('PDF engine init failed and fallback found nothing:', fallbackError);
        throw new Error('PDF_LIB_FAILED');
      }
    }

    let getDocTask = null;
    try {
      if (progressCallback) progressCallback(10, 'Reading PDF file...');
      const arrayBuffer = await this.readFileAsArrayBuffer(file);
      if (progressCallback) progressCallback(20, 'Loading PDF document...');
      try {
        if (this.pdfjsLib && this.pdfjsLib.GlobalWorkerOptions && !this.pdfjsLib.GlobalWorkerOptions.workerSrc) {
          this.pdfjsLib.GlobalWorkerOptions.workerSrc = getWorkerUrl();
        }
      } catch (workerCfgError) {
        console.warn('[TokenTrim] workerSrc setup warning (continuing with fake worker):', workerCfgError);
      }

      // Privacy: no remote cMaps / standard fonts. Local-only parsing.
      getDocTask = this.pdfjsLib.getDocument({
        data: arrayBuffer,
        isEvalSupported: false,
        disableFontFace: true
      });

      const loadPromise = getDocTask.promise;
      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          try { getDocTask.destroy(); } catch { /* ignore */ }
          reject(new Error('PDF_TIMEOUT'));
        }, 120000);
      });
      const pdf = await Promise.race([loadPromise, timeoutPromise]);
      clearTimeout(timeoutId);

      const numPages = pdf.numPages;
      let fullText = '';
      let pageTexts = [];
      let scannedPages = 0;
      let ocrPagesCount = 0;
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const progress = 20 + Math.floor((pageNum / numPages) * 50);
        if (progressCallback) progressCallback(progress, `Extracting page ${pageNum} of ${numPages}...`);
        try {
          const page = await pdf.getPage(pageNum);
          let pageText = await this.extractPageText(page);

          // If OCR is enabled and page has low/no text, attempt local OCR
          if (opts.ocrEnabled && isScannedPage(pageText) && typeof document !== 'undefined') {
            try {
              if (progressCallback) progressCallback(progress, `Running OCR on page ${pageNum} of ${numPages}...`);
              const ocrText = await this.ocrPdfPage(page, opts);
              if (ocrText && ocrText.trim().length > pageText.trim().length) {
                pageText = ocrText.trim();
                ocrPagesCount++;
              }
            } catch (ocrErr) {
              console.warn(`[TokenTrim] OCR on page ${pageNum} skipped:`, ocrErr);
            }
          }

          pageTexts.push(pageText);
          if (isScannedPage(pageText)) scannedPages++;
          fullText += pageText + '\n\n';
          // Free page resources promptly for large docs
          try { if (page.cleanup) page.cleanup(); } catch { /* ignore */ }
        } catch (pageErr) {
          console.warn(`[TokenTrim] Page ${pageNum} text extraction warning:`, pageErr);
          pageTexts.push('');
          scannedPages++;
        }
      }

      console.log(`[TokenTrim] Raw extraction: ${fullText.trim().length} chars from ${numPages} page(s), scanned≈${scannedPages}${ocrPagesCount > 0 ? `, ocr=${ocrPagesCount}` : ''}`);
      if (!fullText || !fullText.trim()) throw new Error('EMPTY_FILE');

      // Custom page selection (e.g. "1-20, 29-31")
      const ranged = applyPageRange(pageTexts, opts.pageRange);
      if (ranged.error) {
        const err = new Error(ranged.error);
        try { err.detail = ranged.errorDetail; } catch { /* ignore */ }
        throw err;
      }
      let workingPages = ranged.texts;
      let workingText = workingPages.join('\n\n');
      if (!workingText.trim()) throw new Error('EMPTY_FILE');

      if (progressCallback) progressCallback(75, 'Processing text & formatting...');
      const pipeline = this.runPipeline(workingText, workingPages, opts, progressCallback, 78, {
        totalPages: numPages,
        rangePages: ranged.pages,
        rangeLabel: ranged.filtered ? formatPages(ranged.pages) : null,
        rangeFiltered: ranged.filtered,
        scannedPages
      });

      if (progressCallback) progressCallback(95, 'Calculating token statistics...');
      const stats = this.calculateStats(file, pipeline.markdown, workingPages.length, workingText, opts.tokenizerModel);

      if (progressCallback) progressCallback(100, 'Conversion complete!');
      try {
        if (getDocTask && typeof getDocTask.destroy === 'function') await getDocTask.destroy().catch(() => {});
      } catch (cleanupError) { console.warn('[TokenTrim] getDocument cleanup warning:', cleanupError); }

      return {
        markdown: pipeline.markdown,
        stats,
        report: { ...pipeline.report, scannedPages, totalPages: numPages, rangeFiltered: ranged.filtered, rangePages: ranged.pages, rangeLabel: ranged.filtered ? formatPages(ranged.pages) : null },
        metadata: { filename: file.name, type: 'pdf', pages: workingPages.length, size: file.size }
      };
    } catch (error) {
      const isExpectedDocState =
        error.message === 'EMPTY_FILE' ||
        error.message === 'PAGE_RANGE_INVALID' ||
        error.message === 'PDF_TIMEOUT' ||
        error.message === 'OCR_REQUIRED' ||
        error.message === 'OCR_FAILED' ||
        (error.message && error.message.includes('password')) ||
        (error.message && (error.message.includes('Invalid PDF') || error.message.includes('CORRUPT')));

      if (isExpectedDocState) {
        console.warn('[TokenTrim] PDF conversion notice:', error.message);
      } else {
        console.error('PDF conversion failed:', error);
      }

      try {
        if (getDocTask && typeof getDocTask.destroy === 'function') await getDocTask.destroy().catch(() => {});
      } catch (cleanupError) { console.warn('[TokenTrim] getDocument error-cleanup warning:', cleanupError); }
      try {
        if (this.pdfjsLib && this.pdfjsLib.GlobalWorkerOptions) this.pdfjsLib.GlobalWorkerOptions.workerPort = null;
      } catch (workerCleanupError) { console.warn('[TokenTrim] worker cleanup warning:', workerCleanupError); }

      if (error.message === 'EMPTY_FILE') throw new Error('EMPTY_FILE');
      if (error.message === 'PDF_TIMEOUT') throw new Error('PDF_TIMEOUT');
      if (error.message === 'OCR_REQUIRED') throw new Error('OCR_REQUIRED');
      // User-input errors must surface directly, never via content fallback.
      if (error.message === 'PAGE_RANGE_INVALID') {
        const rangeErr = new Error('PAGE_RANGE_INVALID');
        try { if (error.detail) rangeErr.detail = error.detail; } catch { /* ignore */ }
        throw rangeErr;
      }
      if (error.message && error.message.includes('password')) throw new Error('PASSWORD_PROTECTED');
      if (error.message && (error.message.includes('Invalid PDF') || error.message.includes('CORRUPT'))) throw new Error('CORRUPT_FILE');

      try {
        return await this.fallbackConversion(file, error, opts);
      } catch (fallbackError) {
        console.warn('[TokenTrim] Fallback extraction unavailable:', fallbackError && fallbackError.message);
        const engineMsg = String((error && error.message) || error || '');
        if (/XRef|trailer|Invalid PDF|MissingPDF|FormatError|corrupt/i.test(engineMsg)) throw new Error('CORRUPT_FILE');
        if (/Worker|worker|dynamically imported module|failed to fetch/i.test(engineMsg)) throw new Error('PDF_LIB_FAILED');
        if (fallbackError.message === 'EMPTY_FILE' || error.message === 'EMPTY_FILE') throw new Error('EMPTY_FILE');
        const honest = new Error('PDF_LIB_FAILED');
        try { honest.cause = error; } catch (ignored) { /* cause unsupported */ }
        throw honest;
      }
    }
  }

  /**
   * Shared pipeline: boilerplate → tables → clean → compress → query → budget
   */
  runPipeline(rawMarkdown, pageTexts, opts, progressCallback, baseProgress = 75, extra = {}) {
    const warnings = [];
    let text = String(rawMarkdown || '');
    let removedLines = 0;
    let tablesOptimized = 0;

    if (opts.stripHeaders) {
      if (progressCallback) progressCallback(baseProgress, 'Removing boilerplate...');
      const before = text.length;
      const r = stripBoilerplate(text, pageTexts, { aggressiveness: opts.boilerplateAggressiveness });
      // Safety net: never let boilerplate removal eat the document. If it
      // removed >80% of characters from substantial input, keep full text.
      if (before > 500 && r.text.length < before * 0.2) {
        warnings.push('Boilerplate filter too aggressive; kept full text.');
      } else {
        text = r.text;
        removedLines = r.removedLines;
      }
    }
    if (opts.formatTables) {
      if (progressCallback) progressCallback(baseProgress + 3, 'Optimizing tables...');
      // PDF path: positioned text first needs text-table detection (pdf.js
      // yields no table structure). DOCX tables arrive via Mammoth already.
      if (opts.detectTextTables !== false) text = detectTextTables(text);
      const r = optimizeMarkdownTables(text, { style: opts.tableStyle });
      text = r.text;
      tablesOptimized = r.stats.tables || 0;
    }
    if (progressCallback) progressCallback(baseProgress + 5, 'Finalizing Markdown structure...');
    text = cleanMarkdown(text, { headingDensity: opts.headingDensity, listMarker: opts.listMarker });

    let querySections = [];
    if (opts.query && opts.query.trim()) {
      if (progressCallback) progressCallback(baseProgress + 7, 'Selecting relevant sections...');
      const sel = bm25Select(text, opts.query, { topK: opts.queryTopK, maxChars: 40000 });
      if (sel.noMatch) {
        warnings.push('No sections matched the query; kept full document.');
      } else if (sel.sections && sel.sections.length) {
        text = sel.text;
        querySections = sel.sections;
        warnings.push(`Query filter kept ${sel.sections.length} section(s).`);
      }
    }

    let truncated = false;
    let removedSentences = 0;
    if (opts.compressionMode && opts.compressionMode !== 'lossless') {
      if (progressCallback) progressCallback(baseProgress + 9, 'Compressing...');
      const c = compressMarkdown(text, {
        mode: opts.compressionMode,
        tokenBudget: opts.tokenBudget,
        tokenizerModel: opts.tokenizerModel,
        docKeep: opts.docKeep
      });
      text = c.text;
      truncated = c.truncated;
      removedSentences = c.removedSentences;
      if (opts.compressionMode !== 'lossless') warnings.push(`Compression mode: ${opts.compressionMode}. Verify key facts before use.`);
    } else if (opts.tokenBudget > 0) {
      const r = TokenizerService.truncateToBudget(text, opts.tokenBudget, opts.tokenizerModel);
      text = r.text;
      truncated = r.truncated;
    }
    if (truncated) warnings.push('Output truncated to fit token budget.');

    if ((extra.scannedPages || 0) > 0) {
      warnings.push(`${extra.scannedPages} page(s) look scanned/low-text. Enable OCR for better results.`);
    }
    if (extra.rangeFiltered) {
      const label = extra.rangeLabel || formatPages(extra.rangePages || []);
      const total = extra.totalPages ? ` of ${extra.totalPages}` : '';
      warnings.push(`Page range ${label} extracted (${(extra.rangePages || []).length}${total} pages).`);
    }

    // Citation handling for local preset: strip bare URLs to save tokens
    if (opts.citationHandling === 'strip') {
      text = text.replace(/https?:\/\/\S+/g, '[link]');
    }

    return {
      markdown: text,
      report: {
        preset: opts.preset,
        tokenizerModel: opts.tokenizerModel,
        compressionMode: opts.compressionMode,
        tokenBudget: opts.tokenBudget,
        removedLines,
        tablesOptimized,
        removedSentences,
        truncated,
        querySections,
        warnings,
        ...(extra || {})
      }
    };
  }

  async readFileAsArrayBuffer(file) {
    if (file && typeof file.arrayBuffer === 'function') {
      try { return await file.arrayBuffer(); }
      catch (e) { console.warn('file.arrayBuffer failed, falling back to FileReader', e); }
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  async renderPageToCanvas(page, scale = 1.5) {
    if (typeof document === 'undefined') return null;
    try {
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      await page.render({ canvasContext: ctx, viewport }).promise;
      return canvas;
    } catch (e) {
      console.warn('[TokenTrim] Page canvas render warning:', e);
      return null;
    }
  }

  async ocrPdfPage(page, opts = {}) {
    if (!ocrAvailable()) return '';
    const canvas = await this.renderPageToCanvas(page, 1.5);
    if (!canvas) return '';
    try {
      return await ocrPageWithTesseract(canvas, { lang: opts.ocrLang || 'eng' });
    } finally {
      try {
        canvas.width = 0;
        canvas.height = 0;
      } catch { /* ignore */ }
    }
  }

  async extractPageText(page) {
    if (!page || typeof page.getTextContent !== 'function') return '';
    const textContent = await page.getTextContent();
    if (!textContent || !Array.isArray(textContent.items)) return '';
    let pageText = '';
    let lastY = null;
    let lastX = null;
    textContent.items.forEach((item) => {
      // PDF.js text items may be TextMarkedContent without transform or str
      if (!item || !Array.isArray(item.transform) || item.transform.length < 6 || typeof item.str !== 'string') return;
      const currentY = item.transform[5];
      const currentX = item.transform[4];
      if (lastY !== null && Math.abs(lastY - currentY) > 5) {
        if (!pageText.endsWith('\n')) pageText += '\n';
      } else if (lastX !== null && lastY !== null) {
        const horizontalGap = currentX - lastX;
        if (horizontalGap > 20) pageText += '  ';
        else if (horizontalGap > 10) pageText += ' ';
      }
      // pdf.js synthesizes a single space item spanning wide column gaps.
      // Expand it to a 2-space run so detectTextTables can recover columns.
      let str = item.str;
      const fontSize = Math.abs(item.transform[0]) || 12;
      if (/^\s+$/.test(str) && (item.width || 0) > fontSize * 3) str = '  ';
      pageText += str;
      if (item.hasEOL && !pageText.endsWith('\n')) pageText += '\n';
      lastY = currentY;
      lastX = currentX + (item.width || 0);
    });
    return pageText.trim();
  }

  // ---- Backward-compatible wrappers (delegating to new modules) ----
  stripHeaders(text, pageTexts = []) {
    return stripBoilerplate(text, pageTexts, { aggressiveness: 'standard' }).text;
  }

  formatTables(text) {
    return optimizeMarkdownTables(detectTextTables(text), { style: 'markdown' }).text;
  }

  convertToMarkdownTable(rows) {
    if (rows.length < 2) return rows.map(r => r.join(' | ')).join('\n');
    const header = rows[0];
    const separator = header.map(() => '---');
    const body = rows.slice(1);
    let table = '| ' + header.join(' | ') + ' |\n';
    table += '| ' + separator.join(' | ') + ' |\n';
    body.forEach(row => { table += '| ' + row.join(' | ') + ' |\n'; });
    return table;
  }

  cleanupMarkdown(text) {
    // No branding footer. Privacy-preserving, token-minimal.
    return cleanMarkdown(text, { headingDensity: 'full' });
  }

  calculateStats(file, markdown, pages = 1, rawText = null, model = 'claude', meta = {}) {
    const isImage = file?.type?.startsWith('image/') || meta.sourceType === 'image' || /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(file?.name || '');
    let ledger;
    if (isImage) {
      const imgTokens = TokenizerService.estimateImageTokens(meta.dims, model);
      ledger = TokenizerService.imageLedger(imgTokens, markdown, model);
    } else {
      const raw = rawText != null ? rawText : String(markdown || '');
      ledger = TokenizerService.ledger(raw, markdown, model);
    }
    let markdownSize = 0;
    try { markdownSize = new Blob([markdown]).size; }
    catch { markdownSize = (markdown || '').length; }
    return {
      ...ledger,
      pages,
      originalSize: file ? file.size : 0,
      markdownSize
    };
  }

  async fallbackConversion(file, engineError = null, options = {}) {
    const opts = normalizeOptions(options);
    const filename = (file.name || 'document').replace(/\.(pdf|docx)$/i, '');
    let extractedText = '';
    try {
      const buffer = await this.readFileAsArrayBuffer(file);
      const uint8 = new Uint8Array(buffer);
      const raw = new TextDecoder('latin1').decode(uint8);
      extractedText = this.extractPdfLiteralStrings(raw);
    } catch (e) { console.warn('Fallback stream text extraction error:', e); }

    const cleaned = (extractedText || '').replace(/\s+/g, ' ').trim();
    const words = (cleaned.match(/[A-Za-z]{2,}/g) || []).map(w => w.toLowerCase());
    const uniqueWords = new Set(words);
    if (!cleaned || cleaned.length < 50 || words.length < 8 || uniqueWords.size < 8) {
      throw new Error('EMPTY_FILE');
    }
    let markdown = `# ${filename}\n\n${extractedText}\n\n`;
    const pipeline = this.runPipeline(markdown, [], { ...opts, compressionMode: 'lossless' }, null);
    const stats = this.calculateStats(file, pipeline.markdown, 1, markdown, opts.tokenizerModel);
    return {
      markdown: pipeline.markdown,
      stats,
      report: { ...pipeline.report, fallback: true },
      metadata: { filename: file.name, pages: 1, size: file.size },
      fallback: true,
      engineError: engineError ? String(engineError.message || engineError).slice(0, 160) : null
    };
  }

  extractPdfLiteralStrings(raw) {
    const pdfSyntax = /(endobj|endstream|startxref|\/Type|\/Length|\/BBox|\/ProcSet|\/XObject|\/Font|\/Pages?|\/Contents|<<|>>|\b\d+ 0 R\b|\/Filter|\/Subtype)/;
    const pieces = [];
    const stringRegex = /\((?:\\.|[^()\\])*\)/g;
    let m;
    while ((m = stringRegex.exec(raw)) !== null) {
      if (pieces.join(' ').length > 100000) break;
      let s = m[0].slice(1, -1);
      s = s.replace(/\\([nrtbf()\\])/g, (_, c) => {
        return { n: '\n', r: '\n', t: ' ', b: '', f: '', '(': '(', ')': ')', '\\': '\\' }[c] ?? '';
      }).replace(/\\([0-7]{1,3})/g, (_, oct) => {
        const code = parseInt(oct, 8);
        return code >= 32 && code < 127 ? String.fromCharCode(code) : '';
      });
      s = s.trim();
      if (!s || s.length < 2 || s.length > 300) continue;
      if (!/[A-Za-z]{2,}/.test(s)) continue;
      const printable = (s.match(/[ -~\t\n]/g) || []).length;
      if (printable / s.length < 0.85) continue;
      if (pdfSyntax.test(s)) continue;
      pieces.push(s.replace(/\s+/g, ' '));
    }
    return pieces.join(' ');
  }
}

export const PDFConverter = DocumentConverter;
export const converter = new DocumentConverter();
