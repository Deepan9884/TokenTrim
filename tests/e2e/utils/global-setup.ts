/**
 * Global setup: fail fast with a helpful message when dist/ or fixtures
 * are missing instead of producing confusing browser errors.
 */
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const e2eDir = dirname(fileURLToPath(import.meta.url));
const root = join(e2eDir, '..', '..', '..');

async function globalSetup() {
  const missing: string[] = [];
  if (!existsSync(join(root, 'dist', 'manifest.json'))) {
    missing.push('dist/manifest.json — run `npm run build` first');
  }
  const fixtures = [
    'simple.pdf', 'simple.docx', 'table.pdf', 'headers.pdf',
    'large.pdf', 'xlarge.pdf', 'research.pdf', 'contract.pdf',
    'scanned.pdf', 'corrupt.pdf', 'empty.pdf', 'password.pdf'
  ];
  for (const f of fixtures) {
    if (!existsSync(join(e2eDir, '..', 'fixtures', f))) missing.push(`tests/e2e/fixtures/${f} — run \`npm run e2e:fixtures\``);
  }
  if (missing.length) {
    throw new Error('E2E prerequisites missing:\n - ' + missing.join('\n - '));
  }
  console.log('[e2e] prerequisites OK (dist + 10 fixtures)');
}

export default globalSetup;
