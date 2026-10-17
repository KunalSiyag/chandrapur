// Quick capture harness for the daytime/game build.
// node agent/game-shots.mjs [outDir] [--only a,b] [--time 0.35]
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const views = [
  { name: 'start', live: true },
  { name: 'station', position: [4.8, 2.05, 3.8], target: [-1.5, 2.8, -10.5] },
  { name: 'bazaar', position: [9.1, 1.9, 3.1], target: [16.2, 2.8, 15.4] },
  { name: 'river', position: [30.2, 1.55, 49.4], target: [4.0, 1.1, 60.0] },
  { name: 'farms', position: [52, 9, -4], target: [70, 0, 22] },
  { name: 'farms-low', position: [58, 1.8, 6], target: [72, 1.2, 30] },
  { name: 'farm-west', position: [-60, 6, 20], target: [-80, 0, 40] },
  { name: 'hilltop', position: [-73, 23.2, -55.7], target: [8, 3.8, 21] },
  { name: 'overview', position: [-43, 70, 24], target: [10, 0, 10] },
  { name: 'overview-east', position: [100, 60, -40], target: [40, 0, 30] },
];
const args = process.argv.slice(2);
const outDir = args[0] && !args[0].startsWith('--') ? args[0] : 'agent/shots/game';
const onlyIndex = args.indexOf('--only');
const only = onlyIndex >= 0 ? args[onlyIndex + 1].split(',') : null;
const timeIndex = args.indexOf('--time');
const dayTime = timeIndex >= 0 ? Number(args[timeIndex + 1]) : null;
await mkdir(outDir, { recursive: true });
let browser;
try { browser = await chromium.launch({ headless: true }); }
catch { browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] }); }
try {
  for (const view of views.filter((v) => !only || only.includes(v.name))) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`http://127.0.0.1:5173/${view.live ? '' : '?capture=1'}`, { waitUntil: 'networkidle', timeout: 180000 });
    await page.waitForFunction(() => !!window.__town, null, { timeout: 180000 });
    let info;
    if (view.live) {
      await page.waitForTimeout(5000);
    } else {
      info = await page.evaluate(([v, time]) => {
        document.querySelectorAll('.g,.g-loader,.g-title,.g-fade').forEach((e) => { e.style.display = 'none'; });
        if (time !== null) window.__town.setDayTime?.(time);
        return window.__town.renderView(v.position, v.target);
      }, [view, dayTime]);
    }
    await page.screenshot({ path: `${outDir}/${view.name}.png`, timeout: 180000 });
    console.log(JSON.stringify({ view: view.name, errors }));
    await page.close();
  }
} finally { await browser.close(); }
