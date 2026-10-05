/**
 * TokenTrim - MarkdownCleaner
 * Normalizes markdown without adding branding footers.
 */

export function cleanMarkdown(text, options = {}) {
  const { headingDensity = 'full', listMarker = '-' } = options;
  let t = String(text || '');
  t = t.replace(/\r\n?/g, '\n');
  t = t.replace(/[ \t]+\n/g, '\n');
  t = t.replace(/\n{4,}/g, '\n\n\n');
  t = t.trim();
  // Sentence break -> paragraph break
  t = t.replace(/([.!?])\n([A-Z0-9])/g, '$1\n\n$2');
  // Normalize list markers to preferred
  if (listMarker === '-') {
    t = t.replace(/^\s*[•–—]\s+/gm, '- ');
    t = t.replace(/^(\s*)\*\s+(?=\S)/gm, '$1- ');
  }
  // Heading density: compact demotes H4+ to bold
  if (headingDensity === 'compact') {
    t = t.replace(/^####\s+(.+)$/gm, '**$1**');
    t = t.replace(/^#####\s+(.+)$/gm, '**$1**');
    t = t.replace(/^######\s+(.+)$/gm, '**$1**');
  }
  // Collapse 3+ blank-adjacent spacing around tables
  t = t.replace(/\n{3,}(\|)/g, '\n\n$1');
  return t.trim() + '\n';
}

export default { cleanMarkdown };
