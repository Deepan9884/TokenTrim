const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const extensionPath = path.resolve('./dist');
  const browser = await puppeteer.launch({
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  });

  const page = await browser.newPage();
  await new Promise(r => setTimeout(r, 2000));
  const targets = await browser.targets();
  const extTarget = targets.find(t => t.url().startsWith('chrome-extension://'));
  const extensionId = extTarget ? new URL(extTarget.url()).hostname : targets.find(t => t.type() === 'service_worker').url().split('/')[2];

  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  page.on('console', msg => console.log('POPUP LOG:', msg.text()));

  await new Promise(r => setTimeout(r, 1000));

  const dummyPdfPath = path.resolve('dummy2.pdf');
  const fileInput = await page.$('#fileInput');
  
  console.log('--- FIRST RUN ---');
  await fileInput.uploadFile(dummyPdfPath);
  await new Promise(r => setTimeout(r, 1000));
  let convertBtn = await page.$('#convertBtn');
  if (convertBtn) await convertBtn.click();
  await new Promise(r => setTimeout(r, 4000)); // wait for finish

  // Click 'Convert another file'
  const anotherBtn = await page.$('#convertAnotherBtn');
  if (anotherBtn) {
    await anotherBtn.click();
    console.log('Clicked Convert Another');
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('--- SECOND RUN ---');
  await fileInput.uploadFile(dummyPdfPath);
  await new Promise(r => setTimeout(r, 1000));
  convertBtn = await page.$('#convertBtn');
  if (convertBtn) await convertBtn.click();
  
  await new Promise(r => setTimeout(r, 5000));
  await browser.close();
})();
