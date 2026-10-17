import { chromium } from 'playwright';
let browser;
try { browser = await chromium.launch({ headless: true }); }
catch { browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] }); }
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://127.0.0.1:5173/?capture=1', { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(() => !!window.__town, { timeout: 120000 });
  console.log(JSON.stringify(await page.evaluate(() => {
    const views = [];
    for (const x of [-38.8, -39.2, -39.6, -40.0]) for (const z of [-80.6, -80.3, -80.0, -79.7]) {
      const position = [x, 27.3, z], info = window.__town.probeView(position, [-30.5, 29.0, -60]);
      views.push({ position, ...info });
    }
    return views;
  }), null, 2));
} finally { await browser.close(); }
