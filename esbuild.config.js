/**
 * TokenTrim - esbuild Configuration
 * Bundles popup.js + converter.js for Chrome Extension
 * Externalizes pdf.js (loaded globally), mammoth, turndown (loaded via script tags)
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
  // Clean dist first so the separate admin web app (admin/, .next/) can
  // never persist inside the extension package via a stale dist/.
  rmSync(outdir, { recursive: true, force: true });
  mkdirSync(outdir, { recursive: true });

  // Build popup.js (entry point)
  // NOTE: lib/pdf.js (pdf.js v4 ESM) is statically imported by
  // lib/pdfjs-wrapper.js and bundled here on purpose — MV3 browsers may
  // refuse runtime fetch/import of a separate chrome-extension:// module
  // ("Failed to fetch dynamically imported module"), so the engine must
  // live inside the bundle. Top-level await in pdf.js requires Chrome 89+,
  // hence the modern target (MV3 itself needs Chrome 88+ anyway).
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
      // These are loaded via script tags in popup.html
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

  // Copy static assets
  copyStaticAssets();

  console.log(`[esbuild] Build ${isWatch ? '(watch) ' : ''}complete → dist/`);
}

function copyStaticAssets() {
  const assets = [
    'popup.html',
    'popup.css',
    'sidepanel.html',
    'background.js',
    'content.js',
    'manifest.json',
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

  // Copy lib folder (pdf.js, pdf.worker.js, mammoth, turndown, etc.)
  const libSrc = join(__dirname, 'lib');
  const libDest = join(outdir, 'lib');
  if (existsSync(libSrc)) {
    cpSync(libSrc, libDest, { recursive: true });
  }

  // Copy icons folder
  const iconsSrc = join(__dirname, 'icons');
  const iconsDest = join(outdir, 'icons');
  if (existsSync(iconsSrc)) {
    cpSync(iconsSrc, iconsDest, { recursive: true });
  }
}

// Run build
buildExtension().catch(() => process.exit(1));

// Watch mode
if (isWatch) {
  console.log('[esbuild] Watching for changes...');
}