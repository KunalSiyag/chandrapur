import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle', timeout: 180000 });
await page.waitForFunction(() => !!window.__town, null, { timeout: 180000 });
await page.evaluate(() => document.querySelector('[data-start="new"]').click());
const measure = (label) => page.evaluate((label) => new Promise((res) => { const ts = []; const f = (t) => { ts.push(t); if (ts.length < 8) requestAnimationFrame(f); else res({ label, avgMs: Math.round((ts.at(-1) - ts[0]) / 7), ...window.__town.post.renderStats }); }; requestAnimationFrame(f); }), label);
for (const [label, p, l] of [['station', [3.2, 0, 1], [0, 2, -10]], ['farms', [60, 0, 18], [70, 1, 30]], ['paddy', [-60, 0, 29], [-80, 1, 20]]]) {
  await page.evaluate(([p, l]) => { const S = window.__town, V = S.player.position.constructor; S.player.snapTo(new V(...p), new V(...l)); }, [p, l]);
  console.log(JSON.stringify(await measure(label)));
}
await browser.close();
