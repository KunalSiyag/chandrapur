import { chromium } from 'playwright';
let browser;
try { browser = await chromium.launch({ headless: true }); }
catch { browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] }); }
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 500)); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + (e.stack || e.message).slice(0, 700)));
await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
await page.waitForTimeout(8000);
console.log(JSON.stringify({ booted: await page.evaluate(() => !!window.__moon).catch(() => 'evaluate-failed'), errors: errors.slice(0, 8) }, null, 1));
await browser.close();
