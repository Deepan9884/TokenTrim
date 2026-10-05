const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  await page.goto('http://127.0.0.1:8080/test-worker.html');
  await new Promise(resolve => setTimeout(resolve, 2000));
  await browser.close();
})();
