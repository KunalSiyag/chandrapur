import OpenAI from 'openai';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CHARACTERS, WORLD_BRIEF } from '../src/game/characters.js';

/**
 * POST /api/npc — free conversation with a villager.
 *
 *   { npc: 'ramu', message: 'Where do I find mangoes?',
 *     history: [{ role: 'user' | 'assistant', text }],
 *     context: { clock, phase, district, quest, objective, carrying } }
 *   -> { reply }
 *
 * Talks to any OpenAI-compatible chat endpoint. The key never reaches the
 * browser. Configure in .env:
 *   LLM_API_KEY   (falls back to GMI_API_KEY)
 *   LLM_BASE_URL  (default: GMI Cloud when only GMI_API_KEY is set, else OpenAI)
 *   LLM_MODEL     (falls back to GMI_MODEL)
 * Without a key it answers 503 and the game uses its offline lines.
 *
 * POST /api/tts — { npc, text } -> audio/mpeg, the line acted in that
 * villager's own cast voice. Providers (TTS_PROVIDER):
 *   gmi     Inworld TTS-2 on GMI Cloud's request queue (default when
 *           GMI_API_KEY is set). Scripted lines use TTS_MODEL (inworld-tts-2,
 *           directed by each villager's acting note); live replies use
 *           TTS_LIVE_MODEL (inworld-tts-2-flash, ~1.5 s faster, same voices)
 *   openai  any OpenAI-compatible /audio/speech (TTS_API_KEY, TTS_BASE_URL,
 *           TTS_MODEL, default gpt-4o-mini-tts)
 *   off     the browser's own voices speak
 * Rendered lines are cached on disk (.cache/voices), so a line is paid for once.
 */
const GMI_URL = 'https://api.gmi-serving.com/v1';
const MAX_TEXT = 400, MAX_HISTORY = 10, MAX_BODY = 16_384;
const PER_MINUTE = 20;
const HEDGE_MS = 2_500;

const clip = (v, n = 160) => (typeof v === 'string' ? v.slice(0, n) : '');

export function systemPrompt(id, context = {}) {
  const c = CHARACTERS[id];
  const now = [
    context.clock && `It is ${clip(context.clock, 20)} (${clip(context.phase, 20)}).`,
    context.district && `You and the visitor are at ${clip(context.district, 60)}.`,
    context.quest && `The visitor's current task: "${clip(context.quest, 80)} — ${clip(context.objective)}".`,
    context.carrying && `They are carrying: ${clip(context.carrying, 120)}.`,
  ].filter(Boolean).join(' ');
  return `You are ${c.name} (${c.hi}), ${c.role} in Chandrapur. ${c.persona}

${WORLD_BRIEF}

Right now: ${now || 'it is the day of the Mela.'}

How you speak:
- Stay in character as ${c.name}. Your words are spoken aloud, so answer in 1 to 3 short sentences, under 45 words.
- Warm Indian English with a few natural Hindi words (arre, haan, accha, beta, ji). If the visitor writes in Hindi, answer in simple Hinglish in Latin script. No Devanagari, emoji, markdown or stage directions.
- If the visitor seems unsure what to do, nudge them toward their current task with directions that use the places above.
- Never invent quests, items, people or places that are not described above. If asked about the world outside the valley, phones, or whether you are an AI, deflect playfully in character.`;
}

function clean(text) {
  return String(text ?? '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/[*_#`]/g, '')
    .replace(/^\s*["“]|["”]\s*$/g, '')
    .trim()
    .slice(0, 600);
}

const GMI_QUEUE = 'https://console.gmicloud.ai/api/v1/ie/requestqueue/apikey/requests';
const DEFAULT_CACHE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '.cache', 'voices');
// OpenAI-style voices by gender, a stable pick per villager
const OPENAI_VOICES = { male: ['ash', 'onyx', 'echo', 'ballad', 'verse'], female: ['coral', 'sage', 'shimmer', 'nova'] };
const stable = (id) => [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 0) >>> 0;

/** How to perform a villager's lines, for speech models that take direction. */
export function actingNote(id) {
  const c = CHARACTERS[id], v = c.voice;
  const pace = v.rate < 0.9 ? 'slowly, unhurried' : v.rate > 1.08 ? 'briskly, with energy' : 'at an easy conversational pace';
  return `${c.cast.acting} Natural Indian English with a North Indian accent; say Hindi words (arre, beta, ji, haan, accha) natively. Speak ${pace}, like a real person chatting, not a narrator.`;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function createVoiceBox(env = process.env) {
  const provider = env.TTS_PROVIDER || (env.TTS_API_KEY ? 'openai' : env.GMI_API_KEY ? 'gmi' : 'off');
  const key = provider === 'gmi' ? env.TTS_API_KEY || env.GMI_API_KEY : env.TTS_API_KEY;
  const enabled = provider !== 'off' && !!key;
  const studioModel = env.TTS_MODEL || (provider === 'gmi' ? 'inworld-tts-2' : 'gpt-4o-mini-tts');
  const liveModel = env.TTS_LIVE_MODEL || (provider === 'gmi' && !env.TTS_MODEL ? 'inworld-tts-2-flash' : studioModel);
  const cacheDir = env.TTS_CACHE_DIR || DEFAULT_CACHE;
  const openai = enabled && provider === 'openai' ? new OpenAI({ apiKey: key, baseURL: env.TTS_BASE_URL || undefined, timeout: 20_000, maxRetries: 1 }) : null;

  async function viaGmi(id, text, model) {
    const c = CHARACTERS[id];
    const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
    const payload = { text, voice_id: c.cast.voice, language: 'en-IN', audio_encoding: 'MP3', sample_rate_hertz: 24000, bit_rate: 64000,
      speaking_rate: Math.max(0.5, Math.min(1.5, c.voice.rate)), ...(c.cast.pitch ? { pitch: c.cast.pitch } : {}),
      ...(!/flash/.test(model) ? { instruction: actingNote(id) } : {}) };
    let job = await fetchJson(GMI_QUEUE, { method: 'POST', headers, body: JSON.stringify({ model, payload }) });
    for (let i = 0; i < 80 && !/success|fail|error|cancel/i.test(job.status ?? ''); i++) {
      await wait(250);
      job = await fetchJson(`${GMI_QUEUE}/${encodeURIComponent(job.request_id)}`, { headers });
    }
    const url = job.outcome?.audio_url ?? job.outcome?.media?.[0]?.url;
    if (!/success/i.test(job.status ?? '') || !url?.startsWith('https://')) throw Object.assign(new Error(`tts ${job.status ?? 'failed'}`), { status: 502 });
    const res = await fetch(url);
    if (!res.ok) throw Object.assign(new Error(`tts download ${res.status}`), { status: 502 });
    return Buffer.from(await res.arrayBuffer());
  }
  async function fetchJson(url, init) {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(body.error ?? body.message ?? `HTTP ${res.status}`), { status: res.status });
    return body;
  }
  async function viaOpenAI(id, text, model) {
    const list = OPENAI_VOICES[CHARACTERS[id].voice.gender] ?? OPENAI_VOICES.male;
    const res = await openai.audio.speech.create({ model, voice: list[stable(id) % list.length], input: text, response_format: 'mp3', instructions: actingNote(id) });
    return Buffer.from(await res.arrayBuffer());
  }

  /** live: a conversation reply, where speed beats direction (TTS_LIVE_MODEL). */
  async function speak(id, rawText, { live = false } = {}) {
    const model = live ? liveModel : studioModel;
    const text = clip(rawText, MAX_TEXT).trim();
    const c = CHARACTERS[id];
    const hash = crypto.createHash('sha1').update(JSON.stringify([provider, model, c.cast, c.voice.rate, actingNote(id), text])).digest('hex');
    const file = path.join(cacheDir, `${id}-${hash.slice(0, 16)}.mp3`);
    try { return await fs.readFile(file); } catch { /* not rendered yet */ }
    const audio = provider === 'gmi' ? await viaGmi(id, text, model) : await viaOpenAI(id, text, model);
    await fs.mkdir(cacheDir, { recursive: true }).then(() => fs.writeFile(file, audio)).catch(() => {});
    return audio;
  }
  return { enabled, provider, model: studioModel, liveModel, speak };
}

export function createNpcBrain(env = process.env) {
  const apiKey = env.LLM_API_KEY || env.GMI_API_KEY;
  const baseURL = env.LLM_BASE_URL || (env.LLM_API_KEY ? undefined : env.GMI_API_KEY ? GMI_URL : undefined);
  const model = env.LLM_MODEL || env.GMI_MODEL || 'gpt-4o-mini';
  const client = apiKey ? new OpenAI({ apiKey, baseURL, timeout: 15_000, maxRetries: 0 }) : null;

  async function reply({ npc, message, history = [], context = {} }) {
    const messages = [{ role: 'system', content: systemPrompt(npc, context) }];
    for (const h of history.slice(-MAX_HISTORY)) {
      if ((h?.role === 'user' || h?.role === 'assistant') && typeof h.text === 'string') messages.push({ role: h.role, content: clip(h.text, MAX_TEXT) });
    }
    messages.push({ role: 'user', content: clip(message, MAX_TEXT) });
    return clean(await hedged((signal) => client.chat.completions.create({ model, messages, temperature: 0.8, max_tokens: 220 }, { signal })
      .then((res) => res.choices?.[0]?.message?.content)));
  }

  // A fast model answers in ~2 s, but now and then a request stalls for 20 s+.
  // If the first ask hasn't answered by HEDGE_MS, ask again and take whichever
  // answers first; the loser is aborted.
  async function hedged(ask) {
    const runs = [];
    const start = () => { const c = new AbortController(); runs.push(c); return ask(c.signal); };
    const first = start();
    const second = new Promise((resolve, reject) => {
      const timer = setTimeout(() => start().then(resolve, reject), HEDGE_MS);
      first.then(() => clearTimeout(timer), () => {});
    });
    try { return await Promise.any([first, second]); }
    catch (e) { throw e.errors?.[0] ?? e; }
    finally { for (const c of runs) c.abort(); }
  }

  return { enabled: !!client, model, reply };
}

/** Connect-style middleware (Vite dev/preview and server/serve.mjs). */
export function npcApi(env = process.env) {
  const brain = createNpcBrain(env), voiceBox = createVoiceBox(env);
  const hits = new Map();
  function limited(ip) {
    const now = Date.now(), list = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
    list.push(now); hits.set(ip, list);
    return list.length > PER_MINUTE;
  }
  const send = (res, code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };

  async function readJson(req, res) {
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > MAX_BODY) { send(res, 413, { error: 'too long' }); return null; } }
    return JSON.parse(raw || '{}');
  }
  async function tts(req, res) {
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
    if (!voiceBox.enabled) return send(res, 503, { error: 'no-tts' });
    if (limited(req.socket?.remoteAddress ?? 'local')) return send(res, 429, { error: 'Too many lines — take a breath.' });
    try {
      const body = await readJson(req, res); if (!body) return;
      if (!CHARACTERS[body.npc] || typeof body.text !== 'string' || !body.text.trim()) return send(res, 400, { error: 'who says what?' });
      const audio = await voiceBox.speak(body.npc, body.text, { live: true });
      res.statusCode = 200; res.setHeader('Content-Type', 'audio/mpeg'); res.setHeader('Content-Length', audio.length); res.end(audio);
    } catch (e) {
      console.warn('[tts]', e?.status ?? '', e?.message ?? e);
      send(res, 502, { error: 'voice unavailable' });
    }
  }

  return async function npcMiddleware(req, res, next) {
    const url = req.url?.split('?')[0];
    if (url === '/api/npc/status' && req.method === 'GET') return send(res, 200, { enabled: brain.enabled, tts: voiceBox.enabled });
    if (url === '/api/tts') return tts(req, res);
    if (url !== '/api/npc') return next();
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
    if (!brain.enabled) return send(res, 503, { error: 'no-llm', hint: 'Set LLM_API_KEY (and LLM_BASE_URL / LLM_MODEL) in .env' });
    if (limited(req.socket?.remoteAddress ?? 'local')) return send(res, 429, { error: 'Too many questions — take a breath.' });

    try {
      const body = await readJson(req, res); if (!body) return;
      if (!CHARACTERS[body.npc]) return send(res, 400, { error: 'unknown villager' });
      if (typeof body.message !== 'string' || !body.message.trim()) return send(res, 400, { error: 'say something' });
      const text = await brain.reply({ npc: body.npc, message: body.message, history: Array.isArray(body.history) ? body.history : [], context: body.context ?? {} });
      if (!text) return send(res, 502, { error: 'empty reply' });
      send(res, 200, { reply: text });
    } catch (e) {
      console.warn('[npc]', e?.status ?? '', e?.message ?? e);
      send(res, e?.status === 401 ? 503 : 502, { error: e?.status === 401 ? 'no-llm' : 'The villager is lost in thought.' });
    }
  };
}
