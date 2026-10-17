import { lineKey } from '../game/characters.js';

/**
 * The villagers' voices, best first:
 *   1. pre-rendered neural lines (public/audio/voices, tools/render-voices.mjs)
 *      for everything scripted: instant, and they work on a static deploy
 *   2. live neural speech from the server (/api/tts) for free conversation
 *   3. the browser's speech synthesis, with a per-person voice, pitch and pace
 *      (Chrome and Edge ship the best Indian-English and Hindi voices)
 * Speech recognition hears what the visitor says back. The game still works
 * as text when none of it is available.
 */
const PREF_KEY = 'chandrapur-voices';
const FEMALE = /female|woman|heera|neerja|swara|kalpana|veena|lekha|aditi|raveena|zira|samantha|karen|moira|tessa/i;
const MALE = /\bmale\b|\bman\b|ravi|prabhat|madhur|hemant|rishi|david|daniel|alex|fred|george|mark/i;

function hash(s) { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); }

export function createVoice({ onSpeaking } = {}) {
  const synth = window.speechSynthesis ?? null;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  let voices = [], speaking = 0, recognizer = null, neural = null, clip = null, token = 0;
  const rendered = fetch('audio/voices/manifest.json').then((r) => r.json()).then((m) => new Set(m.lines)).catch(() => new Set());
  let enabled = (() => { try { return localStorage.getItem(PREF_KEY) !== 'off'; } catch { return true; } })();

  const load = () => { voices = synth?.getVoices() ?? []; };
  load(); synth?.addEventListener?.('voiceschanged', load);

  /** Indian English first, then Hindi, then any English; split by gender, varied per person. */
  function pickVoice(gender, id) {
    const rank = (v) => (/en[-_]IN/i.test(v.lang) ? 0 : /hi[-_]IN/i.test(v.lang) ? 1 : /^en/i.test(v.lang) ? 2 : 9);
    const pool = voices.filter((v) => rank(v) < 9);
    if (!pool.length) return null;
    const best = Math.min(...pool.map(rank));
    const tier = pool.filter((v) => rank(v) === best);
    const fits = tier.filter((v) => (gender === 'female' ? FEMALE.test(v.name) : MALE.test(v.name) && !FEMALE.test(v.name)));
    const list = fits.length ? fits : tier;
    return list[hash(id) % list.length];
  }

  function forSpeech(text) {
    return text.replace(/[…—–]/g, ', ').replace(/\s+/g, ' ').trim();
  }

  async function neuralOn() {
    if (neural === null) { try { neural = (await (await fetch('api/npc/status')).json()).tts === true; } catch { neural = false; } }
    return neural;
  }
  function started() { speaking++; onSpeaking?.(true); }
  function ended() { speaking = Math.max(0, speaking - 1); if (!speaking) onSpeaking?.(false); }

  /** Play one audio clip as the current line; resolves false if it would not play. */
  function playClip(url, onDone) {
    const a = new Audio(url); clip = a;
    return new Promise((resolve) => {
      let fin = false, played = false;
      const done = () => { if (fin) return; fin = true; if (clip === a) clip = null; onDone?.(); if (played) ended(); resolve(played); };
      a.onended = done; a.onerror = done; a.onpause = done;
      a.play().then(() => { played = true; started(); }).catch(done);
    });
  }

  /** A villager's line through the server's speech model; false if it could not. */
  async function speakNeural(text, id, mine) {
    try {
      const res = await fetch('api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ npc: id, text }) });
      if (!res.ok) return false;
      const url = URL.createObjectURL(await res.blob());
      if (mine !== token) { URL.revokeObjectURL(url); return true; }
      return playClip(url, () => URL.revokeObjectURL(url));
    } catch { return false; }
  }

  async function speak(text, character = {}, id = '') {
    if (!enabled || !text) return;
    cancel();
    const mine = ++token;
    if (id) {
      const key = lineKey(id, text);
      if ((await rendered).has(key)) {
        if (mine !== token) return;
        if (await playClip(`audio/voices/${key}.mp3`)) return;
      }
      if (mine !== token) return;
      if (await neuralOn() && await speakNeural(text, id, mine)) return;
    }
    if (mine !== token) return;
    return speakBrowser(text, character, id);
  }

  function speakBrowser(text, { gender = 'male', pitch = 1, rate = 1 } = {}, id = '') {
    if (!synth) return Promise.resolve();
    synth.cancel();
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(forSpeech(text));
      const v = pickVoice(gender, id);
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-IN';
      // voices without a gendered option still get a lift or drop from pitch
      u.pitch = Math.max(0.1, Math.min(2, pitch * (v && gender === 'female' && !FEMALE.test(v.name) ? 1.25 : 1)));
      u.rate = Math.max(0.5, Math.min(1.6, rate));
      let on = false;
      const done = () => { if (on) { on = false; ended(); } resolve(); };
      u.onstart = () => { on = true; started(); };
      u.onend = done; u.onerror = done;
      synth.speak(u);
    });
  }

  function cancel() {
    token++;
    clip?.pause(); clip = null;
    synth?.cancel();
    if (speaking) { speaking = 0; onSpeaking?.(false); }
  }

  /** Listen once; resolves with the final transcript ('' when nothing was heard). */
  function listen({ lang = 'en-IN', onInterim } = {}) {
    if (!Recognition) return Promise.reject(new Error('unsupported'));
    stopListening();
    cancel();
    return new Promise((resolve, reject) => {
      const r = new Recognition();
      r.lang = lang; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
      let finalText = '';
      r.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalText += t; else interim += t;
        }
        onInterim?.((finalText + interim).trim());
      };
      r.onerror = (e) => { recognizer = null; if (e.error === 'no-speech' || e.error === 'aborted') resolve(''); else reject(new Error(e.error)); };
      r.onend = () => { recognizer = null; resolve(finalText.trim()); };
      recognizer = r;
      r.start();
    });
  }
  function stopListening() { recognizer?.stop(); }

  return {
    speak, cancel, listen, stopListening,
    get canSpeak() { return !!synth; },
    get canListen() { return !!Recognition; },
    get listening() { return !!recognizer; },
    get enabled() { return enabled; },
    set enabled(on) {
      enabled = on; if (!on) cancel();
      try { localStorage.setItem(PREF_KEY, on ? 'on' : 'off'); } catch { /* not saved */ }
    },
  };
}
