import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const views = [
  { name: 'station', position: [4.8, 2.05, 3.8], target: [-1.5, 2.8, -10.5] },
  { name: 'bazaar-entrance', position: [9.1, 1.9, 3.1], target: [16.2, 2.8, 15.4] },
  { name: 'bazaar-interior', position: [17.1, 1.9, 19.5], target: [19.5, 2.55, 34.0] },
  { name: 'river', position: [30.2, 1.55, 49.4], target: [4.0, 1.1, 60.0] },
  { name: 'hilltop', position: [-73, 23.2, -55.7], target: [8, 3.8, 21] },
  { name: 'balloon', flight: true, seconds: 33 },
  { name: 'balloon-fort', flight: true, seconds: 64 },
  { name: 'balloon-shrine', flight: true, seconds: 80 },
  { name: 'village', position: [-46.5, 12.3, -42.5], target: [-40.6, 13.4, -45.2] },
  { name: 'shrine', position: [-35, 27.2, -71.5], target: [-35.0, 28.5, -79] },
  { name: 'river-moon', position: [22, 1.7, 48], target: [31, 6.3, 72] },
  { name: 'alley-moon', position: [23.3, 1.8, 37], target: [30.5, 6.0, 66] },
  { name: 'temple-moon', position: [-38.8, 27.3, -80.3], target: [-35.0, 29.0, -60] },
  { name: 'balloon-station', position: [-5, 2.0, 70.4], target: [3.2, 4.4, 77] },
  { name: 'town-overview', position: [-43, 59, 24], target: [-14, 4, -7] },
  { name: 'moon-wires', position: [16.5, 1.8, 21], target: [28, 6.8, 47] },
];
const stage = process.argv.includes('--milestone') ? 'milestone' : 'final';
const onlyIndex = process.argv.indexOf('--only');
const only = onlyIndex >= 0 ? process.argv[onlyIndex + 1].split(',') : null;
const selected = (stage === 'milestone' ? views.slice(0, 4) : views).filter((v) => !only || only.includes(v.name));
await mkdir(`agent/shots/town/${stage}`, { recursive: true });
let browser;
try { browser = await chromium.launch({ headless: true }); }
catch { browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] }); }
try {
  for (const view of selected) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:5173/?capture=1', { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForFunction(() => !!window.__town, { timeout: 120000 });
    const info = await page.evaluate((v) => {
      document.querySelectorAll('.gytm,.gytm-loader').forEach((e) => { e.style.display = 'none'; });
      if (v.flight) return window.__town.captureFlight(v.seconds ?? 57);
      return window.__town.renderView(v.position, v.target);
    }, view);
    await page.screenshot({ path: `agent/shots/town/${stage}/${view.name}.png`, timeout: 120000 });
    console.log(JSON.stringify({ view: view.name, info, errors }));
    await page.close();
  }
} finally { await browser.close(); }
