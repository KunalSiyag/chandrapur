import * as THREE from 'three';
import { STEPS, CHAPTERS, DISCOVERY_REWARD } from './quests.js';
import { createNPCs, NPC_INFO } from './npcs.js';
import { createPickups, createObjectiveMarker, createFireworks } from './pickups.js';
import { diya } from '../world/props.js';
import { surfaceY, DISTRICTS } from '../world/layout.js';

const SAVE_KEY = 'chandpur-save-v2';
const GHAT_DIYAS = [[17.6, 50.75], [20.1, 50.75], [22.6, 50.75], [25.1, 50.75], [27.6, 50.75], [30.1, 50.75], [32.6, 50.75]];
const BELL = new THREE.Vector3(-35, 25.5, -76.3);

/**
 * The game director: quests, talk, pickups, interactables, discovery,
 * rewards, saving, and the moonlit finale. main.js feeds it input and time.
 */
export function createGame({ scene, player, town, life, balloon, day, moon, music, hud, toggleMoon }) {
  const npcs = createNPCs(scene, { player, spots: town.spots, life });
  const marker = createObjectiveMarker(scene);
  const fireworks = createFireworks(scene);
  const state = { step: 0, rupees: 0, coins: new Set(), discovered: new Set(), inv: { marigold: 0, mango: 0, laddoo: 0 }, diyas: new Set(), finished: false };
  let started = false, dialog = null, lastDistrict = null, saveTimer = 0, interaction = null, fireworkSound = 0, currentTarget = null;

  const pickups = createPickups(scene, { onPick: (it) => {
    music.sfx.pick(it.kind);
    if (it.kind === 'coin') {
      state.coins.add(it.id); state.rupees += 1;
      if (state.coins.size % 10 === 0) hud.notify(`${state.coins.size} old coins found!`, '🪙');
    } else {
      state.inv[it.kind] = (state.inv[it.kind] ?? 0) + 1;
      const s = STEPS[state.step];
      if (s.type === 'collect' && s.kind === it.kind) {
        const n = Math.min(state.inv[it.kind], s.count);
        hud.notify(`${it.kind === 'marigold' ? 'Marigold' : 'Mango'} ${n}/${s.count}`, it.kind === 'marigold' ? '🌼' : '🥭');
        if (state.inv[it.kind] >= s.count) { pickups.clear(it.kind); completeStep(); }
        else refreshQuest();
      }
    }
    refreshWallet(); queueSave();
  } });

  // ---------------------------------------------------------------- persistence
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false;
      const s = JSON.parse(raw);
      state.step = Math.min(s.step ?? 0, STEPS.length - 1); state.rupees = s.rupees ?? 0;
      state.coins = new Set(s.coins ?? []); state.discovered = new Set(s.discovered ?? []);
      state.inv = { marigold: 0, mango: 0, laddoo: 0, ...(s.inv ?? {}) }; state.diyas = new Set(s.diyas ?? []); state.finished = !!s.finished;
      if (typeof s.time === 'number') day.set(s.time);
      return true;
    } catch { return false; }
  }
  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ step: state.step, rupees: state.rupees, coins: [...state.coins], discovered: [...state.discovered],
        inv: state.inv, diyas: [...state.diyas], finished: state.finished, time: day.time }));
    } catch { /* storage may be unavailable; the game still plays */ }
  }
  function queueSave() { saveTimer = 1.5; }
  const hasSave = () => { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } };

  // ---------------------------------------------------------------- ghat diyas
  const diyaSlots = GHAT_DIYAS.map(([x, z], i) => {
    const g = new THREE.Group(); g.name = 'ghat-diya-slot';
    const bowl = diya({ scale: 1.7 }); bowl.flame.visible = false; bowl.glow.visible = false;
    g.add(bowl.group); const y = surfaceY(x, z) + 0.05; g.position.set(x, y, z); scene.add(g);
    const petals = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 4, 12), new THREE.MeshBasicMaterial({ color: '#ff8c1a' })); petals.rotation.x = Math.PI / 2; petals.position.y = 0.02; g.add(petals);
    return { id: `diya-${i}`, group: g, flame: bowl.flame, glow: bowl.glow, position: new THREE.Vector3(x, y, z) };
  });
  function lightDiya(slot, quiet = false) {
    slot.flame.visible = true; slot.glow.visible = true; slot.glow.userData.dayVisible = true; slot.glow.layers.set(1);
    slot.glow.scale.setScalar(1.6); state.diyas.add(slot.id);
    if (!quiet) { music.sfx.step(); pickups.burst(slot.position.clone().setY(slot.position.y + 0.3), '#ffb04a'); }
  }

  // ---------------------------------------------------------------- quest flow
  function stepTarget(s = STEPS[state.step]) {
    if (!s) return null;
    if (s.type === 'talk') return npcs.get(s.npc)?.position ?? null;
    if (s.type === 'collect') return pickups.nearestOf(s.kind, player.position)?.group.position ?? null;
    if (s.type === 'diyas') return diyaSlots.find((d) => !state.diyas.has(d.id))?.position ?? null;
    if (s.target) return new THREE.Vector3(...s.target);
    return null;
  }
  function objectiveText(s) {
    if (s.id === 'ring-bell') {
      if (Math.hypot(player.position.x - BELL.x, player.position.z - BELL.z) < 6 && !isEvening()) return 'Too early! Wait here for dusk — press E at the bell to rest until evening';
      return isEvening() ? 'It is dusk — ring the shrine bell (E)' : s.objective;
    }
    return s.objective;
  }
  function refreshQuest() {
    const s = STEPS[state.step];
    let progress = null;
    if (s.type === 'collect') progress = { n: Math.min(state.inv[s.kind] ?? 0, s.count), total: s.count, icon: s.kind === 'marigold' ? '🌼' : '🥭' };
    if (s.type === 'diyas') progress = { n: state.diyas.size, total: s.count, icon: '🪔' };
    if (s.type === 'free') progress = { n: state.coins.size, total: coinTotal, icon: '🪙' };
    hud.setQuest({ chapter: CHAPTERS[s.chapter], title: s.title, objective: objectiveText(s), progress, step: state.step, steps: STEPS.length - 1 });
  }
  function refreshWallet() { hud.setWallet({ rupees: state.rupees, coins: state.coins.size, coinsTotal: coinTotal, inv: state.inv }); }

  function enterStep() {
    const s = STEPS[state.step];
    if (s.type === 'collect') {
      const need = s.count - (state.inv[s.kind] ?? 0);
      if (need > 0 && pickups.remaining(s.kind) < need) spawnCollect(s.kind, need + 4);
    }
    if (s.type === 'diyas') for (const d of diyaSlots) if (state.diyas.has(d.id)) lightDiya(d, true);
    if (s.type === 'free' || s.type === 'moon') for (const d of diyaSlots) lightDiya(d, true);
    refreshQuest(); queueSave();
  }
  function spawnCollect(kind, n) {
    const rnd = () => Math.random();
    if (kind === 'marigold') {
      const rects = town.spots.marigolds;
      for (let i = 0; i < n; i++) {
        const r = rects[i % rects.length];
        const x = r.x0 + rnd() * (r.x1 - r.x0), z = r.z0 + rnd() * (r.z1 - r.z0);
        pickups.spawn('marigold', `marigold-${i}`, x, r.y + 0.95, z);
      }
    } else if (kind === 'mango') {
      const spots = [...town.spots.mangoes].sort(() => rnd() - 0.5).slice(0, n);
      spots.forEach(([x, y, z], i) => pickups.spawn('mango', `mango-${i}`, x, y + 0.25, z));
    }
  }
  function completeStep() {
    const s = STEPS[state.step];
    if (s.reward?.rupees) state.rupees += s.reward.rupees;
    if (s.reward?.item) state.inv[s.reward.item] = (state.inv[s.reward.item] ?? 0) + 1;
    if (s.consume) state.inv[s.consume] = 0;
    music.sfx.quest();
    hud.banner('Quest Complete', s.title, s.reward?.rupees ? `+ ₹${s.reward.rupees}` : '');
    state.step = Math.min(state.step + 1, STEPS.length - 1);
    const next = STEPS[state.step];
    setTimeout(() => { if (next.chapter !== s.chapter) hud.chapter(CHAPTERS[next.chapter], next.title); }, 1600);
    refreshWallet(); enterStep(); save();
  }

  // ---------------------------------------------------------------- dialogue
  function openDialog(lines, onDone) {
    dialog = { lines, i: 0, onDone };
    const first = lines[0][0]; npcs.setTalking(npcs.get(first));
    showLine();
  }
  function showLine() {
    const [who, text] = dialog.lines[dialog.i];
    const info = NPC_INFO[who] ?? { name: who, hi: '', role: '', color: '#c05a1a' };
    hud.dialog({ name: info.name, hi: info.hi, role: info.role, color: info.color, text, more: dialog.i < dialog.lines.length - 1 });
    music.sfx.talk();
  }
  function advanceDialog() {
    if (hud.dialogTyping()) { hud.finishTyping(); return; }
    dialog.i++;
    if (dialog.i >= dialog.lines.length) {
      const done = dialog.onDone; dialog = null; hud.dialog(null); npcs.setTalking(null);
      done?.();
    } else showLine();
  }
  function talkTo(n) {
    const s = STEPS[state.step];
    if (s.type === 'talk' && s.npc === n.id) { openDialog(s.dialogue, completeStep); return; }
    const lines = [[n.id, n.idle[Math.floor(Math.random() * n.idle.length)]]];
    if (s.type === 'talk' && s.npc !== n.id) {
      const target = NPC_INFO[s.npc];
      lines.push([n.id, `${target.name}? ${hintFor(s.npc)}`]);
    }
    openDialog(lines);
  }
  function hintFor(id) {
    return {
      ramu: 'At the chai stall by the station, where else!', sharma: 'His sweet shop is the first one in the Old Bazaar, under the bunting.',
      baldev: 'Out east past the banyan, at the farmstead with the haystacks.', munni: 'Across the river, in the mango orchard east of the balloon meadow.',
      bhola: 'He keeps the balloon on the River Meadow, across the footbridge.',
    }[id] ?? 'Somewhere in the valley.';
  }

  // ---------------------------------------------------------------- interactions
  const isEvening = () => day.night > 0.3 || day.dusk > 0.45;
  function findInteraction() {
    const p = player.position;
    if (player.transported) return null;
    // an unlit ghat diya wins over idle chatter with someone standing nearby
    if (state.step >= STEPS.findIndex((s) => s.id === 'diyas')) {
      for (const d of diyaSlots) if (!state.diyas.has(d.id) && Math.hypot(p.x - d.position.x, p.z - d.position.z) < 1.8) return { label: 'Light the diya', act: () => {
        lightDiya(d); const s = STEPS[state.step];
        if (s.type === 'diyas') { hud.notify(`Diya ${state.diyas.size}/${s.count} lit`, '🪔'); if (state.diyas.size >= s.count) completeStep(); else refreshQuest(); }
        queueSave();
      } };
    }
    // the person the quest is about wins over a bystander standing nearby
    const cur = STEPS[state.step], questNpc = cur.type === 'talk' ? npcs.get(cur.npc) : null;
    const n = questNpc && Math.hypot(questNpc.position.x - p.x, questNpc.position.z - p.z) < 2.9 ? questNpc : npcs.nearest(p, 2.7);
    if (n) return { label: `Talk to ${n.name}`, act: () => talkTo(n) };
    for (const r of town.spots.rest) {
      if (Math.hypot(p.x - r.position[0], p.z - r.position[2]) < 2.0) {
        const evening = isEvening();
        return { label: evening ? 'Sleep on the charpai until morning' : 'Rest on the charpai until evening', act: () => rest(evening ? 0.29 : 0.755) };
      }
    }
    if (Math.hypot(p.x - BELL.x, p.z - BELL.z) < 2.8 && Math.abs(p.y - BELL.y) < 3) {
      const s = STEPS[state.step];
      if (s.id === 'ring-bell' && !isEvening()) return { label: 'Sit by the shrine and wait for dusk', act: () => rest(0.755) };
      return { label: 'Ring the temple bell', act: ringBell };
    }
    return null;
  }
  function rest(target) {
    hud.fade(true);
    day.rushTo(target);
    hud.toast(target > 0.5 ? 'You rest in the shade and watch the light turn gold…' : 'You sleep under the stars until the roosters call…');
  }
  function ringBell() {
    music.sfx.bell(0.8);
    const s = STEPS[state.step];
    if (s.id === 'ring-bell' && isEvening()) {
      hud.toast('Ting… ting… the bell rings out over the whole valley. The Mela begins!');
      completeStep();
    } else hud.toast('Ting! The bell rings out over the valley.');
  }

  // ---------------------------------------------------------------- public
  let coinTotal = 0;
  return {
    npcs, pickups,
    get started() { return started; },
    get blocking() { return !!dialog; },
    get target() { return currentTarget; },
    get state() { return state; },
    hasSave,
    start(fresh = true) {
      if (fresh) { try { localStorage.removeItem(SAVE_KEY); } catch { /* ok */ } }
      else load();
      coinTotal = pickups.scatterCoins(state.coins);
      started = true;
      refreshWallet(); enterStep();
      if (state.step === 0) setTimeout(() => hud.chapter(CHAPTERS.welcome, 'Find Ramu at the station chai stall'), 400);
      else hud.chapter(CHAPTERS[STEPS[state.step].chapter], 'Welcome back to Chandpur');
    },
    /** E pressed. Returns true if the game used it. */
    interact() {
      if (!started) return false;
      if (dialog) { advanceDialog(); return true; }
      if (interaction) { interaction.act(); return true; }
      return false;
    },
    onMoon(down) {
      const s = STEPS[state.step];
      if (down) music.startLullaby(); else music.stopLullaby();
      if (down && s.type === 'moon') {
        fireworks.start(45); state.finished = true;
        setTimeout(() => { completeStep(); hud.finale({ rupees: state.rupees, coins: state.coins.size, coinsTotal: coinTotal, discovered: state.discovered.size, districts: DISTRICTS.length }); }, 3500);
      }
    },
    celebrate() { fireworks.start(25); },
    /** Debug/test hook: jump straight to a quest step. */
    jumpTo(i) { state.step = Math.max(0, Math.min(i, STEPS.length - 1)); enterStep(); },
    update(t, dt, district) {
      npcs.update(t, dt);
      pickups.update(t, dt, player.position, started && !dialog);
      fireworks.update(dt);
      if (fireworks.running) { fireworkSound -= dt; if (fireworkSound <= 0) { fireworkSound = 0.6 + Math.random(); music.sfx.firework(); } }
      if (day.rushing) hud.fade(true); else hud.fade(false);
      if (!started) { marker.set(null); return; }
      // district discovery
      if (district && district.id !== lastDistrict) {
        lastDistrict = district.id;
        if (!state.discovered.has(district.id)) {
          state.discovered.add(district.id);
          if (state.discovered.size > 1) { state.rupees += DISCOVERY_REWARD; hud.notify(`Discovered ${district.name} · +₹${DISCOVERY_REWARD}`, '🧭'); music.sfx.step(); refreshWallet(); }
          queueSave();
        }
        const s = STEPS[state.step];
        if (s.type === 'reach' && s.district === district.id) completeStep();
      }
      const s = STEPS[state.step];
      const target = stepTarget(s); currentTarget = target;
      marker.set(target); marker.update(t, player.position);
      hud.setTarget(target);
      if (s.id === 'ring-bell') refreshQuest();
      interaction = dialog ? { label: 'Continue' } : findInteraction();
      hud.prompt(dialog ? null : interaction?.label ?? null);
      if (saveTimer > 0) { saveTimer -= dt; if (saveTimer <= 0) save(); }
    },
  };
}
