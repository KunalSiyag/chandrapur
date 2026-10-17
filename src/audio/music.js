/**
 * Chandrapur's sound. The score is recorded music rendered with ACE-Step
 * (music/songs/*.json -> public/audio/*.mp3): a daytime bansuri/santoor bed,
 * an optional night piece, and the song "Chanda Utar Aa" for the moon
 * finale, with timed lyrics. Between pieces, or when a file is missing, a
 * generative raga fills in — tanpura drone, a breathy bansuri improvising in
 * Raag Bhupali (Sa Re Ga Pa Dha), a soft tabla theka. Under it all runs a
 * field-recording-style ambience: wind, the river, birds by day, crickets by
 * night. Music ducks while a villager speaks. Plus game sound effects.
 * WebAudio only; it all starts on the first user gesture.
 */
const TRACKS = {
  day: 'audio/chandrapur-din.mp3',
  night: 'audio/ghat-ki-raat.mp3',
  song: 'audio/chanda-utar-aa.mp3',
};
const LYRICS = 'audio/chanda-utar-aa.lyrics.json';
const RAGA_LEVEL = 0.55, BED_LEVEL = 0.42, SONG_LEVEL = 0.95;

export function createMusic() {
  let ctx = null, master = null, musicBus = null, trackBus = null, musicOut = null, sfxBus = null, ambBus = null, reverb = null;
  let playing = false, started = false, night = 0;
  const SA = 196; // G3 — a comfortable bansuri tonic
  const BHUPALI = [0, 2, 4, 7, 9]; // semitones: Sa Re Ga Pa Dha
  const ratio = (semi) => Math.pow(2, semi / 12);

  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
    reverb = ctx.createConvolver(); reverb.buffer = impulse(2.6); const wet = ctx.createGain(); wet.gain.value = 0.32; reverb.connect(wet).connect(master);
    musicOut = ctx.createGain(); musicOut.connect(master); // ducked under speech
    musicBus = ctx.createGain(); musicBus.gain.value = RAGA_LEVEL; musicBus.connect(musicOut); musicBus.connect(reverb);
    trackBus = ctx.createGain(); trackBus.connect(musicOut);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master); sfxBus.connect(reverb);
    ambBus = ctx.createGain(); ambBus.gain.value = 0.35; ambBus.connect(master);
    startAir();
  }
  function impulse(seconds) {
    const n = Math.floor(ctx.sampleRate * seconds), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
    return b;
  }
  function noiseBuffer(seconds = 1) {
    const n = Math.floor(ctx.sampleRate * seconds), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  // ---------------------------------------------------------------- tanpura: Pa Sa' Sa' Sa, plucked in a slow cycle
  function tanpuraPluck(freq, when) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.value = freq; o2.frequency.value = freq * 1.003;
    f.type = 'bandpass'; f.frequency.setValueAtTime(freq * 6, when); f.frequency.linearRampToValueAtTime(freq * 3, when + 3); f.Q.value = 1.2;
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(0.05, when + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, when + 4.2);
    o.connect(f); o2.connect(f); f.connect(g).connect(musicBus);
    o.start(when); o2.start(when); o.stop(when + 4.3); o2.stop(when + 4.3);
  }
  // ---------------------------------------------------------------- bansuri: sine + breath, glides (meend) and vibrato
  function flute(freq, when, dur, from = null) {
    const o = ctx.createOscillator(), g = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain();
    o.type = 'sine';
    if (from) { o.frequency.setValueAtTime(from, when); o.frequency.exponentialRampToValueAtTime(freq, when + Math.min(0.18, dur * 0.4)); }
    else o.frequency.setValueAtTime(freq, when);
    vib.frequency.value = 5.2; vg.gain.setValueAtTime(0, when); vg.gain.linearRampToValueAtTime(freq * 0.012, when + dur * 0.6);
    vib.connect(vg).connect(o.frequency);
    const h = ctx.createOscillator(), hg = ctx.createGain(); h.type = 'sine'; h.frequency.value = freq * 2; hg.gain.value = 0.12;
    h.connect(hg).connect(g);
    const breath = ctx.createBufferSource(); breath.buffer = noiseBuffer(dur + 0.2);
    const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = freq * 2.2; bf.Q.value = 3; const bg = ctx.createGain(); bg.gain.value = 0.05;
    breath.connect(bf).connect(bg).connect(g);
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(0.11, when + 0.08); g.gain.setValueAtTime(0.1, when + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.15);
    o.connect(g); g.connect(musicBus);
    for (const n of [o, vib, h, breath]) { n.start(when); n.stop(when + dur + 0.2); }
  }
  // ---------------------------------------------------------------- tabla: bayan (low thump with pitch bend) + dayan (ringing tin)
  function bayan(when, v = 1) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(95, when); o.frequency.exponentialRampToValueAtTime(70, when + 0.25);
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(0.32 * v, when + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.45);
    o.connect(g).connect(musicBus); o.start(when); o.stop(when + 0.5);
  }
  function dayan(when, v = 1, open = true) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = SA * 2;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = SA * 2 * 2.7;
    const g2 = ctx.createGain(); g2.gain.value = 0.3; o2.connect(g2).connect(g);
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(0.14 * v, when + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, when + (open ? 0.35 : 0.08));
    o.connect(g).connect(musicBus); o.start(when); o2.start(when); o.stop(when + 0.4); o2.stop(when + 0.4);
  }

  // ---------------------------------------------------------------- the scheduler
  let nextBar = 0, bar = 0, phrase = [], degree = 0;
  const BEAT = 0.42; // ~143 bpm subdivisions, keherwa-ish 8 beat cycle
  function noteFreq(deg) {
    const oct = Math.floor(deg / 5), idx = ((deg % 5) + 5) % 5;
    return SA * ratio(BHUPALI[idx] + oct * 12);
  }
  function newPhrase() {
    // a meandering phrase that leans on Ga and Pa and resolves to Sa
    const len = 4 + Math.floor(Math.random() * 4), out = [];
    let d = degree;
    for (let i = 0; i < len; i++) {
      d += [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)];
      d = Math.max(0, Math.min(9, d));
      out.push({ deg: d, len: [1, 1, 2, 2, 3][Math.floor(Math.random() * 5)] });
    }
    out.push({ deg: Math.random() > 0.5 ? 5 : 2, len: 4 });
    degree = out.at(-1).deg;
    return out;
  }
  function schedule() {
    if (!playing || !ctx) return;
    while (nextBar < ctx.currentTime + 1.2) {
      const t0 = nextBar, dayMix = 1 - night;
      // tanpura cycle every bar: Pa, Sa', Sa', Sa
      [SA * 1.5 / 2, SA, SA, SA / 2].forEach((f, i) => tanpuraPluck(f, t0 + i * BEAT * 2));
      // keherwa: Dha Ge Na Ti | Na Ke Dhi Na
      if (dayMix > 0.2) {
        const theka = [[1, 1, 1], [0, 0.6, 0], [0, 0.8, 1], [0, 0.5, 0], [0, 0.7, 1], [0.6, 0.5, 0], [1, 0.9, 1], [0, 0.6, 0]];
        theka.forEach(([b, dv, open], i) => { const w = t0 + i * BEAT; if (b) bayan(w, b * dayMix); dayan(w, dv * dayMix * 0.8, !!open); });
      }
      // bansuri phrase on alternate bars, sparser at night
      if (bar % 2 === 0 && Math.random() < 0.85 - night * 0.35) {
        phrase = newPhrase(); let w = t0 + BEAT * 0.5, prev = null;
        for (const n of phrase) {
          const f = noteFreq(n.deg) * (night > 0.5 ? 1 : 2);
          const dur = n.len * BEAT * (night > 0.5 ? 1.5 : 1);
          flute(f, w, dur * 0.95, prev && Math.random() < 0.35 ? prev : null);
          prev = f; w += dur;
        }
      }
      nextBar += BEAT * 8; bar++;
    }
  }
  let ambTimer = 0;
  function ambient(dt) {
    if (!playing || !ctx) return;
    ambTimer -= dt;
    if (ambTimer > 0) return;
    const t = ctx.currentTime;
    if (night < 0.5) {
      // koel-like rising call and sparrow chirps
      ambTimer = 1.5 + Math.random() * 4;
      if (Math.random() < 0.4) { for (let i = 0; i < 3; i++) chirp(t + i * 0.42, 1100 + i * 140, 1500 + i * 180, 0.28, 0.05); }
      else for (let i = 0; i < 4; i++) chirp(t + i * 0.09, 3200 + Math.random() * 900, 4200 + Math.random() * 600, 0.05, 0.03);
    } else {
      ambTimer = 0.25 + Math.random() * 0.4;
      for (let i = 0; i < 3; i++) chirp(t + i * 0.05, 4400, 4500, 0.025, 0.018);
    }
  }
  function chirp(when, f0, f1, dur, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, when); o.frequency.exponentialRampToValueAtTime(f1, when + dur);
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vol, when + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(ambBus); o.start(when); o.stop(when + dur + 0.02);
  }

  // ---------------------------------------------------------------- effects
  const sfx = {
    pick(kind = 'coin') {
      if (!ctx || !playing) return; const t = ctx.currentTime;
      const notes = kind === 'coin' ? [7, 12] : kind === 'mango' ? [4, 9, 12] : [9, 12, 16];
      notes.forEach((s, i) => ping(SA * 4 * ratio(s), t + i * 0.07, 0.35, 0.16));
    },
    talk() { if (!ctx || !playing) return; ping(SA * 3 * ratio([0, 2, 4][Math.floor(Math.random() * 3)]), ctx.currentTime, 0.08, 0.05, 'triangle'); },
    quest() {
      if (!ctx || !playing) return; const t = ctx.currentTime;
      [0, 4, 7, 9, 12, 16].forEach((s, i) => ping(SA * 2 * ratio(s), t + i * 0.11, 0.9, 0.14));
      bell(t + 0.7, 0.4);
    },
    step() { if (!ctx || !playing) return; ping(SA * 2 * ratio(7), ctx.currentTime, 0.25, 0.08); },
    bell(v = 0.6) { if (!ctx || !playing) return; bell(ctx.currentTime, v); },
    whoosh() {
      if (!ctx || !playing) return; const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noiseBuffer(0.6);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2000, t + 0.4); f.Q.value = 1;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      s.connect(f).connect(g).connect(sfxBus); s.start(t);
    },
    firework() {
      if (!ctx || !playing) return; const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noiseBuffer(1.2);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(200, t + 1);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      s.connect(f).connect(g).connect(sfxBus); s.start(t);
    },
  };
  function ping(freq, when, dur, vol, type = 'sine') {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2.01; const g2 = ctx.createGain(); g2.gain.value = 0.25; o2.connect(g2).connect(g);
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vol, when + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(sfxBus); o.start(when); o2.start(when); o.stop(when + dur + 0.05); o2.stop(when + dur + 0.05);
  }
  function bell(when, v) {
    // temple ghanta: inharmonic partials with a long shimmer
    [[1, 1], [2.32, 0.6], [3.93, 0.35], [5.4, 0.22], [6.8, 0.12]].forEach(([r, a]) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = 520 * r;
      g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(v * a * 0.3, when + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, when + 4.5 / r ** 0.3);
      o.connect(g).connect(sfxBus); o.start(when); o.stop(when + 5);
    });
  }

  // ---------------------------------------------------------------- air: wind in the open, the river near the ghats
  let windGain = null, riverGain = null, river = 0;
  function loopNoise(filterType, freq, q) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(4); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(ambBus); src.start();
    return { f, g };
  }
  function startAir() {
    const wind = loopNoise('lowpass', 420, 0.6); windGain = wind.g;
    // gusts: a slow LFO on the cutoff
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 180;
    lfo.connect(lg).connect(wind.f.frequency); lfo.start();
    riverGain = loopNoise('bandpass', 950, 0.7).g;
  }
  function air() {
    const t = ctx.currentTime;
    windGain.gain.setTargetAtTime(0.10 + night * 0.04, t, 2);
    riverGain.gain.setTargetAtTime(river * 0.22, t, 0.8);
  }

  // ---------------------------------------------------------------- the recorded soundtrack
  const tracks = {};
  function track(name) {
    if (tracks[name]) return tracks[name];
    const el = new Audio(TRACKS[name]); el.preload = 'auto';
    const gain = ctx.createGain(); gain.gain.value = 0;
    ctx.createMediaElementSource(el).connect(gain); gain.connect(trackBus);
    const t = { el, gain, ok: true, stopTimer: 0 };
    el.addEventListener('error', () => { t.ok = false; });
    return (tracks[name] = t);
  }
  function fadeIn(t, level, secs) {
    clearTimeout(t.stopTimer);
    t.el.play().catch(() => { t.ok = false; });
    t.gain.gain.setTargetAtTime(level, ctx.currentTime, secs / 3);
  }
  function fadeOut(t, secs) {
    t.gain.gain.setTargetAtTime(0, ctx.currentTime, secs / 3);
    clearTimeout(t.stopTimer); t.stopTimer = setTimeout(() => t.el.pause(), secs * 1000 + 200);
  }
  let ragaLevel = RAGA_LEVEL;
  function setRaga(level) {
    if (level === ragaLevel) return;
    ragaLevel = level; musicBus.gain.setTargetAtTime(level, ctx.currentTime, 1.5);
  }

  // A recorded piece plays through, then the valley rests on ambience and the
  // raga for a while before the next one, like a film score, not a radio.
  let bed = null, rest = 6;
  function bedTick(dt) {
    if (song) { setRaga(0); return; }
    const want = night > 0.55 ? 'night' : 'day', cur = bed && tracks[bed];
    if (cur && (bed !== want || cur.el.ended || !cur.ok)) { fadeOut(cur, 4); bed = null; rest = 30 + Math.random() * 40; }
    if (!bed && (rest -= dt) <= 0) {
      const t = track(want);
      if (t.ok) { t.el.currentTime = 0; fadeIn(t, BED_LEVEL, 4); bed = want; } else rest = 90;
    }
    const sounding = bed && tracks[bed].ok && !tracks[bed].el.paused;
    setRaga(sounding ? 0 : RAGA_LEVEL);
  }

  // The song, with lyric lines handed to the HUD as they come up.
  let song = null, lyrics = null, onLyric = null, lyricIndex = -1;
  async function startSong(lineCallback = null) {
    ensure();
    if (ctx.state === 'suspended') await ctx.resume();
    const t = track('song'); if (!t.ok) return false;
    onLyric = lineCallback; lyricIndex = -1;
    if (!lyrics) lyrics = await fetch(LYRICS).then((r) => r.json()).then((j) => j.lines).catch(() => []);
    if (bed) { fadeOut(tracks[bed], 2.5); bed = null; }
    song = t; setRaga(0);
    t.el.currentTime = 0; fadeIn(t, SONG_LEVEL, 2);
    t.el.onended = () => stopSong();
    return true;
  }
  function stopSong() {
    if (!song) return;
    fadeOut(song, 2.5); song = null; rest = 20;
    if (lyricIndex !== -1) onLyric?.(null);
    lyricIndex = -1;
  }
  function lyricTick() {
    if (!song || !onLyric || !lyrics?.length) return;
    const now = song.el.currentTime;
    let i = -1; while (i + 1 < lyrics.length && lyrics[i + 1].t <= now) i++;
    if (i !== lyricIndex) { lyricIndex = i; onLyric(i >= 0 && lyrics[i].hi ? lyrics[i] : null); }
  }

  let interval = null;
  async function play() {
    ensure();
    if (ctx.state === 'suspended') await ctx.resume();
    if (playing) return;
    playing = true;
    if (!started) { started = true; nextBar = ctx.currentTime + 0.2; }
    else nextBar = Math.max(nextBar, ctx.currentTime + 0.1);
    interval = setInterval(schedule, 250); schedule();
    for (const t of Object.values(tracks)) if (t.resume) { t.resume = false; t.el.play().catch(() => {}); }
  }
  async function pause() {
    playing = false; clearInterval(interval);
    for (const t of Object.values(tracks)) if (!t.el.paused) { t.resume = true; t.el.pause(); }
    if (ctx && ctx.state === 'running') await ctx.suspend();
  }
  return {
    play, pause, sfx, startSong, stopSong,
    async toggle() { if (playing) { await pause(); return false; } await play(); return true; },
    setVolume(v) { ensure(); master.gain.value = v; },
    setNight(n) { night = n; },
    /** 0..1, how close the listener is to running water. */
    setRiver(v) { river = v; },
    /** Lower the music while someone speaks. */
    duck(on) { if (ctx) musicOut.gain.setTargetAtTime(on ? 0.3 : 1, ctx.currentTime, on ? 0.15 : 0.6); },
    tick(dt) { if (!playing || !ctx) return; ambient(dt); air(); bedTick(dt); lyricTick(); },
    get playing() { return playing; },
    get songPlaying() { return !!song; },
    /** For automated checks: which pieces are loaded, sounding, and where. */
    get debug() {
      return { bed, ragaLevel, song: !!song, lyricIndex,
        tracks: Object.fromEntries(Object.entries(tracks).map(([k, t]) => [k, { ok: t.ok, paused: t.el.paused, time: t.el.currentTime }])) };
    },
    seekSong(seconds) { if (song) song.el.currentTime = seconds; },
  };
}
