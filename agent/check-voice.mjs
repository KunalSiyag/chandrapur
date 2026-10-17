import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import http from 'node:http';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// Villager conversation check, end to end: a stand-in OpenAI-compatible model,
// the real Vite server pointed at it, and a browser that walks up to Ramu,
// presses T, types a question and gets his answer. Also checks the scripted
// quest lines still advance, the offline fallback answers when the model is
// down, and typing in the chat box never moves the player.
//
//   node agent/check-voice.mjs        (starts its own servers on 5191 / 5192)

const LLM_PORT = 5191, APP_PORT = 5192;
const seen = [], spoken = [];
let llmUp = true, stallNext = false;
const llm = http.createServer(async (req, res) => {
  let body = ''; for await (const c of req) body += c;
  if (!llmUp) { res.statusCode = 500; return res.end('{}'); }
  const msg = JSON.parse(body);
  if (req.url.endsWith('/audio/speech')) { spoken.push(msg); res.setHeader('Content-Type', 'audio/mpeg'); return res.end(Buffer.alloc(64)); }
  seen.push(msg);
  if (stallNext) { stallNext = false; await new Promise((r) => setTimeout(r, 30000)); if (res.destroyed) return; }
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ id: 'x', object: 'chat.completion', created: 0, model: msg.model,
    choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: '<think>plan</think>Arre beta, Sharma ji is in the Old Bazaar, just under the bunting!' } }] }));
}).listen(LLM_PORT);

const vite = spawn('npx', ['vite', '--port', String(APP_PORT), '--strictPort', '--host', '127.0.0.1'], {
  env: { ...process.env, LLM_API_KEY: 'test', LLM_BASE_URL: `http://127.0.0.1:${LLM_PORT}/v1`, LLM_MODEL: 'stand-in',
    TTS_PROVIDER: 'openai', TTS_API_KEY: 'test', TTS_BASE_URL: `http://127.0.0.1:${LLM_PORT}/v1`,
    TTS_CACHE_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'chandrapur-voices-')) }, stdio: 'pipe', detached: true });
await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error('vite did not start')), 60000);
  vite.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok(); } });
});

let browser;
try {
  try { browser = await chromium.launch({ headless: true }); }
  catch { browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] }); }
  const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const clips = []; page.on('request', (r) => { if (r.url().includes('/audio/voices/')) clips.push(r.url()); });
  const base = `http://127.0.0.1:${APP_PORT}`;
  assert.deepEqual(await (await fetch(`${base}/api/npc/status`)).json(), { enabled: true, tts: true }, 'conversation and voice APIs are on');

  await page.goto(`${base}/?capture=1`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(() => !!window.__town, null, { timeout: 120000 });
  await page.evaluate(() => { document.querySelector('.g-loader')?.remove(); window.__town.step(1 / 60); });
  const step = (n = 10) => page.evaluate((k) => { for (let i = 0; i < k; i++) window.__town.step(1 / 60); }, n);

  // walk up to Ramu
  await page.evaluate(() => {
    const T = window.__town, r = T.game.npcs.get('ramu').position;
    const p = r.clone(); p.x += 1.6;
    T.player.snapTo(p, r.clone().setY(r.y + 1.5));
  });
  await step();
  assert.match(await page.locator('.g-prompt .lbl').textContent(), /Talk to Ramu Chaiwala/, 'talk prompt near Ramu');

  // the scripted quest line still opens with E and shows the T hint
  await page.keyboard.press('KeyE'); await step(2);
  await page.waitForTimeout(400);
  assert.match(await page.locator('.g-dialog .who').textContent(), /Ramu/, 'scripted dialogue opens');
  await page.waitForTimeout(800);
  assert.ok(clips.some((u) => /\/audio\/voices\/ramu-[0-9a-f]{8}\.mp3$/.test(u)), 'scripted line plays its pre-rendered voice');

  // T: free conversation (finishes the quest talk first)
  await page.keyboard.press('KeyT'); await step(2);
  await page.locator('.g-chat').waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => window.__town.game.state.step), 1, 'quest conversation completed before chat');
  const before = await page.evaluate(() => window.__town.player.position.toArray());
  await page.locator('#g-say').fill('Where can I find Sharma ji? wasd');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /Old Bazaar/.test(document.querySelector('.g-dialog .text').textContent), null, { timeout: 15000 });
  await step(30);
  assert.deepEqual(await page.evaluate(() => window.__town.player.position.toArray()), before, 'typing does not move the player');
  const reply = await page.locator('.g-dialog .text').textContent();
  assert.ok(!reply.includes('think'), 'reasoning tags are stripped');
  assert.match(await page.locator('.g-dialog .you').textContent(), /You: Where can I find Sharma ji/, 'your words are shown');

  const sys = seen.at(-1).messages[0].content;
  assert.match(sys, /You are Ramu Chaiwala/, 'persona in the system prompt');
  assert.match(sys, /current task: "The Sweet-Maker's Worry/, 'quest context reaches the model');
  assert.equal(seen.at(-1).model, 'stand-in');
  const line = spoken.find((s) => /Old Bazaar/.test(s.input));
  assert.ok(line, 'the reply is sent to the speech model');
  assert.match(line.instructions, /chai seller/, 'speech model is told who is speaking');
  assert.ok(['ash', 'onyx', 'echo', 'ballad', 'verse'].includes(line.voice), 'a male voice for Ramu');

  // a stalled model request is hedged: a second ask answers within seconds
  stallNext = true;
  const asked = Date.now();
  await page.locator('#g-say').fill('And Baldev Kaka?');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /And Baldev Kaka/.test(document.querySelector('.g-dialog .you').textContent) && !/thinking/.test(document.querySelector('.g-chat-status').textContent), null, { timeout: 15000 });
  assert.ok(Date.now() - asked < 8000, `stalled request was hedged (${Date.now() - asked} ms)`);

  // model down: the offline villager still answers, with a hint
  llmUp = false;
  await page.locator('#g-say').fill('where is munni didi');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /mango orchard/i.test(document.querySelector('.g-dialog .text').textContent), null, { timeout: 15000 });

  // Escape closes the chat and frees the player
  await page.keyboard.press('Escape'); await step(2);
  assert.equal(await page.locator('.g-dialog').isVisible(), false, 'Escape closes the chat');
  assert.equal(await page.evaluate(() => window.__town.game.blocking), false, 'player is free again');

  // the song's lyric captions
  await page.evaluate(() => window.__town.hud.lyric({ hi: 'चंदा उतर आ', en: 'Moon, come down' }));
  assert.equal(await page.locator('.g-lyric .hi').textContent(), 'चंदा उतर आ');

  assert.equal(errors.length, 0, `browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ status: 'PASS', api: true, scriptedDialogue: true, chat: true, contextToModel: true, hedgedStall: true, preRendered: true, neuralVoice: true, offlineFallback: true, escape: true, lyrics: true }, null, 2));
} finally {
  await browser?.close();
  try { process.kill(-vite.pid); } catch { /* already gone */ }
  llm.closeAllConnections(); llm.close();
}
