import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

function addDirectoryToZip(zip, dirPath, rootPath) {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      addDirectoryToZip(zip, fullPath, rootPath);
    } else {
      // CRITICAL: Ensure forward slashes '/' in ZIP paths for Chrome / Brave / Web Store compatibility
      const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, '/');
      const fileData = fs.readFileSync(fullPath);
      zip.file(relativePath, fileData);
    }
  }
}

async function createZips() {
  if (!fs.existsSync(distDir)) {
    console.error('dist/ directory does not exist. Run npm run build first.');
    process.exit(1);
  }

  const manifestPath = path.join(distDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const version = manifest.version || '1.2.0';

  console.log(`Packaging TokenTrim v${version} with standards-compliant forward slashes...`);

  const zip = new JSZip();
  addDirectoryToZip(zip, distDir, distDir);

  const content = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  const versionedZip = path.join(rootDir, `TokenTrim-${version}.zip`);
  const extensionZip = path.join(rootDir, 'TokenTrim-Extension.zip');

  fs.writeFileSync(versionedZip, content);
  fs.writeFileSync(extensionZip, content);

  const sizeMB = (content.length / (1024 * 1024)).toFixed(2);
  console.log(`[OK] Created ${path.basename(versionedZip)} (${sizeMB} MB)`);
  console.log(`[OK] Created ${path.basename(extensionZip)} (${sizeMB} MB)`);
}

createZips().catch(err => {
  console.error('Failed to create zip:', err);
  process.exit(1);
});
