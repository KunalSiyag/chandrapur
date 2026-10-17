import { chromium } from 'playwright';
import { preview } from 'vite';
import assert from 'node:assert/strict';

const server = await preview({ preview: { host: '127.0.0.1', port: 5184, strictPort: true } });
let browser;
try {
  try { browser = await chromium.launch({ headless: true }); }
  catch { browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] }); }
  const page = await browser.newPage({ viewport: { width: 1000, height: 680 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:5184/?capture=1', { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(() => !!window.__town);
  const result = await page.evaluate(() => {
    const S = window.__town;
    S.renderView([4.8, 2.05, 3.8], [-1.5, 2.8, -10.5]);
    const colliders = S.collisions.oriented.length + S.collisions.circles.length;
    const flight = S.captureFlight(33);
    const calls = S.post.renderStats.calls, triangles = S.post.renderStats.triangles;
    return { districts: S.town.districts.length, colliders, flight: flight.state, seated: S.player.transported, calls, triangles };
  });
  assert.equal(result.districts, 7); assert.ok(result.colliders > 150); assert.equal(result.flight, 'cruising'); assert.equal(result.seated, true);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'PASS', ...result, errors }, null, 2));
} finally { await browser?.close(); await server.close(); }
