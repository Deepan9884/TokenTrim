/**
 * TokenTrim - CompressionEngine
 * Modes: lossless | extractive | aggressive
 * Lossless: cleanup only. Extractive: keep high-value sentences.
 * Aggressive: summary + key excerpts + tables.
 */

import { TokenizerService } from './tokenizer.js';

const KEEP_PATTERNS = [
  /abstract/i, /conclusion/i, /result/i, /method/i, /definition/i,
  /obligation/i, /liabilit/i, /terminat/i, /revenue/i, /margin/i,
  /forecast/i, /risk/i, /api/i, /error/i, /config/i, /example/i,
  /theorem/i, /proof/i, /table/i, /figure/i, /reference/i, /total/i
];

const DROP_PATTERNS = [
  /^\s*(acknowledg(e)?ments?)\b/i,
  /^\s*table of contents\b/i,
  /^\s*list of (figures|tables)\b/i
];

function splitSentences(text) {
  return String(text || '')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9#\-*|`>])|\n{2,}/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function scoreSentence(s, docPresetKeep = []) {
  let score = 0;
  const lower = s.toLowerCase();
  if (s.length > 40 && s.length < 400) score += 1;
  if (/\d/.test(s)) score += 2; // numbers/evidence
  if (/^#{1,3}\s/.test(s)) score += 4; // headings
  if (/^\|.*\|$/.test(s)) score += 3; // tables
  if (/^[-*]\s/.test(s) || /^\d+\.\s/.test(s)) score += 1;
  if (/conclu|therefore|in summary|key finding|main result/i.test(s)) score += 3;
  for (const p of KEEP_PATTERNS) if (p.test(s)) score += 2;
  for (const k of docPresetKeep) if (k && lower.includes(String(k).toLowerCase())) score += 2;
  for (const p of DROP_PATTERNS) if (p.test(s)) score -= 5;
  if (s.length < 20) score -= 1;
  return score;
}

export function compressMarkdown(markdown, options = {}) {
  const {
    mode = 'extractive',
    tokenBudget = 0,
    tokenizerModel = 'claude',
    docPreset = 'general',
    docKeep = []
  } = options;

  const original = String(markdown || '');
  if (mode === 'lossless') {
    let text = original;
    if (tokenBudget > 0) {
      const r = TokenizerService.truncateToBudget(text, tokenBudget, tokenizerModel);
      return { text: r.text, mode, truncated: r.truncated, removedSentences: 0 };
    }
    return { text, mode, truncated: false, removedSentences: 0 };
  }

  const sentences = splitSentences(original);
  const scored = sentences.map((s, i) => ({ s, i, score: scoreSentence(s, docKeep) }));
  scored.sort((a, b) => b.score - a.score || a.i - b.i);

  // Target: aggressive keeps ~25%, extractive ~60% (before budget)
  const ratio = mode === 'aggressive' ? 0.25 : 0.6;
  let keepCount = Math.max(3, Math.ceil(sentences.length * ratio));
  let kept = scored.slice(0, keepCount).sort((a, b) => a.i - b.i).map(x => x.s);
  let text = kept.join('\n\n');

  // Preserve tables fully in extractive mode when possible
  if (mode === 'extractive') {
    const tables = original.match(/(^\|.*\|\s*$\n?)+/gm) || [];
    for (const tb of tables.slice(0, 10)) {
      if (!text.includes(tb.trim().slice(0, 40))) text += '\n\n' + tb.trim();
    }
  }

  if (mode === 'aggressive') {
    const headings = (original.match(/^#{1,3}\s+.+$/gm) || []).slice(0, 20);
    const header = headings.length ? '# Key outline\n\n' + headings.join('\n') + '\n\n' : '';
    text = header + text;
  }

  let truncated = false;
  if (tokenBudget > 0) {
    // Greedily drop lowest-scored kept sentences until budget fits
    let current = kept;
    const assemble = (arr) => arr.slice().sort((a, b) => a.i - b.i).map(x => (typeof x === 'string' ? x : x.s)).join('\n\n');
    // current is array of strings; map back to scored for dropping
    let scoredKept = scored.slice(0, keepCount);
    while (scoredKept.length > 3 && !TokenizerService.fitsInBudget(assemble(scoredKept), tokenBudget, tokenizerModel)) {
      scoredKept = scoredKept.slice(0, -1);
      truncated = true;
    }
    text = assemble(scoredKept);
    if (!TokenizerService.fitsInBudget(text, tokenBudget, tokenizerModel)) {
      const r = TokenizerService.truncateToBudget(text, tokenBudget, tokenizerModel);
      text = r.text;
      truncated = true;
    }
  }

  void docPreset;
  return { text: text + '\n', mode, truncated, removedSentences: sentences.length - keepCount };
}

export default { compressMarkdown };
