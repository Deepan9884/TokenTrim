/**
 * TokenTrim - Converter adapter registry.
 * Every format implements: validate + convert → { markdown, rawText, units, meta }.
 * converter.js stays the orchestrator (pipeline, stats, report).
 */

import { detectSourceType } from './source-types.js';

export function adapterFor(file) {
  return detectSourceType(file);
}

export { detectSourceType };
export default { adapterFor };
