import { CHARACTERS, HINTS } from './characters.js';

/**
 * Free conversation with a villager: the visitor speaks (microphone) or
 * types, the villager answers in character — knowing the hour, where you
 * are, and what you are meant to be doing — and says it aloud.
 *
 * Answers come from /api/npc (server/npc-brain.mjs, any OpenAI-compatible
 * model). When that is not configured, or the game is served as static
 * files, an offline villager answers from their own lines and quest hints.
 */
const MAX_TURNS = 10;

export function createConversation({ hud, voice, npcs, context }) {
  const histories = new Map();
  let open = null, online = null, busy = false;

  async function checkOnline() {
    if (online !== null) return online;
    try { online = (await (await fetch('api/npc/status')).json()).enabled === true; } catch { online = false; }
    return online;
  }

  function offlineReply(n, text, ctx) {
    const t = text.toLowerCase();
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    for (const [id, c] of Object.entries(CHARACTERS)) {
      const first = c.name.toLowerCase().replace(/ (ji|kaka|didi|devi|tai)$/, '').split(' ').pop();
      if (id !== n.id && HINTS[id] && (t.includes(first) || t.includes(c.name.toLowerCase()))) return `${c.name}? ${HINTS[id]}`;
    }
    if (/\b(where|kahan|kidhar|what now|what should|next|lost|help|kya karu|kya karna)\b/.test(t)) return `Arre, don't worry. ${ctx.objective}. Follow the saffron marker, you can't miss it.`;
    if (/\b(moon|chand|chanda)\b/.test(t)) return 'They say on Mela night the moon comes down to the ghats. Light the diyas and see for yourself!';
    if (/\b(mela|fair|festival)\b/.test(t)) return 'The Fasal Mela begins when the shrine bell rings at dusk. The whole valley comes down to the river!';
    if (/\b(namaste|namaskar|hello|hi|hey|ram ram|salaam)\b/.test(t)) return `Namaste, namaste! ${pick(n.idle)}`;
    if (/\b(thank|shukriya|dhanyavaad)\b/.test(t)) return 'Arre, no thanks needed. You are one of us today!';
    return pick(n.idle);
  }

  async function ask(text) {
    if (!open || busy || !text.trim()) return;
    const n = open.npc, history = open.history, ctx = context();
    busy = true; hud.chat.you(text); hud.chat.status(`${n.name} is thinking…`);
    let reply = null;
    if (await checkOnline()) {
      try {
        const res = await fetch('api/npc', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ npc: n.id, message: text, history, context: ctx }) });
        const body = await res.json().catch(() => ({}));
        if (res.ok) reply = body.reply;
        else if (body.error === 'no-llm') online = false;
      } catch { /* fall through to the offline villager */ }
    }
    reply ||= offlineReply(n, text, ctx);
    busy = false;
    if (!open || open.npc !== n) return;
    history.push({ role: 'user', text }, { role: 'assistant', text: reply });
    if (history.length > MAX_TURNS * 2) history.splice(0, history.length - MAX_TURNS * 2);
    hud.chat.status('');
    hud.dialog({ name: n.name, hi: n.hi, role: n.role, color: n.color, text: reply, chat: true });
    npcs.setTalking(n);
    voice.speak(reply, n.voice, n.id);
  }

  async function listen() {
    if (!open) return;
    if (voice.listening) { voice.stopListening(); return; }
    hud.chat.listening(true); hud.chat.status('Listening… speak now');
    try {
      const heard = await voice.listen({ onInterim: (t) => hud.chat.status(t ? `“${t}”` : 'Listening… speak now') });
      hud.chat.listening(false); hud.chat.status('');
      if (heard) ask(heard); else hud.chat.status('Didn’t catch that — try again or type instead.');
    } catch (e) {
      hud.chat.listening(false);
      hud.chat.status(e.message === 'not-allowed' ? 'Microphone blocked — allow it in the address bar, or type instead.' : 'The microphone isn’t available here — type instead.');
    }
  }

  return {
    get open() { return !!open; },
    async start(n) {
      if (!histories.has(n.id)) histories.set(n.id, []);
      open = { npc: n, history: histories.get(n.id) };
      npcs.setTalking(n);
      const greet = histories.get(n.id).length ? 'Haan? Tell me.' : `Haan, ji? Ask me anything.`;
      hud.dialog({ name: n.name, hi: n.hi, role: n.role, color: n.color, text: greet, chat: true });
      hud.chat.open({ canListen: voice.canListen, onSend: ask, onMic: listen, onClose: () => this.close() });
      if (!(await checkOnline())) hud.chat.status('Offline villagers — add an LLM key to .env for free conversation.');
      voice.speak(greet, n.voice, n.id);
    },
    close() {
      if (!open) return;
      voice.stopListening(); voice.cancel();
      open = null; busy = false;
      hud.chat.close(); hud.dialog(null); npcs.setTalking(null);
    },
  };
}
