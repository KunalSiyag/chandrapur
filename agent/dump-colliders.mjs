import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
await page.goto('http://127.0.0.1:5173/?capture=1', { waitUntil: 'networkidle', timeout: 180000 });
await page.waitForFunction(() => !!window.__town, { timeout: 180000 });
const data = await page.evaluate(() => {
  const c = window.__town.collisions;
  return { oriented: c.oriented.map((b) => [b.cx, b.cz, b.hx, b.hz, b.yaw, b.owner]), circles: c.circles.map((b) => [b.cx, b.cz, b.r]), boxes: c.boxes };
});
await writeFile(process.argv[2], JSON.stringify(data));
await browser.close();
