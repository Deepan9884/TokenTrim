/**
 * TokenTrim - esbuild Configuration (Extension package)
 * Bundles popup.js + converter.js for Chrome Extension
 * Externalizes pdf.js, mammoth, turndown
 */

import { build } from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, cpSync, rmSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = join(fileURLToPath(import.meta.url), '..');
const isWatch = process.argv.includes('--watch');
const isDev = process.argv.includes('--dev') || isWatch;

const outdir = join(__dirname, 'dist');

async function buildExtension() {
  rmSync(outdir, { recursive: true, force: true });
  mkdirSync(outdir, { recursive: true });

  await build({
    entryPoints: [join(__dirname, 'popup.js'), join(__dirname, 'sidepanel.js')],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    target: 'chrome110',
    outdir: join(outdir),
    sourcemap: true,
    minify: !isDev,
    minifyIdentifiers: false,
    keepNames: true,
    external: [
      'mammoth',
      'turndown',
      'turndown-plugin-gfm'
    ],
    define: {
      'process.env.NODE_ENV': isDev ? '"development"' : '"production"'
    },
    loader: {
      '.js': 'js'
    },
    banner: {
      js: '// TokenTrim - Bundled with esbuild\n'
    }
  });

  copyStaticAssets();

  console.log(`[esbuild] Extension build ${isWatch ? '(watch) ' : ''}complete → extension/dist/`);
}

function copyStaticAssets() {
  const assets = [
    'popup.html',
    'popup.css',
    'sidepanel.html',
    'background.js',
    'content.js',
    'manifest.json',
    'icons-sprite.svg',
    'LICENSE',
    'PRIVACY.md',
    'STORE_LISTING.md'
  ];

  for (const asset of assets) {
    const src = join(__dirname, asset);
    const dest = join(outdir, asset);
    if (existsSync(src)) {
      copyFileSync(src, dest);
    }
  }

  const libSrc = join(__dirname, 'lib');
  const libDest = join(outdir, 'lib');
  if (existsSync(libSrc)) {
    cpSync(libSrc, libDest, { recursive: true });
  }

  const iconsSrc = join(__dirname, 'icons');
  const iconsDest = join(outdir, 'icons');
  if (existsSync(iconsSrc)) {
    cpSync(iconsSrc, iconsDest, { recursive: true });
  }
}

buildExtension().catch(() => process.exit(1));

if (isWatch) {
  console.log('[esbuild] Watching extension files for changes...');
}
