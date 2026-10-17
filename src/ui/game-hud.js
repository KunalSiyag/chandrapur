import { FARM_PLOTS, POND, ROUTES, DISTRICTS, riverCentre, riverHalfWidth, groundHeight, RAIL_Z } from '../world/layout.js';
import { oriented, circles } from '../world/colliders.js';

/**
 * Festive game HUD for Chandpur: quest card, compass, minimap and clock,
 * wallet, interaction prompt, dialogue, banners, title screen, help and map.
 * Saffron, marigold, maroon and peacock-teal on warm paper; Baloo 2 type.
 */
const X0 = -112, Z0 = -102, X1 = 96, Z1 = 96, S = 3;
const CROP_COLOR = { wheat: '#e8c35a', mustard: '#ffd21a', marigold: '#ff8c1a', sugarcane: '#5aa83a', vegetable: '#9ad06a', paddy: '#5fc0b0', 'paddy-young': '#8fd8c0' };

const CSS = `
:root { --saffron:#ff8c1a; --marigold:#ffb000; --maroon:#7a1f2b; --paper:#fff6e2; --ink:#2b1a12; --teal:#0f6e73; --leaf:#1f9a62; --pink:#e8558a; }
.g { position:fixed; inset:0; pointer-events:none; z-index:10; font:500 14px/1.35 'Baloo 2', system-ui, sans-serif; color:var(--ink); }
.g[hidden], .g-title[hidden] { display:none !important; }
.g-panel { background:linear-gradient(180deg,#fffaf0,#fff0d2); border:2px solid #b8452a; border-radius:14px; box-shadow:0 6px 0 #7a1f2b55, 0 10px 30px #2b1a1240; position:relative; }
.g-panel::before { content:''; position:absolute; left:10px; right:10px; top:-9px; height:12px;
  background:radial-gradient(circle at 7px 0, var(--marigold) 5px, transparent 5.5px) 0 0/14px 12px repeat-x; filter:drop-shadow(0 1px 0 #b8452a); }
.g-quest { position:absolute; top:max(18px,env(safe-area-inset-top)); left:18px; width:min(330px,calc(100vw - 230px)); padding:14px 16px 12px; }
.g-quest .chap { font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--maroon); font-weight:700; display:flex; justify-content:space-between; }
.g-quest .title { font-size:20px; font-weight:800; line-height:1.1; margin:2px 0 4px; color:#5a1a14; }
.g-quest .obj { font-size:14px; color:#3b2a20; }
.g-quest .prog { display:flex; align-items:center; gap:8px; margin-top:8px; font-weight:700; }
.g-quest .prog[hidden] { display:none; }
.g-quest .bar { flex:1; height:10px; background:#f1dcb4; border-radius:8px; overflow:hidden; border:1px solid #c9a46a; }
.g-quest .bar i { display:block; height:100%; width:0; background:linear-gradient(90deg,var(--saffron),var(--marigold)); border-radius:8px; transition:width .35s; }
.g-quest .dist { margin-top:6px; font-size:12px; color:var(--teal); font-weight:700; }
.g-compass { position:absolute; top:max(18px,env(safe-area-inset-top)); left:50%; transform:translateX(-50%); width:min(420px,40vw); height:38px; border-radius:20px;
  background:#2b1a12b8; border:2px solid #e6b85a; box-shadow:0 4px 14px #0004; overflow:hidden; }
.g-compass canvas { width:100%; height:100%; display:block; }
.g-tr { position:absolute; top:max(14px,env(safe-area-inset-top)); right:16px; display:flex; flex-direction:column; align-items:center; gap:8px; }
.g-mini { width:176px; height:176px; border-radius:50%; padding:5px; background:conic-gradient(from 0deg,#e6b85a,#a8742a,#ffd77a,#a8742a,#e6b85a); box-shadow:0 6px 18px #0005; }
.g-mini canvas { width:100%; height:100%; border-radius:50%; display:block; background:#8fc25a; }
.g-clock { display:flex; align-items:center; gap:8px; padding:4px 12px 2px; font-weight:800; font-size:16px; }
.g-clock .ico { font-size:18px; }
.g-clock small { font-weight:600; font-size:11px; color:var(--maroon); text-transform:uppercase; letter-spacing:.1em; }
.g-district { text-align:center; text-shadow:0 1px 0 #fff8, 0 0 12px #fff8; }
.g-district .hi { font-size:20px; font-weight:800; color:#fff; text-shadow:0 2px 0 #7a1f2b, 0 0 10px #000a; }
.g-district .en { font-size:12px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#fff; text-shadow:0 1px 3px #000c; }
.g-wallet { position:absolute; left:18px; bottom:max(18px,env(safe-area-inset-bottom)); display:flex; gap:8px; flex-wrap:wrap; max-width:46vw; }
.g-chip { display:flex; align-items:center; gap:6px; padding:5px 12px 3px; border-radius:20px; font-weight:800; font-size:16px; background:#fff6e2f0; border:2px solid #b8452a; box-shadow:0 3px 0 #7a1f2b44; }
.g-chip.r { background:linear-gradient(180deg,#fff3c4,#ffd76a); }
.g-chip[hidden] { display:none; }
.g-chip.pop { animation:pop .35s; }
@keyframes pop { 40% { transform:scale(1.25); } }
.g-prompt { position:absolute; left:50%; bottom:118px; transform:translateX(-50%); display:flex; align-items:center; gap:10px; padding:8px 18px 6px 8px; border-radius:28px;
  background:#2b1a12d8; color:#fff2d0; font-weight:700; font-size:17px; border:2px solid #e6b85a; pointer-events:auto; cursor:pointer; }
.g-prompt[hidden] { display:none; }
.g-key { display:inline-grid; place-items:center; min-width:30px; height:30px; padding:0 6px; border-radius:8px; background:linear-gradient(180deg,#fff,#ffe1a0); color:#5a1a14; font-weight:800; box-shadow:0 3px 0 #a8742a; font-size:15px; }
.g-dialog { position:absolute; left:50%; bottom:max(78px,env(safe-area-inset-bottom)); transform:translateX(-50%); width:min(760px,calc(100vw - 32px)); padding:18px 22px 16px 112px; min-height:96px; pointer-events:auto; cursor:pointer; }
.g-dialog[hidden] { display:none; }
.g-dialog .face { position:absolute; left:18px; top:-26px; width:80px; height:80px; border-radius:50%; display:grid; place-items:center; font-size:36px; font-weight:800; color:#fff; border:4px solid #fff6e2; box-shadow:0 4px 0 #7a1f2b66; }
.g-dialog .who { font-size:19px; font-weight:800; color:#5a1a14; }
.g-dialog .who span { font-size:14px; color:var(--maroon); font-weight:700; margin-left:8px; }
.g-dialog .who em { display:block; font-style:normal; font-size:12px; color:#8a6a4a; font-weight:600; margin-top:-2px; }
.g-dialog .text { font-size:17px; margin-top:6px; min-height:46px; }
.g-dialog .next { position:absolute; right:16px; bottom:10px; font-size:13px; font-weight:800; color:var(--maroon); animation:bob 1s infinite; }
@keyframes bob { 50% { transform:translateY(-3px); } }
.g-notes { position:absolute; right:16px; top:300px; display:flex; flex-direction:column; gap:8px; align-items:flex-end; }
.g-note { padding:6px 14px 4px; border-radius:18px; background:#fff6e2f2; border:2px solid #1f9a62; font-weight:700; box-shadow:0 3px 0 #1f9a6244; animation:slide .4s; }
@keyframes slide { from { transform:translateX(40px); opacity:0; } }
.g-toast { position:absolute; left:50%; top:76px; transform:translateX(-50%); max-width:min(620px,80vw); text-align:center; padding:8px 18px 6px; border-radius:18px; background:#2b1a12d0; color:#fff2d0; font-weight:600; font-size:15px; opacity:0; transition:opacity .3s; }
.g-toast.show { opacity:1; }
.g-banner { position:absolute; left:50%; top:30%; transform:translate(-50%,-50%) scale(.8); text-align:center; opacity:0; transition:opacity .4s, transform .4s; padding:20px 46px 16px; }
.g-banner.show { opacity:1; transform:translate(-50%,-50%) scale(1); }
.g-banner .k { font-size:13px; letter-spacing:.2em; text-transform:uppercase; color:var(--leaf); font-weight:800; }
.g-banner .t { font-size:34px; font-weight:800; color:#5a1a14; line-height:1.05; }
.g-banner .s { font-size:16px; color:var(--maroon); font-weight:700; }
.g-banner .rw { font-size:22px; color:#b8701a; font-weight:800; }
.g-chapter { position:absolute; left:50%; top:24%; transform:translateX(-50%); text-align:center; opacity:0; transition:opacity .8s; color:#fff; text-shadow:0 3px 0 #7a1f2b, 0 0 24px #000a; }
.g-chapter.show { opacity:1; }
.g-chapter .n { font-size:14px; letter-spacing:.3em; text-transform:uppercase; font-weight:700; }
.g-chapter .t { font-size:46px; font-weight:800; line-height:1.05; }
.g-chapter .s { font-size:18px; font-weight:600; }
.g-btns { position:absolute; right:16px; bottom:max(18px,env(safe-area-inset-bottom)); display:flex; gap:8px; pointer-events:auto; }
.g-btn { font:700 14px 'Baloo 2', system-ui, sans-serif; min-height:42px; padding:8px 14px 5px; border-radius:12px; border:2px solid #b8452a; cursor:pointer; color:#5a1a14;
  background:linear-gradient(180deg,#fffaf0,#ffe6b0); box-shadow:0 3px 0 #7a1f2b66; }
.g-btn:hover { background:linear-gradient(180deg,#fff,#ffd27a); }
.g-btn:focus-visible { outline:3px solid #0f6e73; outline-offset:3px; }
.g-btn kbd { font:inherit; font-size:11px; opacity:.7; margin-left:4px; }
.g-fade { position:fixed; inset:0; background:radial-gradient(circle,#ffb04a40,#7a1f2b90); opacity:0; transition:opacity .6s; pointer-events:none; z-index:9; display:grid; place-content:center; color:#fff; font:800 28px 'Baloo 2',sans-serif; text-shadow:0 2px 0 #7a1f2b; }
.g-fade.show { opacity:1; }
.g-title { position:fixed; inset:0; z-index:40; display:grid; place-items:center; background:linear-gradient(180deg,#ff8c1a10 0%,#2b1a1200 40%,#2b1a12a0 100%); font-family:'Baloo 2',system-ui,sans-serif; }
.g-title .card { text-align:center; padding:30px 44px 26px; max-width:min(560px,calc(100vw - 32px)); }
.g-title .hi { font-size:64px; font-weight:800; line-height:1; color:#ff8c1a; text-shadow:0 4px 0 #7a1f2b; }
.g-title .en { font-size:20px; font-weight:800; letter-spacing:.42em; color:#5a1a14; margin-top:6px; }
.g-title .sub { font-size:26px; font-weight:700; color:#0f6e73; margin:2px 0 10px; }
.g-title p { margin:6px 0 18px; font-size:15px; color:#3b2a20; }
.g-title .row { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; }
.g-title .go { font:800 20px 'Baloo 2',sans-serif; padding:12px 28px 9px; border-radius:16px; border:3px solid #7a1f2b; cursor:pointer; color:#fff; background:linear-gradient(180deg,#ffae3a,#ff7a1a); box-shadow:0 5px 0 #7a1f2b; }
.g-title .go.alt { background:linear-gradient(180deg,#2fb07a,#1f8a52); }
.g-title .go:hover { filter:brightness(1.08); }
.g-title .go:focus-visible { outline:3px solid #0f6e73; outline-offset:4px; }
.g-title .keys { margin-top:16px; font-size:13px; color:#5a3a2a; display:grid; grid-template-columns:auto auto; gap:2px 16px; justify-content:center; text-align:left; }
.g-title .keys b { color:#7a1f2b; }
.g-sheet { font:500 15px/1.45 'Baloo 2', system-ui, sans-serif; color:var(--ink); position:fixed; inset:0; z-index:30; display:grid; place-items:center; background:#2b1a1270; }
.g-sheet[hidden] { display:none; }
.g-sheet .g-panel { padding:22px 26px; max-width:min(760px,calc(100vw - 28px)); max-height:calc(100vh - 40px); overflow:auto; pointer-events:auto; }
.g-sheet h2 { margin:0 0 4px; font-size:28px; font-weight:800; color:#5a1a14; }
.g-sheet p { margin:8px 0; }
.g-sheet .close { float:right; }
.g-map canvas { width:min(640px,calc(100vw - 80px)); max-height:70vh; aspect-ratio:${(X1 - X0) / (Z1 - Z0)}; border-radius:10px; border:2px solid #b8452a; display:block; margin-top:8px; }
.g-loader { position:fixed; inset:0; z-index:60; display:grid; place-content:center; gap:10px; text-align:center; background:linear-gradient(180deg,#ffd27a,#ff8c1a); color:#5a1a14; font:800 22px 'Baloo 2',sans-serif; transition:opacity .6s; }
.g-loader .hi { font-size:56px; color:#fff; text-shadow:0 4px 0 #7a1f2b; }
.g-loader.hidden { opacity:0; pointer-events:none; }
.g-loader .spin { width:46px; height:46px; margin:8px auto 0; border-radius:50%; border:6px dotted #7a1f2b; animation:spin 2s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }
@media (max-width:760px) {
  .g-quest { width:calc(100vw - 36px); top:12px; padding:10px 12px 8px; } .g-quest .title { font-size:16px; } .g-quest .obj { font-size:12px; }
  .g-compass { display:none; } .g-tr { top:auto; bottom:76px; right:12px; } .g-mini { width:112px; height:112px; } .g-district { display:none; }
  .g-btns { right:8px; bottom:12px; gap:4px; } .g-btn { padding:6px 8px 4px; font-size:12px; } .g-btn kbd { display:none; }
  .g-wallet { bottom:64px; left:10px; } .g-chip { font-size:13px; } .g-dialog { padding:14px 14px 12px 14px; } .g-dialog .face { display:none; }
  .g-title .hi { font-size:46px; } .g-chapter .t { font-size:30px; } .g-notes { top:150px; }
}
@media (prefers-reduced-motion:reduce) { .g-chip.pop, .g-note, .g-dialog .next, .g-loader .spin { animation:none; } .g-banner, .g-chapter, .g-toast, .g-fade { transition:none; } }
`;

export function createGameHUD({ onMoon, onSound, onCinematic, onInteract, onStart, onRestart, town, hasSave }) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const root = document.createElement('div'); root.className = 'g'; root.hidden = true;
  root.innerHTML = `
    <section class="g-quest g-panel" aria-live="polite"><div class="chap"><span class="c"></span><span class="n"></span></div><div class="title"></div><div class="obj"></div>
      <div class="prog" hidden><span class="ico"></span><div class="bar"><i></i></div><span class="cnt"></span></div><div class="dist"></div></section>
    <div class="g-compass" aria-hidden="true"><canvas width="840" height="76"></canvas></div>
    <div class="g-tr"><div class="g-mini"><canvas width="340" height="340" aria-label="Minimap"></canvas></div>
      <div class="g-clock g-panel"><span class="ico">☀️</span><span class="time">9:00 AM</span><small class="phase">Morning</small></div>
      <div class="g-district"><div class="hi">चंदपुर स्टेशन</div><div class="en">Old Railway Station</div></div></div>
    <div class="g-wallet"><div class="g-chip r" data-w="rupees">₹ <b>0</b></div><div class="g-chip" data-w="coins">🪙 <b>0</b></div>
      <div class="g-chip" data-w="marigold" hidden>🌼 <b>0</b></div><div class="g-chip" data-w="mango" hidden>🥭 <b>0</b></div><div class="g-chip" data-w="laddoo" hidden>🍬 <b>Laddoos</b></div></div>
    <div class="g-prompt" hidden><span class="g-key">E</span><span class="lbl"></span></div>
    <div class="g-dialog g-panel" hidden><div class="face"></div><div class="who"></div><div class="text"></div><div class="next">E ▸</div></div>
    <div class="g-notes"></div>
    <div class="g-toast" role="status"></div>
    <div class="g-banner g-panel" role="status"><div class="k"></div><div class="t"></div><div class="s"></div><div class="rw"></div></div>
    <div class="g-chapter"><div class="n"></div><div class="t"></div><div class="s"></div></div>
    <div class="g-btns">
      <button class="g-btn" data-act="map">Map <kbd>Tab</kbd></button>
      <button class="g-btn" data-act="moon">🌙 Moon <kbd>M</kbd></button>
      <button class="g-btn" data-act="cinema">🎥 <kbd>C</kbd></button>
      <button class="g-btn" data-act="sound" aria-pressed="true">🔊</button>
      <button class="g-btn" data-act="help">? <kbd>H</kbd></button>
    </div>`;
  document.body.appendChild(root);
  const fadeEl = document.createElement('div'); fadeEl.className = 'g-fade'; fadeEl.textContent = '⏳ समय बीतता है · time passes…'; document.body.appendChild(fadeEl);

  // ---------------------------------------------------------------- loader + title
  const loader = document.createElement('div'); loader.className = 'g-loader';
  loader.innerHTML = '<div class="hi">चंदपुर</div><div>Sowing the mustard, stringing the bunting…</div><div class="spin"></div>';
  document.body.appendChild(loader);
  const title = document.createElement('div'); title.className = 'g-title';
  title.innerHTML = `<div class="card g-panel"><div class="hi">चंदपुर</div><div class="en">CHANDPUR</div><div class="sub">Get You the Moon</div>
    <p>A harvest-fair day in a little Indian railway town. Help the villagers get ready for the <b>Fasal Mela</b> — gather marigolds and mangoes, wander the mustard fields and paddies, fly the balloon, ring the shrine bell at dusk… and bring down the moon.</p>
    <div class="row"><button class="go" data-start="new">▶ Begin the Day</button><button class="go alt" data-start="continue" hidden>Continue</button></div>
    <div class="keys"><b>WASD</b><span>walk · <b>Shift</b> run · <b>Space</b> jump</span><b>Mouse</b><span>click the world, then look around</span><b>E</b><span>talk · interact · board the balloon</span><b>Tab / M / C</b><span>map · moon · cinema</span></div></div>`;
  document.body.appendChild(title);
  if (hasSave?.()) title.querySelector('[data-start="continue"]').hidden = false;
  title.addEventListener('click', (e) => {
    const b = e.target.closest('[data-start]'); if (!b) return;
    title.hidden = true; root.hidden = false; onStart?.(b.dataset.start === 'new');
  });

  // ---------------------------------------------------------------- help + map sheets
  const help = sheet('help', `<button class="g-btn close">Close</button><h2>How to Play</h2>
    <p><b>Follow the quest card</b> (top left). The saffron marker and the compass point to your next goal; the minimap turns with you.</p>
    <p><b>WASD / arrows</b> walk · <b>Shift</b> run · <b>Space</b> jump · <b>mouse</b> look (click the world first) · <b>wheel</b> camera distance</p>
    <p><b>E</b> talk to people, light diyas, rest on a charpai, ring the bell, and board or leave the balloon at a landing.</p>
    <p>Walk into floating <b>🌼 marigolds</b>, <b>🥭 mangoes</b> and old <b>🪙 rupee coins</b> to pick them up. Discovering a new district earns ₹${10}.</p>
    <p><b>Tab</b> map · <b>M</b> bring down the moon · <b>C</b> cinema view · <b>Esc</b> release the mouse. Progress saves automatically.</p>
    <p class="row"><button class="g-btn" data-act="restart">Start a new day (reset progress)</button></p>`);
  const mapSheet = sheet('map', `<button class="g-btn close">Close</button><h2>The Valley of Chandpur</h2><div>Saffron marker: your objective. Every place is connected on foot; the balloon flies between the River Meadow and the Fort Shoulder.</div><canvas width="${(X1 - X0) * S}" height="${(Z1 - Z0) * S}"></canvas>`);
  mapSheet.classList.add('g-map');
  function sheet(name, html) {
    const el = document.createElement('div'); el.className = 'g-sheet'; el.hidden = true; el.dataset.sheet = name;
    el.innerHTML = `<div class="g-panel">${html}</div>`; document.body.appendChild(el);
    el.addEventListener('click', (e) => {
      if (e.target === el || e.target.closest('.close')) toggleSheet(el, false);
      if (e.target.closest('[data-act="restart"]')) onRestart?.();
    });
    return el;
  }
  function toggleSheet(el, show = el.hidden) {
    for (const s of [help, mapSheet]) if (s !== el) s.hidden = true;
    el.hidden = !show;
    if (show) { document.exitPointerLock?.(); if (el === mapSheet) drawFullMap(); }
  }
  window.addEventListener('keydown', (e) => {
    if (title.hidden === false) { if (e.code === 'Enter') title.querySelector('[data-start="' + (hasSave?.() ? 'continue' : 'new') + '"]').click(); return; }
    if (e.code === 'Tab') { e.preventDefault(); toggleSheet(mapSheet); }
    if (e.code === 'KeyH') toggleSheet(help);
    if (e.code === 'Escape') { help.hidden = true; mapSheet.hidden = true; }
  });
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (e.target.closest('.g-dialog') || e.target.closest('.g-prompt')) { onInteract?.(); return; }
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'map') toggleSheet(mapSheet);
    if (act === 'help') toggleSheet(help);
    if (act === 'moon') onMoon?.();
    if (act === 'cinema') onCinematic?.();
    if (act === 'sound') { const on = await onSound?.(); b.textContent = on ? '🔊' : '🔇'; b.setAttribute('aria-pressed', String(!!on)); }
  });

  // ---------------------------------------------------------------- map art
  const base = document.createElement('canvas'); base.width = (X1 - X0) * S; base.height = (Z1 - Z0) * S;
  const M = (x, z) => [(x - X0) * S, (z - Z0) * S];
  function paintBase() {
    const c = base.getContext('2d');
    for (let z = Z0; z < Z1; z += 2) for (let x = X0; x < X1; x += 2) {
      const h = groundHeight(x, z), k = Math.max(0, Math.min(1, h / 26));
      c.fillStyle = `rgb(${Math.round(128 + k * 70)},${Math.round(186 + k * 30)},${Math.round(84 + k * 60)})`;
      c.fillRect(...M(x, z), 2 * S + 1, 2 * S + 1);
    }
    c.fillStyle = '#3fa7d6'; c.beginPath();
    for (let x = X0; x <= X1; x += 2) c.lineTo(...M(x, riverCentre(x) - riverHalfWidth(x)));
    for (let x = X1; x >= X0; x -= 2) c.lineTo(...M(x, riverCentre(x) + riverHalfWidth(x)));
    c.fill();
    c.beginPath(); c.arc(...M(POND.x, POND.z), POND.r * S, 0, Math.PI * 2); c.fill();
    for (const p of FARM_PLOTS) { c.fillStyle = CROP_COLOR[p.crop]; c.fillRect(...M(p.x0, p.z0), (p.x1 - p.x0) * S, (p.z1 - p.z0) * S); c.strokeStyle = '#8a644088'; c.lineWidth = 2; c.strokeRect(...M(p.x0, p.z0), (p.x1 - p.x0) * S, (p.z1 - p.z0) * S); }
    c.strokeStyle = '#6a5a4a'; c.lineWidth = 5; c.beginPath(); c.moveTo(...M(X0, RAIL_Z)); c.lineTo(...M(X1, RAIL_Z)); c.stroke();
    c.strokeStyle = '#f4ead0'; c.lineWidth = 2; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(...M(X0, RAIL_Z)); c.lineTo(...M(X1, RAIL_Z)); c.stroke(); c.setLineDash([]);
    for (const pass of [0, 1]) for (const r of ROUTES) {
      c.strokeStyle = pass ? (r.material === 'path' || r.material === 'steps' ? '#f0d9a8' : '#fbf0d8') : '#8a6a4a';
      c.lineWidth = Math.max(4, r.width * S) + (pass ? 0 : 3); c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); r.points.forEach((p, i) => (i ? c.lineTo(...M(p[0], p[2])) : c.moveTo(...M(p[0], p[2])))); c.stroke();
    }
    c.fillStyle = '#2f7a3a'; for (const o of circles) { if (o.r < 0.2) continue; c.beginPath(); c.arc(...M(o.cx, o.cz), Math.max(2.5, o.r * S * 1.6), 0, Math.PI * 2); c.fill(); }
    for (const b of oriented) {
      if (b.hx < 0.6 && b.hz < 0.6) continue;
      c.save(); c.translate(...M(b.cx, b.cz)); c.rotate(-b.yaw); c.fillStyle = '#d0603a'; c.strokeStyle = '#7a2a1a'; c.lineWidth = 1.5;
      c.fillRect(-b.hx * S, -b.hz * S, b.hx * 2 * S, b.hz * 2 * S); c.strokeRect(-b.hx * S, -b.hz * S, b.hx * 2 * S, b.hz * 2 * S); c.restore();
    }
  }
  let target = null;
  function drawFullMap() {
    const cv = mapSheet.querySelector('canvas'), c = cv.getContext('2d');
    c.drawImage(base, 0, 0);
    c.font = '800 15px "Baloo 2", sans-serif'; c.textAlign = 'center';
    for (const d of DISTRICTS) {
      const [x, y] = M(d.anchor[0], d.anchor[2]);
      c.lineWidth = 4; c.strokeStyle = '#fff6e2'; c.strokeText(d.name, x, y - 10); c.fillStyle = '#5a1a14'; c.fillText(d.name, x, y - 10);
      c.fillStyle = '#ff8c1a'; c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fill();
    }
    if (target) { const [x, y] = M(target.x, target.z); c.fillStyle = '#ff8c1a'; c.strokeStyle = '#7a1f2b'; c.lineWidth = 3; star(c, x, y, 12); }
    const [px, py] = M(lastP.x, lastP.z);
    c.save(); c.translate(px, py); c.rotate(lastHeading); arrow(c, 11); c.restore();
  }
  function star(c, x, y, r) {
    c.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath(); c.fill(); c.stroke();
  }
  function arrow(c, r) {
    c.beginPath(); c.moveTo(0, -r); c.lineTo(r * 0.75, r * 0.8); c.lineTo(0, r * 0.4); c.lineTo(-r * 0.75, r * 0.8); c.closePath();
    c.fillStyle = '#fff'; c.strokeStyle = '#7a1f2b'; c.lineWidth = 3; c.fill(); c.stroke();
  }

  // ---------------------------------------------------------------- minimap + compass (per frame)
  const mini = root.querySelector('.g-mini canvas'), mc = mini.getContext('2d');
  const comp = root.querySelector('.g-compass canvas'), cc = comp.getContext('2d');
  let lastP = { x: 0, z: 0 }, lastHeading = 0;
  function drawMini(p, heading) {
    const W = mini.width, R = W / 2, zoom = 1.25;
    mc.save(); mc.clearRect(0, 0, W, W);
    mc.beginPath(); mc.arc(R, R, R, 0, Math.PI * 2); mc.clip();
    mc.fillStyle = '#8fc25a'; mc.fillRect(0, 0, W, W);
    mc.translate(R, R); mc.rotate(-heading); mc.scale(zoom, zoom);
    const [bx, by] = M(p.x, p.z); mc.drawImage(base, -bx, -by);
    mc.restore();
    if (target) {
      const dx = (target.x - p.x) * S * zoom, dz = (target.z - p.z) * S * zoom;
      const c = Math.cos(-heading), s = Math.sin(-heading);
      let x = dx * c - dz * s, y = dx * s + dz * c; const d = Math.hypot(x, y), lim = R - 16;
      mc.fillStyle = '#ff8c1a'; mc.strokeStyle = '#7a1f2b'; mc.lineWidth = 3;
      if (d > lim) { x *= lim / d; y *= lim / d; mc.save(); mc.translate(R + x, R + y); mc.rotate(Math.atan2(y, x) + Math.PI / 2); mc.beginPath(); mc.moveTo(0, -12); mc.lineTo(9, 6); mc.lineTo(-9, 6); mc.closePath(); mc.fill(); mc.stroke(); mc.restore(); }
      else star(mc, R + x, R + y, 12);
    }
    mc.save(); mc.translate(R, R); arrow(mc, 13); mc.restore();
    const nx = R + Math.sin(-heading) * (R - 18), ny = R - Math.cos(-heading) * (R - 18);
    mc.fillStyle = '#7a1f2b'; mc.beginPath(); mc.arc(nx, ny, 13, 0, Math.PI * 2); mc.fill();
    mc.fillStyle = '#fff'; mc.font = '800 17px "Baloo 2", sans-serif'; mc.textAlign = 'center'; mc.textBaseline = 'middle'; mc.fillText('N', nx, ny + 1);
  }
  function drawCompass(heading, bearing) {
    const W = comp.width, H = comp.height, pxPerDeg = W / 150;
    cc.clearRect(0, 0, W, H);
    const hdeg = heading * 180 / Math.PI;
    cc.textAlign = 'center'; cc.textBaseline = 'middle';
    for (let a = Math.floor((hdeg - 80) / 15) * 15; a <= hdeg + 80; a += 15) {
      const x = W / 2 + (a - hdeg) * pxPerDeg, n = ((a % 360) + 360) % 360;
      const label = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }[n];
      if (label) { cc.fillStyle = n % 90 === 0 ? '#ffd77a' : '#f6e6c0'; cc.font = `800 ${n % 90 === 0 ? 30 : 22}px "Baloo 2", sans-serif`; cc.fillText(label, x, H / 2 + 2); }
      else { cc.fillStyle = '#f6e6c088'; cc.fillRect(x - 1.5, H / 2 - 8, 3, 16); }
    }
    if (bearing !== null) {
      let d = ((bearing * 180 / Math.PI - hdeg + 540) % 360) - 180;
      const x = W / 2 + Math.max(-74, Math.min(74, d)) * pxPerDeg;
      cc.fillStyle = '#ff8c1a'; cc.strokeStyle = '#2b1a12'; cc.lineWidth = 3;
      cc.beginPath(); cc.moveTo(x, H - 4); cc.lineTo(x - 13, H - 26); cc.lineTo(x + 13, H - 26); cc.closePath(); cc.fill(); cc.stroke();
    }
    cc.fillStyle = '#fff'; cc.fillRect(W / 2 - 2, 0, 4, 12);
  }

  // ---------------------------------------------------------------- state helpers
  const q = (s) => root.querySelector(s);
  const quest = { c: q('.g-quest .c'), n: q('.g-quest .n'), t: q('.g-quest .title'), o: q('.g-quest .obj'), prog: q('.g-quest .prog'), ico: q('.g-quest .prog .ico'), bar: q('.g-quest .bar i'), cnt: q('.g-quest .cnt'), dist: q('.g-quest .dist') };
  const set = (el, v) => { if (el.textContent !== v) el.textContent = v; };
  const toastEl = q('.g-toast'), notes = q('.g-notes'), promptEl = q('.g-prompt'), promptLbl = q('.g-prompt .lbl');
  const dlg = q('.g-dialog'), banner = q('.g-banner'), chapterEl = q('.g-chapter');
  let toastTimer = 0, bannerTimer = 0, chapterTimer = 0, typing = null, balloonPrompt = '', gamePrompt = null;
  const wallet = {}; for (const el of root.querySelectorAll('[data-w]')) wallet[el.dataset.w] = el;
  const lastWallet = {};
  function bump(key, value, show = true) {
    const el = wallet[key]; el.hidden = !show; const b = el.querySelector('b');
    if (lastWallet[key] !== value) { if (lastWallet[key] !== undefined && typeof value === 'number') { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); } lastWallet[key] = value; if (typeof value === 'number') b.textContent = value; }
  }
  function updatePrompt() {
    const label = gamePrompt ?? balloonPrompt;
    promptEl.hidden = !label || !dlg.hidden;
    set(promptLbl, label || '');
  }

  return {
    root,
    get mapOpen() { return !mapSheet.hidden || !help.hidden; },
    get titleOpen() { return !title.hidden; },
    hideLoader() { paintBase(); loader.classList.add('hidden'); setTimeout(() => loader.remove(), 700); },
    toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), 4200); },
    notify(msg, icon = '✨') {
      const n = document.createElement('div'); n.className = 'g-note'; n.textContent = `${icon} ${msg}`; notes.appendChild(n);
      while (notes.children.length > 4) notes.firstChild.remove();
      setTimeout(() => n.remove(), 3800);
    },
    banner(kicker, t, rw = '') {
      banner.querySelector('.k').textContent = kicker; banner.querySelector('.t').textContent = 'शाबाश!'; banner.querySelector('.s').textContent = t; banner.querySelector('.rw').textContent = rw;
      banner.classList.add('show'); clearTimeout(bannerTimer); bannerTimer = setTimeout(() => banner.classList.remove('show'), 2600);
    },
    chapter(name, sub) {
      chapterEl.querySelector('.n').textContent = 'अध्याय · Chapter'; chapterEl.querySelector('.t').textContent = name; chapterEl.querySelector('.s').textContent = sub;
      chapterEl.classList.add('show'); clearTimeout(chapterTimer); chapterTimer = setTimeout(() => chapterEl.classList.remove('show'), 3600);
    },
    setQuest({ chapter, title: t, objective, progress, step, steps }) {
      set(quest.c, chapter); set(quest.n, `${Math.min(step + 1, steps)} / ${steps}`); set(quest.t, t); set(quest.o, objective);
      quest.prog.hidden = !progress;
      if (progress) { set(quest.ico, progress.icon); set(quest.cnt, `${progress.n}/${progress.total}`); quest.bar.style.width = `${(progress.n / Math.max(1, progress.total)) * 100}%`; }
    },
    setWallet({ rupees, coins, coinsTotal, inv }) {
      bump('rupees', rupees); bump('coins', coins); wallet.coins.querySelector('b').textContent = `${coins}/${coinsTotal}`;
      bump('marigold', inv.marigold, inv.marigold > 0); bump('mango', inv.mango, inv.mango > 0); bump('laddoo', 'x', inv.laddoo > 0);
    },
    setTarget(t) { target = t; },
    prompt(label) { gamePrompt = label; updatePrompt(); },
    setInteraction(status) { balloonPrompt = status?.prompt ?? ''; updatePrompt(); },
    dialog(line) {
      if (!line) { dlg.hidden = true; clearInterval(typing?.timer); typing = null; updatePrompt(); return; }
      dlg.hidden = false; updatePrompt();
      const face = dlg.querySelector('.face'); face.textContent = [...line.hi][0] ?? line.name[0]; face.style.background = line.color;
      dlg.querySelector('.who').innerHTML = '';
      const who = dlg.querySelector('.who'); who.append(line.name);
      const hi = document.createElement('span'); hi.textContent = line.hi; who.append(hi);
      const role = document.createElement('em'); role.textContent = line.role; who.append(role);
      const textEl = dlg.querySelector('.text'); clearInterval(typing?.timer);
      const chars = [...line.text]; let i = 0; textEl.textContent = '';
      typing = { done: false, finish() { clearInterval(this.timer); textEl.textContent = line.text; this.done = true; } };
      typing.timer = setInterval(() => { i += 2; textEl.textContent = chars.slice(0, i).join(''); if (i >= chars.length) typing.finish(); }, 22);
      dlg.querySelector('.next').textContent = line.more ? 'E ▸' : 'E ✓';
    },
    dialogTyping() { return typing && !typing.done; },
    finishTyping() { typing?.finish(); },
    fade(on) { fadeEl.classList.toggle('show', on); },
    setDistrict(d) { const hiEl = q('.g-district .hi'), enEl = q('.g-district .en'); set(hiEl, d.hi ?? ''); set(enEl, d.name); },
    setClock(text, phase, night) { set(q('.g-clock .time'), text); set(q('.g-clock .phase'), phase); set(q('.g-clock .ico'), night > 0.5 ? '🌙' : phase === 'Dusk' || phase === 'Dawn' ? '🌅' : '☀️'); },
    frame(p, heading, distanceText) {
      lastP = { x: p.x, z: p.z }; lastHeading = heading;
      drawMini(p, heading);
      const bearing = target ? Math.atan2(target.x - p.x, -(target.z - p.z)) : null;
      drawCompass(heading, bearing);
      set(quest.dist, distanceText);
    },
    setMoonLabel(down) { set(q('[data-act="moon"]'), down ? '🌙 Send Home' : '🌙 Moon'); },
    setCinemaLabel(walking) { q('[data-act="cinema"]').title = walking ? 'Cinema view' : 'Walk'; },
    finale({ rupees, coins, coinsTotal, discovered, districts }) {
      const el = sheet('finale', `<h2>शुभ फसल मेला! Happy Harvest Fair!</h2>
        <p>The bell rang, the ghats glowed with diyas, and the moon came down to the river for the Mela — just like Dadaji remembered.</p>
        <p style="font-size:20px;font-weight:800">₹${rupees} earned · 🪙 ${coins}/${coinsTotal} coins · 🧭 ${discovered}/${districts} places discovered</p>
        <p>Keep exploring: every coin is still out there, the mustard still sways, and the jhoola is always free.</p>
        <p class="row"><button class="g-btn close">Keep Exploring</button></p>`);
      toggleSheet(el, true);
    },
    showTitle() { title.hidden = false; root.hidden = true; },
  };
}
