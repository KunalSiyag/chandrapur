// Focused check of the last chapters: light 7 ghat diyas at dusk, then bring down the moon.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const out = process.argv[2] ?? 'agent/shots/endgame'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__town, null, { timeout: 180000 });
await page.evaluate(() => document.querySelector('[data-start="new"]').click());
const T = (fn, a) => page.evaluate(fn, a);
const frames = async (n = 2) => { const f0 = await T(() => window.__town.frames ?? 0); await page.waitForFunction(([f, k]) => (window.__town.frames ?? 0) >= f + k, [f0, n], { timeout: 90000 }); };
const tp = (p, l) => T(([p, l]) => { const S = window.__town, V = S.player.position.constructor; S.player.snapTo(new V(...p), new V(...l)); }, [p, l]);
const pressE = async () => { await page.keyboard.down('KeyE'); await frames(1); await page.keyboard.up('KeyE'); await frames(1); };
const status = () => T(() => { const g = window.__town.game; return { step: g.state.step, diyas: g.state.diyas.size, quest: document.querySelector('.g-quest .title').textContent, prompt: document.querySelector('.g-prompt .lbl').textContent }; });
await T(() => { window.__town.game.jumpTo(10); window.__town.day.set(0.79); });
for (const x of [17.6, 20.1, 22.6, 25.1, 27.6, 30.1, 32.6]) {
  await tp([x, 0, 49.75], [x, 0, 54]); await frames(3);
  const before = await status(); await pressE(); const after = await status();
  console.log(x, before.prompt, '→ diyas', after.diyas, 'step', after.step);
}
await tp([24, 0, 46.8], [28, 2.5, 62]); await frames(3);
await page.screenshot({ path: `${out}/diyas-dusk.png` });
await page.keyboard.down('KeyM'); await frames(1); await page.keyboard.up('KeyM');
await frames(16);
await page.screenshot({ path: `${out}/finale.png` });
console.log('final', JSON.stringify(await status()), 'finale sheet', await T(() => !!document.querySelector('[data-sheet="finale"]:not([hidden])')), 'errors', JSON.stringify(errors));
await browser.close();
