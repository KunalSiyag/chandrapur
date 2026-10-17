/**
 * Chandpur's sound: a generative raga for the day — tanpura drone, a breathy
 * bansuri improvising phrases in Raag Bhupali (Sa Re Ga Pa Dha), a soft
 * tabla theka — birdsong by day, crickets by night, and the original moon
 * lullaby (public/audio/moon.mp3) for the finale. Plus game sound effects.
 * WebAudio only; it all starts on the first user gesture.
 */
export function createMusic() {
  let ctx = null, master = null, musicBus = null, sfxBus = null, ambBus = null, reverb = null;
  let playing = false, started = false, lullaby = null, lullabyGain = null, night = 0;
  const SA = 196; // G3 — a comfortable bansuri tonic
  const BHUPALI = [0, 2, 4, 7, 9]; // semitones: Sa Re Ga Pa Dha
  const ratio = (semi) => Math.pow(2, semi / 12);

  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
    reverb = ctx.createConvolver(); reverb.buffer = impulse(2.6); const wet = ctx.createGain(); wet.gain.value = 0.32; reverb.connect(wet).connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master); musicBus.connect(reverb);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master); sfxBus.connect(reverb);
    ambBus = ctx.createGain(); ambBus.gain.value = 0.35; ambBus.connect(master);
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

  async function startLullaby() {
    ensure();
    try {
      if (!lullaby) {
        const res = await fetch('audio/moon.mp3'); if (!res.ok) return;
        const buf = await ctx.decodeAudioData(await res.arrayBuffer());
        lullabyGain = ctx.createGain(); lullabyGain.gain.value = 0; lullabyGain.connect(master);
        lullaby = ctx.createBufferSource(); lullaby.buffer = buf; lullaby.loop = true; lullaby.connect(lullabyGain); lullaby.start();
      }
      lullabyGain.gain.setTargetAtTime(0.8, ctx.currentTime, 1.5);
      musicBus.gain.setTargetAtTime(0.12, ctx.currentTime, 1.5);
    } catch { /* the raga keeps playing */ }
  }
  function stopLullaby() {
    if (!ctx || !lullabyGain) return;
    lullabyGain.gain.setTargetAtTime(0, ctx.currentTime, 1.2);
    musicBus.gain.setTargetAtTime(0.55, ctx.currentTime, 1.2);
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
  }
  async function pause() {
    playing = false; clearInterval(interval);
    if (ctx && ctx.state === 'running') await ctx.suspend();
  }
  return {
    play, pause, sfx, startLullaby, stopLullaby,
    async toggle() { if (playing) { await pause(); return false; } await play(); return true; },
    setVolume(v) { ensure(); master.gain.value = v; },
    setNight(n) { night = n; },
    tick(dt) { ambient(dt); },
    get playing() { return playing; },
  };
}
