// Drives the actual game UI: title → start → talk → collect → … → finale.
// node agent/playtest.mjs <outDir> [--quick]
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const out = process.argv[2] ?? 'agent/shots/playtest';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] });
const log = (...a) => console.log(...a);
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message + ' ' + (e.stack ?? '').split('\n')[1]));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForFunction(() => !!window.__town, null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${out}/01-title.png` });
  await page.evaluate(() => document.querySelector('[data-start="new"]').click());
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${out}/02-start.png` });
  const T = (fn, arg) => page.evaluate(fn, arg);
  const tp = (pos, look) => T(([p, l]) => { const S = window.__town; S.player.snapTo(new S.player.position.constructor(...p), new S.player.position.constructor(...l)); }, [pos, look]);
  const frames = async (n = 2) => { const f0 = await T(() => window.__town.frames ?? 0); await page.waitForFunction(([f, k]) => (window.__town.frames ?? 0) >= f + k, [f0, n], { timeout: 60000 }); };
  const pressE = async () => { await page.keyboard.down('KeyE'); await frames(1); await page.keyboard.up('KeyE'); await frames(1); };
  const status = () => T(() => { const g = window.__town.game; return { step: g.state.step, rupees: g.state.rupees, inv: g.state.inv, quest: document.querySelector('.g-quest .title').textContent, obj: document.querySelector('.g-quest .obj').textContent, prompt: document.querySelector('.g-prompt .lbl').textContent }; });
  async function talk(npcPos, standAt, shot) {
    await tp(standAt, [npcPos[0], npcPos[1] + 1.4, npcPos[2]]);
    await page.waitForFunction(() => /Talk to/.test(document.querySelector('.g-prompt .lbl').textContent) && !document.querySelector('.g-prompt').hidden, null, { timeout: 30000 }).catch(() => {});
    log('prompt:', (await status()).prompt);
    for (let k = 0; k < 4 && !(await T(() => window.__town.game.blocking)); k++) {
      await pressE(); await page.waitForFunction(() => window.__town.game.blocking, null, { timeout: 8000 }).catch(() => log('retry E'));
    }
    await page.waitForTimeout(1500);
    if (shot) await page.screenshot({ path: `${out}/${shot}.png` });
    for (let i = 0; i < 20 && await T(() => window.__town.game.blocking); i++) { await pressE(); await page.waitForTimeout(500); }
    log('after talk:', JSON.stringify(await status()));
  }
  const npc = (id) => T((i) => window.__town.game.npcs.get(i).position.toArray(), id);
  const fromIdx = process.argv.indexOf('--from'), from = fromIdx > 0 ? Number(process.argv[fromIdx + 1]) : 0;
  let p;
  if (from) await T((f) => { const g = window.__town.game; if (f >= 3) g.state.inv.marigold = 10; if (f === 7) g.state.inv.mango = 8; if (f === 4) g.state.inv.laddoo = 1; g.jumpTo(f); }, from);
  if (from <= 0) {
  // 1. Ramu
  p = await npc('ramu'); await talk(p, [p[0] - 1.6, 0, p[2] + 1.4], '03-dialog-ramu');
  // 2. Sharma
  p = await npc('sharma'); await talk(p, [p[0] + 1.2, 0, p[2] + 1.6], '04-dialog-sharma');
  // 3. Marigolds: walk into each pickup
  await tp([56, 0, 12], [52, 1, 12]); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/05-marigold-field.png` });
  for (let i = 0; i < 14; i++) {
    const it = await T(() => { const g = window.__town.game, it = g.pickups.nearestOf('marigold', window.__town.player.position); return it ? [...it.group.position.toArray(), it.id] : null; });
    if (!it) break;
    await tp([it[0], 0, it[2] + 0.2], [it[0], 1, it[2] - 3]);
    await page.waitForFunction((id) => window.__town.game.pickups.items.find((i) => i.id === id)?.taken, it[3], { timeout: 30000 }).catch(() => log('pickup not taken', it[3]));
  }
  log('after marigolds:', JSON.stringify(await status()));
  }
  if (from <= 3) {
  p = await npc('sharma'); await talk(p, [p[0] + 1.2, 0, p[2] + 1.6]);
  await page.waitForTimeout(400); await page.screenshot({ path: `${out}/06-quest-complete.png` });
  }
  // 4. Baldev
  p = await npc('baldev'); await talk(p, [p[0] - 1.8, 0, p[2] + 0.6], '07-dialog-baldev');
  // 5. Munni + mangoes
  p = await npc('munni'); await talk(p, [p[0] + 0.2, 0, p[2] - 1.8], '08-dialog-munni');
  for (let i = 0; i < 12; i++) {
    const it = await T(() => { const g = window.__town.game, it = g.pickups.nearestOf('mango', window.__town.player.position); return it ? [...it.group.position.toArray(), it.id] : null; });
    if (!it) break;
    await tp([it[0], 0, it[2] + 0.2], [it[0], 1, it[2] - 3]);
    await page.waitForFunction((id) => window.__town.game.pickups.items.find((i) => i.id === id)?.taken, it[3], { timeout: 30000 }).catch(() => log('pickup not taken', it[3]));
  }
  await page.screenshot({ path: `${out}/09-orchard.png` });
  p = await npc('munni'); await talk(p, [p[0] + 0.2, 0, p[2] - 1.8]);
  // 6. shrine: reach + rest + ring
  await tp([-35, 0, -73.5], [-35, 26.5, -79]); await frames(4);
  log('at shrine:', JSON.stringify(await status()));
  await tp([-35, 0, -75.2], [-35, 26.5, -79]); await frames(3);
  log('bell prompt:', (await status()).prompt);
  await pressE();
  // headless frames are slow; the rest skips ahead the way a real 5 s rush would
  log('resting:', await T(() => window.__town.day.rushing));
  await T(() => window.__town.day.set(0.765)); await frames(3);
  await page.screenshot({ path: `${out}/10-shrine-dusk.png` });
  log('dusk prompt:', (await status()).prompt);
  await pressE(); await frames(2);
  log('after bell:', JSON.stringify(await status()));
  // 7. diyas
  const slots = [[17.6, 50.75], [20.1, 50.75], [22.6, 50.75], [25.1, 50.75], [27.6, 50.75], [30.1, 50.75], [32.6, 50.75]];
  for (const [x, z] of slots) { await tp([x, 0, z - 1.0], [x, 0, z + 4]); await frames(3); log('diya prompt', (await status()).prompt); await pressE(); }
  log('after diyas:', JSON.stringify(await status()));
  await T(() => window.__town.day.set(0.86)); await page.screenshot({ path: `${out}/10b-diyas.png` });
  await tp([24, 0, 47.6], [30, 3, 62]); await frames(2);
  await page.keyboard.press('KeyM'); await frames(14);
  await page.screenshot({ path: `${out}/11-finale.png` });
  log('final:', JSON.stringify(await status()));
  log('errors:', JSON.stringify(errors));
} finally { await browser.close(); }
