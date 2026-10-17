/**
 * Pre-render every scripted line in the villagers' neural voices: quest
 * dialogue, idle chatter, quest-giver hints and conversation greetings.
 * Writes public/audio/voices/<lineKey>.mp3 plus manifest.json, so the game
 * plays them instantly, and even a static deploy (no server, no key) has
 * real voices. Free conversation is still voiced live through /api/tts.
 *
 *   node tools/render-voices.mjs            (uses .env: GMI_API_KEY or TTS_*)
 *   node tools/render-voices.mjs --dry      (list the lines and the cost)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHARACTERS, HINTS, GREETINGS, lineKey } from '../src/game/characters.js';
import { STEPS } from '../src/game/quests.js';
import { createVoiceBox } from '../server/npc-brain.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public', 'audio', 'voices');
try { process.loadEnvFile(path.join(root, '.env')); } catch { /* env from the shell */ }

const lines = new Map();
const add = (npc, text) => lines.set(lineKey(npc, text), { npc, text });
for (const s of STEPS) for (const [npc, text] of s.dialogue ?? []) add(npc, text);
for (const [id, c] of Object.entries(CHARACTERS)) {
  for (const text of c.idle) add(id, text);
  for (const text of GREETINGS) add(id, text);
  // "Sharma ji? His sweet shop is…" — what anyone says when you ask after a quest-giver
  for (const [target, hint] of Object.entries(HINTS)) if (target !== id) add(id, `${CHARACTERS[target].name}? ${hint}`);
}

const chars = [...lines.values()].reduce((n, l) => n + l.text.length, 0);
console.log(`${lines.size} lines, ${chars} characters (~$${(chars * 25e-6).toFixed(2)} on inworld-tts-2)`);
if (process.argv.includes('--dry')) process.exit(0);

const box = createVoiceBox(process.env);
if (!box.enabled) { console.error('No speech provider: set GMI_API_KEY (or TTS_PROVIDER/TTS_API_KEY) in .env'); process.exit(1); }
await fs.mkdir(out, { recursive: true });
const have = new Set((await fs.readdir(out)).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)));

const queue = [...lines.entries()].filter(([key]) => !have.has(key));
let done = 0, failed = 0;
async function worker() {
  for (let job = queue.shift(); job; job = queue.shift()) {
    const [key, { npc, text }] = job;
    try { await fs.writeFile(path.join(out, `${key}.mp3`), await box.speak(npc, text)); done++; }
    catch (e) { failed++; console.warn(`  ✗ ${npc}: ${text.slice(0, 50)} — ${e.message}`); }
    process.stdout.write(`\r  ${done} rendered, ${failed} failed, ${queue.length} to go   `);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
const keys = (await fs.readdir(out)).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)).filter((k) => lines.has(k)).sort();
await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify({ provider: box.provider, model: box.model, lines: keys }) + '\n');
console.log(`\nmanifest: ${keys.length}/${lines.size} lines → public/audio/voices/`);
