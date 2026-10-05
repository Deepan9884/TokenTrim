/**
 * TokenTrim - TokenizerService
 * Local, privacy-preserving token estimation per target model.
 * No network calls. Deterministic heuristic calibrated to approximate:
 * - Claude (Anthropic): ~3.8 chars/token prose, worse on code/CJK
 * - ChatGPT (OpenAI tiktoken-ish): ~4.0 chars/token prose
 * - Gemini: ~4.0 chars/token prose
 * - Local (Llama/Mistral/Qwen): ~3.5 chars/token prose
 * Adjusts for whitespace, code, CJK, and markdown syntax weight.
 */

export const MODELS = {
  claude: { id: 'claude', label: 'Claude', contextWindow: 200000, charsPerToken: 3.8 },
  chatgpt: { id: 'chatgpt', label: 'ChatGPT', contextWindow: 128000, charsPerToken: 4.0 },
  gemini: { id: 'gemini', label: 'Gemini', contextWindow: 1000000, charsPerToken: 4.0 },
  local: { id: 'local', label: 'Local / Open LLM', contextWindow: 32768, charsPerToken: 3.5 }
};

function baseCount(text, charsPerToken) {
  if (!text) return 0;
  const len = text.length;
  if (len === 0) return 0;

  // Count CJK characters (each ~1 token)
  const cjk = (text.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g) || []).length;
  // Count code-ish sequences (long alnum/underscore runs, URLs, base64-ish)
  const codeRuns = (text.match(/[A-Za-z0-9_]{16,}|https?:\/\/\S+|[A-Za-z0-9+/=]{40,}/g) || [])
    .reduce((a, s) => a + s.length, 0);
  // Markdown syntax weight: pipes, hashes, asterisks add slight overhead
  const syntax = (text.match(/[|#*_`\[\]()\-]{1}/g) || []).length;

  const asciiProse = Math.max(0, len - cjk - codeRuns);
  let tokens = asciiProse / charsPerToken;
  tokens += cjk * 1.0; // CJK ~1 token/char
  tokens += codeRuns / 2.5; // code denser
  tokens += syntax * 0.15; // small syntax overhead

  return Math.max(1, Math.ceil(tokens));
}

export const TokenizerService = {
  models: MODELS,

  modelIds() {
    return Object.keys(MODELS);
  },

  normalizeModel(model) {
    if (model && MODELS[model]) return model;
    return 'claude';
  },

  getContextWindow(model) {
    const m = MODELS[this.normalizeModel(model)];
    return m.contextWindow;
  },

  count(text, model = 'claude') {
    const m = MODELS[this.normalizeModel(model)];
    return baseCount(text || '', m.charsPerToken);
  },

  countAll(text) {
    const out = {};
    for (const id of Object.keys(MODELS)) out[id] = this.count(text, id);
    return out;
  },

  ledger(rawText, optimizedText, model = 'claude') {
    const originalTokens = this.count(rawText, model);
    const optimizedTokens = this.count(optimizedText, model);
    const savedTokens = originalTokens - optimizedTokens;
    const savingsPercent = originalTokens > 0
      ? Math.round((savedTokens / originalTokens) * 100)
      : 0;
    return { model: this.normalizeModel(model), originalTokens, optimizedTokens, savedTokens, savingsPercent };
  },

  /**
   * Estimate token cost of an image if passed directly to vision-capable LLMs.
   * - Claude (Anthropic): ~(w * h) / 750, standard ~1,600 tokens
   * - ChatGPT (OpenAI): 85 base + 170 per 512x512 tile (~765-1105 tokens)
   * - Gemini: ~258 tokens per tile
   */
  estimateImageTokens(dims = {}, model = 'claude') {
    const w = Number(dims?.width) || 0;
    const h = Number(dims?.height) || 0;
    const m = this.normalizeModel(model);
    if (!w || !h) {
      return m === 'chatgpt' ? 765 : (m === 'gemini' ? 258 : 1600);
    }
    if (m === 'chatgpt') {
      const tilesX = Math.max(1, Math.ceil(w / 512));
      const tilesY = Math.max(1, Math.ceil(h / 512));
      return Math.min(1600, 85 + (tilesX * tilesY * 170));
    } else if (m === 'gemini') {
      const tiles = Math.max(1, Math.ceil((w * h) / (768 * 768)));
      return tiles * 258;
    } else {
      const raw = Math.round((w * h) / 750);
      return Math.min(1600, Math.max(400, raw));
    }
  },

  imageLedger(imageTokens, optimizedText, model = 'claude') {
    const originalTokens = Math.max(1, typeof imageTokens === 'number' ? imageTokens : 1600);
    const optimizedTokens = this.count(optimizedText, model);
    const savedTokens = Math.max(0, originalTokens - optimizedTokens);
    const savingsPercent = originalTokens > 0
      ? Math.max(0, Math.min(99, Math.round((savedTokens / originalTokens) * 100)))
      : 0;
    return { model: this.normalizeModel(model), originalTokens, optimizedTokens, savedTokens, savingsPercent };
  },

  fitsInBudget(text, budget, model = 'claude') {
    if (!budget || budget <= 0) return true;
    return this.count(text, model) <= budget;
  },

  /**
   * Sentence-aware truncation to fit a token budget.
   * Keeps head + tail (conclusions/references) when possible.
   */
  truncateToBudget(text, budget, model = 'claude') {
    if (!budget || budget <= 0) return { text, truncated: false };
    if (this.fitsInBudget(text, budget, model)) return { text, truncated: false };
    const sentences = String(text || '').split(/(?<=[.!?])\s+(?=[A-Z0-9#\-*|])/);
    if (sentences.length <= 2) {
      // Hard char cut as last resort
      const m = MODELS[this.normalizeModel(model)];
      const maxChars = Math.floor(budget * m.charsPerToken);
      return { text: text.slice(0, Math.max(0, maxChars)) + '\n\n> [truncated to fit token budget]', truncated: true };
    }
    // Keep first 60% and last 40% of sentences greedily
    let head = [];
    let tail = [];
    let i = 0;
    let j = sentences.length - 1;
    let takeHead = true;
    let current = '';
    const fits = (t) => this.count(t, model) <= budget - 20;
    while (i <= j) {
      const candidate = takeHead
        ? [...head, sentences[i], ...tail.slice().reverse()].join(' ')
        : [...head, ...tail.slice().reverse(), sentences[j]].join(' ');
      // rebuild properly below; simple approach: try adding
      const next = takeHead ? [...head, sentences[i]] : [sentences[j], ...tail];
      const assembled = takeHead
        ? [...next, ...tail.slice().reverse()].join(' ')
        : [...head, ...next].join(' ');
      if (!fits(assembled)) break;
      if (takeHead) { head = next; i++; } else { tail = next; j--; }
      current = assembled;
      takeHead = !takeHead;
    }
    if (!current) {
      const m = MODELS[this.normalizeModel(model)];
      const maxChars = Math.floor(budget * m.charsPerToken);
      current = text.slice(0, Math.max(0, maxChars));
    }
    return { text: current + '\n\n> [truncated to fit token budget]', truncated: true };
  }
};

export default TokenizerService;
