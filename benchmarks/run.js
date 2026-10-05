/**
 * TokenTrim quality benchmark runner (no browser required).
 * Gates:
 *  - lossless pipeline preserves >=95% facts (fidelity)
 *  - extractive respects budget (efficiency, lossy by design with warning)
 *  - no branding footer, 100% fixture success
 */
import { stripBoilerplate } from '../lib/boilerplate-remover.js';
import { optimizeMarkdownTables } from '../lib/table-optimizer.js';
import { cleanMarkdown } from '../lib/markdown-cleaner.js';
import { compressMarkdown } from '../lib/compression-engine.js';
import { TokenizerService } from '../lib/tokenizer.js';

const FIXTURES = [
  {
    name: 'research-paper',
    raw: ['Conference Header 2024', 'Abstract', 'Revenue grew 12% to $4.2M.', 'Method: surveyed 500 users.', 'Results: margin 31%.', 'Conclusion: growth continues.', 'Page 1', 'Conference Header 2024', 'References: Smith 2023.', 'Page 2'].join('\n'),
    pages: ['Conference Header 2024\nAbstract\nPage 1', 'Conference Header 2024\nResults\nPage 2'],
    facts: ['$4.2M', '31%', '500 users', 'Smith 2023']
  },
  {
    name: 'financial-table',
    raw: ['| Q | Revenue | Cost |', '| --- | --- | --- |', '| Q1 | 10 | 6 |', '| Q | Revenue | Cost |', '| Q2 | 12 | 7 |'].join('\n'),
    pages: [],
    facts: ['Q1', 'Q2', 'Revenue']
  },
  {
    name: 'contract',
    raw: ['CONFIDENTIAL', 'Payment: Net 30.', 'Termination: 30 days notice.', 'Liability capped at fees paid.', 'CONFIDENTIAL'].join('\n'),
    pages: ['CONFIDENTIAL\nPayment', 'CONFIDENTIAL\nTermination'],
    facts: ['Net 30', '30 days', 'Liability']
  }
];

function pipeline(raw, pages, mode) {
  const s1 = stripBoilerplate(raw, pages, { aggressiveness: 'standard' }).text;
  const s2 = optimizeMarkdownTables(s1, { style: 'markdown' }).text;
  const s3 = cleanMarkdown(s2, {});
  return compressMarkdown(s3, { mode, tokenBudget: 0, tokenizerModel: 'claude' }).text;
}

let failed = 0;
let totalFacts = 0;
let keptFacts = 0;

for (const fx of FIXTURES) {
  try {
    // Fidelity gate: LOSSLESS must preserve facts
    const text = pipeline(fx.raw, fx.pages, 'lossless');
    const toks = TokenizerService.count(text, 'claude');
    let kept = 0;
    for (const f of fx.facts) {
      totalFacts++;
      if (text.includes(f)) { kept++; keptFacts++; }
    }
    const recall = fx.facts.length ? Math.round((kept / fx.facts.length) * 100) : 100;
    console.log(`[benchmark] ${fx.name}: tokens=${toks} lossless-recall=${recall}%`);
    if (recall < 95) { console.error(`[benchmark] FAIL ${fx.name}: lossless recall below 95%`); failed++; }
    if (text.includes('Converted by TokenTrim')) { console.error(`[benchmark] FAIL ${fx.name}: branding footer present`); failed++; }
    // Efficiency check: extractive with tight budget must fit (lossy allowed, warned in UI)
    const big = pipeline(fx.raw + '\n' + 'Filler sentence with number 12345. '.repeat(60), fx.pages, 'extractive');
    const { text: budgeted } = compressMarkdown(big, { mode: 'extractive', tokenBudget: 300, tokenizerModel: 'claude' });
    if (TokenizerService.count(budgeted, 'claude') > 360) { console.error(`[benchmark] FAIL ${fx.name}: budget not enforced`); failed++; }
  } catch (e) {
    console.error(`[benchmark] FAIL ${fx.name}: ${e.message}`);
    failed++;
  }
}

const overall = totalFacts ? Math.round((keptFacts / totalFacts) * 100) : 100;
console.log(`[benchmark] overall lossless recall: ${overall}% (${keptFacts}/${totalFacts})`);
if (overall < 95) { console.error('[benchmark] FAIL: overall recall below 95%'); failed++; }

if (failed > 0) { console.error(`[benchmark] ${failed} failure(s)`); process.exit(1); }
console.log('[benchmark] PASS');
