/**
 * Headless smoke agent: `npm run agent`.
 * Boots the vite build (or dev server) and uses Playwright to verify the
 * scene actually renders: console errors, canvas pixels, moon toggle.
 *
 * Usage:
 *   npm run build && node agent/agent.js
 *   BASE_URL=http://localhost:5173 node agent/agent.js
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:4173';

async function ensureServer() {
  // if BASE responds, use it; otherwise serve ./dist via vite preview
  try {
    const res = await fetch(BASE);
    if (res.ok) return null;
  } catch { /* start preview */ }
  if (!fs.existsSync('dist/index.html')) {
    console.error('[agent] dist/ missing — run `npm run build` first (or set BASE_URL to dev server).');
    process.exit(1);
  }
  console.log('[agent] starting `vite preview`…');
  const child = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'pipe' });
  await new Promise((r) => setTimeout(r, 3500));
  return child;
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

let preview = null;
try {
  preview = await ensureServer();
  const launchOpts = { args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] };
  if (process.env.CHROME_PATH) launchOpts.executablePath = process.env.CHROME_PATH;
  let browser;
  try {
    browser = await chromium.launch(launchOpts);
  } catch {
    // fall back to system chrome (avoids downloading test browsers)
    browser = await chromium.launch({ ...launchOpts, executablePath: '/usr/bin/google-chrome' });
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(6000);

  check('page loads', true);
  check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  const canvas = await page.$('#app canvas');
  check('webgl canvas present', !!canvas);

  // canvas is actually painting: analyze a real screenshot (WebGL canvases
  // have preserveDrawingBuffer:false, so drawImage readback would be blank)
  const shot = await page.screenshot();
  const paints = await page.evaluate(async (b64) => {
    const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
    const bmp = await createImageBitmap(blob);
    const g = document.createElement('canvas');
    g.width = 64; g.height = 64;
    g.getContext('2d').drawImage(bmp, 0, 0, 64, 64);
    const d = g.getContext('2d').getImageData(0, 0, 64, 64).data;
    const set = new Set();
    for (let i = 0; i < d.length; i += 16) set.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
    return { ok: set.size > 12, colors: set.size };
  }, shot.toString('base64'));
  check('canvas paints scene', paints.ok, `${paints.colors} distinct colors`);

  // moon toggle via agent tools
  const moonState = await page.evaluate(() => {
    if (!window.__moon) return null;
    window.__moon.moonDown();
    return window.__moon.sceneInfo().moon;
  });
  check('agent tools exposed', !!moonState, JSON.stringify(moonState));
  await page.waitForTimeout(3500);
  await page.screenshot({ path: 'agent/moon-down.png' });
  check('screenshot saved', fs.existsSync('agent/moon-down.png'));

  await browser.close();
} finally {
  if (preview) preview.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n[agent] ${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
