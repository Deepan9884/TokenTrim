import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function exportIcons() {
  const svgPath = path.resolve(__dirname, '../icons/logo.svg');
  const svgContent = fs.readFileSync(svgPath, 'utf-8');

  const outDir = path.resolve(__dirname, '../icons');
  const sizes = [16, 32, 48, 128, 256, 512];

  console.log('Launching browser to render crisp PNG icons...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  for (const size of sizes) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { width: ${size}px; height: ${size}px; overflow: hidden; background: transparent; }
          svg { width: 100%; height: 100%; display: block; }
        </style>
      </head>
      <body>
        ${svgContent}
      </body>
      </html>
    `;

    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.setContent(html);

    const outPath = path.join(outDir, `icon${size}.png`);
    await page.screenshot({
      path: outPath,
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size }
    });
    console.log(`Generated: ${outPath} (${size}x${size})`);
  }

  await browser.close();
  console.log('All icons exported successfully!');
}

exportIcons().catch(err => {
  console.error('Export error:', err);
  process.exit(1);
});
