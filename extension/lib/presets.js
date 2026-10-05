/**
 * TokenTrim - PresetEngine
 * Functional model presets: each preset controls tokenization target,
 * heading density, table style, citation handling, and compactness.
 */

export const PRESETS = {
  claude: {
    id: 'claude',
    label: 'Claude (Anthropic)',
    description: 'Formats headers, compact tables, and token-saving layout tailored for Claude 3.5 & Claude 4.',
    tokenizerModel: 'claude',
    headingDensity: 'full',
    tableStyle: 'markdown',
    citationHandling: 'keep',
    codeStyle: 'fenced',
    defaultBudget: 8000,
    boilerplateAggressiveness: 'standard',
    listMarker: '-'
  },
  chatgpt: {
    id: 'chatgpt',
    label: 'ChatGPT (OpenAI)',
    description: 'Clean Markdown with concise tables and standard fenced code blocks for GPT-4o / GPT-4.',
    tokenizerModel: 'chatgpt',
    headingDensity: 'full',
    tableStyle: 'markdown',
    citationHandling: 'keep',
    codeStyle: 'fenced',
    defaultBudget: 8000,
    boilerplateAggressiveness: 'standard',
    listMarker: '-'
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini (Google)',
    description: 'Preserves semantic hierarchy, bullet indentation, and token compactness for Gemini 1.5/2.x.',
    tokenizerModel: 'gemini',
    headingDensity: 'compact',
    tableStyle: 'compact',
    citationHandling: 'compact',
    codeStyle: 'fenced',
    defaultBudget: 16000,
    boilerplateAggressiveness: 'aggressive',
    listMarker: '-'
  },
  local: {
    id: 'local',
    label: 'Local / Open LLM',
    description: 'Minimalist CommonMark with zero fluff for Llama 3, Mistral, Qwen, and local Ollama models.',
    tokenizerModel: 'local',
    headingDensity: 'compact',
    tableStyle: 'csv',
    citationHandling: 'strip',
    codeStyle: 'fenced',
    defaultBudget: 4000,
    boilerplateAggressiveness: 'aggressive',
    listMarker: '-'
  }
};

export const DOCUMENT_PRESETS = {
  research: { id: 'research', label: 'Research paper', keep: ['abstract', 'method', 'result', 'conclusion', 'reference', 'table'] },
  legal: { id: 'legal', label: 'Legal / contract', keep: ['definition', 'obligation', 'liabilit', 'terminat', 'date', 'clause'] },
  finance: { id: 'finance', label: 'Financial report', keep: ['revenue', 'margin', 'forecast', 'risk', 'table', 'total'] },
  technical: { id: 'technical', label: 'Technical docs', keep: ['api', 'example', 'config', 'error', 'install', 'usage'] },
  presentation: { id: 'presentation', label: 'Presentation', keep: ['agenda', 'summary', 'conclusion', 'action', 'next step', 'takeaway', 'table'] },
  spreadsheet: { id: 'spreadsheet', label: 'Spreadsheet / data', keep: ['total', 'summary', 'revenue', 'cost', 'table'] },
  general: { id: 'general', label: 'General', keep: [] }
};

export function getPreset(key) {
  return PRESETS[key] || PRESETS.claude;
}

export function presetIds() {
  return Object.keys(PRESETS);
}

export function applyPresetToOptions(presetKey, baseOptions = {}) {
  const p = getPreset(presetKey);
  return {
    ...baseOptions,
    preset: p.id,
    tokenizerModel: p.tokenizerModel,
    headingDensity: p.headingDensity,
    tableStyle: p.tableStyle,
    citationHandling: p.citationHandling,
    codeStyle: p.codeStyle,
    tokenBudget: baseOptions.tokenBudget ?? p.defaultBudget,
    boilerplateAggressiveness: p.boilerplateAggressiveness
  };
}

export default { PRESETS, DOCUMENT_PRESETS, getPreset, presetIds, applyPresetToOptions };
