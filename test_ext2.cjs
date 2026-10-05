const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
  const extensionPath = path.resolve('./dist');
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  const page = await browser.newPage();
  
  await new Promise(r => setTimeout(r, 2000));
  
  const targets = await browser.targets();
  const extTarget = targets.find(t => t.url().startsWith('chrome-extension://'));
  
  let extensionId;
  if (extTarget) {
    extensionId = new URL(extTarget.url()).hostname;
  } else {
    const swTarget = targets.find(t => t.type() === 'service_worker');
    if (swTarget) {
      extensionId = new URL(swTarget.url()).hostname;
    }
  }

  if (!extensionId) {
    console.error('Could not find extension ID');
    await browser.close();
    return;
  }

  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  page.on('console', msg => console.log('POPUP LOG:', msg.text()));
  page.on('pageerror', err => console.log('POPUP ERROR:', err.toString()));

  await new Promise(r => setTimeout(r, 1000));

  // Write a dummy PDF that is > 0 bytes
  const dummyPdfPath = path.resolve('dummy2.pdf');
  fs.writeFileSync(dummyPdfPath, '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n5 0 obj\n<< /Length 44 >>\nstream\nBT\n/F1 24 Tf\n100 100 Td\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000224 00000 n \n0000000312 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n407\n%%EOF');

  const fileInput = await page.$('#fileInput');
  await fileInput.uploadFile(dummyPdfPath);
  
  await new Promise(r => setTimeout(r, 2000));
  
  try {
    const convertBtn = await page.$('#convertBtn');
    if (convertBtn) {
      await convertBtn.click();
      console.log('Clicked convert');
    } else {
      console.log('No convert button found');
    }
  } catch (e) {
    console.error('Click error:', e.message);
  }

  // Wait 10 seconds to collect logs
  await new Promise(r => setTimeout(r, 10000));
  await browser.close();
})();
