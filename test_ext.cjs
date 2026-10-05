const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
  const extensionPath = path.resolve('./dist'); // 'dist' is the unpacked extension directory
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  // Wait a bit for the extension to load
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Find the extension ID
  const targets = await browser.targets();
  const extensionTarget = targets.find(target => target.type() === 'service_worker' || target.url().startsWith('chrome-extension://'));
  
  if (!extensionTarget) {
    console.error('Extension not found');
    await browser.close();
    return;
  }
  
  const url = extensionTarget.url();
  const extensionId = url.split('/')[2];
  console.log('Extension ID:', extensionId);

  const page = await browser.newPage();
  
  // Log all console messages
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  console.log('Opened popup.html');

  // Wait for the UI to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Upload a dummy PDF
  const dummyPdfPath = path.resolve('dummy.pdf');
  fs.writeFileSync(dummyPdfPath, '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n5 0 obj\n<< /Length 44 >>\nstream\nBT\n/F1 24 Tf\n100 100 Td\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000224 00000 n \n0000000312 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n407\n%%EOF');

  const fileInput = await page.$('#fileInput');
  await fileInput.uploadFile(dummyPdfPath);
  console.log('Uploaded dummy.pdf');

  // Click convert button
  try {
    await page.waitForSelector('#convertBtn', { visible: true, timeout: 2000 });
    await page.click('#convertBtn');
    console.log('Clicked convert button');
  } catch (e) {
    console.log('Convert button not found or not visible, maybe automatic?');
  }

  // Wait a few seconds to see logs
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  await browser.close();
})();
