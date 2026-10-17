import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

// Soundtrack check: the ACE-Step day piece starts after the opening quiet,
// a missing night piece falls back to the generative raga, the song starts
// on the moon finale with its lyric captions, and sending the moon home
// stops it.   node agent/check-audio.mjs   (starts its own server on 5287)

const PORT = 5287;
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'pipe', detached: true });
await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error('vite did not start')), 60000);
  vite.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok(); } });
});
let browser;
try {
  const args = ['--autoplay-policy=no-user-gesture-required'];
  try { browser = await chromium.launch({ headless: true, args }); }
  catch { browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: [...args, '--no-sandbox', '--disable-dev-shm-usage'] }); }
  const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${PORT}/?capture=1&time=0.4`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(() => !!window.__town, null, { timeout: 120000 });
  await page.evaluate(() => { document.querySelector('.g-loader')?.remove(); return window.__town.music.play(); });
  const run = (seconds) => page.evaluate((s) => { for (let i = 0; i < s * 20; i++) window.__town.step(1 / 20); }, seconds);
  const dbg = () => page.evaluate(() => window.__town.music.debug);

  await run(8); await page.waitForTimeout(1500);
  let d = await dbg();
  assert.equal(d.bed, 'day', 'day piece chosen by day');
  assert.equal(d.tracks.day.ok, true, 'day piece loads');
  assert.equal(d.tracks.day.paused, false, 'day piece is playing');
  assert.equal(d.ragaLevel, 0, 'raga steps aside for the recording');

  await page.evaluate(() => window.__town.setDayTime(0.95));
  await run(6); await page.waitForTimeout(1500); await run(80); await page.waitForTimeout(1500); await run(1);
  d = await dbg();
  assert.notEqual(d.bed, 'day', 'day piece leaves at night');
  if (d.tracks.night && !d.tracks.night.ok) assert.equal(d.ragaLevel > 0, true, 'raga fills in for a missing night piece');

  await page.evaluate(() => window.__moon.toggleMoon());
  await page.waitForTimeout(2500);
  d = await dbg();
  assert.equal(d.song, true, 'song plays when the moon comes down');
  assert.equal(d.tracks.song.paused, false);
  await page.evaluate(() => window.__town.music.seekSong(56));
  await page.waitForTimeout(600); await run(0.2);
  assert.match(await page.locator('.g-lyric .hi').textContent(), /चंदा उतर आ/, 'chorus lyric shows');
  assert.equal(await page.locator('.g-lyric').evaluate((e) => e.classList.contains('show')), true);

  await page.locator('[data-act="moon"]').click(); await run(0.2);
  d = await dbg();
  assert.equal(d.song, false, 'song stops when the moon goes home');
  assert.equal(errors.length, 0, `browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ status: 'PASS', dayPiece: true, nightFallback: d.tracks.night?.ok === false ? 'raga' : 'recording', song: true, lyrics: true }, null, 2));
} finally {
  await browser?.close();
  try { process.kill(-vite.pid); } catch { /* already gone */ }
}
