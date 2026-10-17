import OpenAI from 'openai';
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
 * villager's voice by an OpenAI-compatible speech model (TTS_API_KEY,
 * TTS_BASE_URL, TTS_MODEL). Without it the browser's own voices speak.
 */
const GMI_URL = 'https://api.gmi-serving.com/v1';
const MAX_TEXT = 400, MAX_HISTORY = 10, MAX_BODY = 16_384;
const PER_MINUTE = 20;

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

// neural voices by gender; each villager gets a stable pick
const VOICES = { male: ['ash', 'onyx', 'echo', 'ballad', 'verse'], female: ['coral', 'sage', 'shimmer', 'nova'] };
const stable = (id) => [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 0) >>> 0;

export function createVoiceBox(env = process.env) {
  const apiKey = env.TTS_API_KEY;
  const client = apiKey ? new OpenAI({ apiKey, baseURL: env.TTS_BASE_URL || undefined, timeout: 20_000, maxRetries: 1 }) : null;
  const model = env.TTS_MODEL || 'gpt-4o-mini-tts';
  async function speak(id, text) {
    const c = CHARACTERS[id], v = c.voice;
    const list = VOICES[v.gender] ?? VOICES.male;
    const pace = v.rate < 0.9 ? 'slowly and unhurried' : v.rate > 1.08 ? 'briskly and with energy' : 'at an easy pace';
    const res = await client.audio.speech.create({
      model, voice: list[stable(id) % list.length], input: clip(text, MAX_TEXT), response_format: 'mp3',
      instructions: `You are ${c.name}, ${c.role} in a small North Indian railway town. ${c.persona} Speak natural Indian English with a warm North Indian accent, pronouncing Hindi words (arre, beta, ji, haan) natively. Speak ${pace}${v.pitch < 0.8 ? ', in a low, aged voice' : v.pitch > 1.4 ? ', like an excited nine-year-old child' : ''}. Sound like a real person chatting, not a narrator.`,
    });
    return Buffer.from(await res.arrayBuffer());
  }
  return { enabled: !!client, speak };
}

export function createNpcBrain(env = process.env) {
  const apiKey = env.LLM_API_KEY || env.GMI_API_KEY;
  const baseURL = env.LLM_BASE_URL || (env.LLM_API_KEY ? undefined : env.GMI_API_KEY ? GMI_URL : undefined);
  const model = env.LLM_MODEL || env.GMI_MODEL || 'gpt-4o-mini';
  const client = apiKey ? new OpenAI({ apiKey, baseURL, timeout: 20_000, maxRetries: 1 }) : null;

  async function reply({ npc, message, history = [], context = {} }) {
    const messages = [{ role: 'system', content: systemPrompt(npc, context) }];
    for (const h of history.slice(-MAX_HISTORY)) {
      if ((h?.role === 'user' || h?.role === 'assistant') && typeof h.text === 'string') messages.push({ role: h.role, content: clip(h.text, MAX_TEXT) });
    }
    messages.push({ role: 'user', content: clip(message, MAX_TEXT) });
    const res = await client.chat.completions.create({ model, messages, temperature: 0.8, max_tokens: 220 });
    return clean(res.choices?.[0]?.message?.content);
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
      const audio = await voiceBox.speak(body.npc, body.text);
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
