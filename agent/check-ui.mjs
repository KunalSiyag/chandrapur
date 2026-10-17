import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Game HUD check: the map sheet opens from its button and Tab, never moves
// the player, closes on Escape, and the HUD fits a phone viewport.
let browser;
try { browser = await chromium.launch({ headless: true }); }
catch { browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] }); }
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/?capture=1', { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(() => !!window.__town, null, { timeout: 120000 });
  await page.evaluate(() => { document.querySelector('.g-loader')?.remove(); window.__town.step(1 / 60); window.__town.render(); });
  assert.equal(await page.locator('.g-quest .title').textContent(), 'Meet Ramu Chaiwala', 'first quest is shown');
  const mapSheet = page.locator('.g-sheet[data-sheet="map"]');
  const start = await page.evaluate(() => window.__town.player.position.toArray());
  await page.locator('.g-btn[data-act="map"]').click();
  assert.equal(await mapSheet.isVisible(), true, 'map opens from its button');
  await page.keyboard.down('KeyW');
  await page.evaluate(() => { for (let i = 0; i < 30; i++) window.__town.step(1 / 60); });
  await page.keyboard.up('KeyW');
  assert.deepEqual(await page.evaluate(() => window.__town.player.position.toArray()), start, 'map does not move the player');
  await page.keyboard.press('Escape');
  assert.equal(await mapSheet.isVisible(), false, 'Escape closes the map');
  await page.keyboard.press('Tab');
  assert.equal(await mapSheet.isVisible(), true, 'Tab opens the map');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'mobile HUD has no horizontal overflow');
  await page.locator('.g-btn[data-act="map"]').click();
  assert.equal(await mapSheet.locator('.g-panel').evaluate((e) => e.getBoundingClientRect().width <= window.innerWidth), true, 'map fits mobile viewport');
  await page.keyboard.press('Escape');
  assert.equal(errors.length, 0, `browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ status: 'PASS', firstQuest: true, mapPreservesPosition: true, keyboard: true, mobileFits: true }, null, 2));
} finally { await browser.close(); }
