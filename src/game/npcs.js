import * as THREE from 'three';
import { Human } from '../world/people/human.js';
import { Driver } from '../world/people/anim.js';
import { rings } from '../world/people/skin.js';
import { propLathi, propJhola, propMatka } from '../world/people.js';
import { surfaceY } from '../world/layout.js';

// The talkable people of Chandpur. New farm folk are built here; the town's
// existing residents (chaiwala, sweet-maker, balloon keeper…) are adopted by
// key so they can speak too. Positions are where they stand in the world.

const HAIR = { top: '#302730', base: '#241f27', tip: '#1b1720', hi: '#58494e', hi2: '#776264' };
const GRAY = { top: '#b5b1b5', base: '#939398', tip: '#807f86', hi: '#d2cecc', hi2: '#e2dcd4' };
function face(skin, feminine = false, kid = false) {
  return { skin, ink: '#3f3440', eyeP: 24, eyeT: -12, eyeW: kid ? 20 : 19, eyeH: feminine || kid ? 21 : 15,
    irisDark: '#493a37', irisMid: '#755344', irisLight: '#aa8665', lash: feminine ? 1 : 0.5,
    lidTop: -0.48, iris: kid ? 0.42 : 0.37, irisH: 0.48, brow: '#483730', browW: feminine ? 1.9 : 2.5,
    browGap: 3.4, browArch: 1.6, noseT: -32, mouthT: -52, mouthW: 9, smile: kid ? 0.45 : 0.25, blush: kid ? 0.6 : 0.3, bindi: feminine };
}

/** A pagdi (turban) wound around the head: stacked ellipses with a crest. */
export function propPagdi(col = '#ff8c1a', band = '#d4321f') {
  return (hh) => {
    const H = hh.P.head, b = hh.b.head;
    const list = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6, y = H.cy + H.ry * (0.05 + t * 1.12);
      const s = i === 6 ? 0.08 : 1.16 - Math.pow(t, 2.4) * 0.5;
      list.push({ y, a: H.rx * s, b: H.rz * s * 1.04, z: H.cz - H.rz * 0.06 });
    }
    hh.add(rings(list, 16), { bone: b, color: col });
    const stripe = [];
    for (let i = 0; i <= 2; i++) { const y = H.cy + H.ry * (0.42 + i * 0.05); stripe.push({ y, a: H.rx * 1.135, b: H.rz * 1.175, z: H.cz - H.rz * 0.06 }); }
    hh.add(rings(stripe, 16), { bone: b, color: band });
  };
}

function person({ key, seed, female = false, kid = false, height, outfit, props = [], gray = false, skin = '#d9a77e' }) {
  return new Human({ key, sex: female ? 'f' : 'm', height: height ?? (kid ? 1.18 : female ? 1.57 : 1.68), seed, skin,
    face: face(skin, female, kid), ears: true,
    hair: { fringe: { n: 5, span: 52, tip: 10, skew: 6, w: 0.05, edgeDrop: 9 }, hairlineSide: -18, hairlineBack: -64, volume: 1.05 },
    hairTex: gray ? GRAY : HAIR, hairStyle: female ? 'bun' : 'short', outfit, props, variants: ['open', 'blink', 'talk'] });
}

export const NPC_INFO = {
  ramu: { name: 'Ramu Chaiwala', hi: 'रामू चायवाला', role: 'Station chai stall', color: '#c05a1a',
    idle: ['Garam chai! Ten rupees, and the best view of the 6:40 passenger.', 'Arre, sip slowly — the kulhad keeps it hot.', 'Tonight the whole town goes to the Mela. Even the station dog.'] },
  sharma: { name: 'Sharma ji', hi: 'शर्मा जी', role: 'Sweet-maker, Old Bazaar', color: '#d4321f',
    idle: ['Jalebi fresh from the kadhai! Crisp outside, syrup inside.', 'A Mela without laddoos? Unthinkable.', 'My grandfather fried jalebis on this very corner.'] },
  baldev: { name: 'Baldev Kaka', hi: 'बलदेव काका', role: 'Farmer, Sarson Fields', color: '#1f9a62',
    idle: ['Sarson ka khet in full bloom — like the sun fell into my fields.', 'Hira and Moti are the best bullocks in the valley. Don\'t tell them, they\'ll get proud.', 'The tubewell runs sweet water all summer.'] },
  chotu: { name: 'Chotu', hi: 'छोटू', role: 'Kite champion (self-declared)', color: '#e8558a',
    idle: ['Look at my patang! Nobody can cut it — I use the best manjha!', 'Wo kaata! …oh wait, that was mine.', 'Didi says if I finish my homework I can fly till sunset.'] },
  ganga: { name: 'Ganga Devi', hi: 'गंगा देवी', role: 'Paddy farmer', color: '#2f8a5e',
    idle: ['Rice needs its feet in water and its head in the sun.', 'The egrets follow us all day, waiting for frogs.', 'Sit, beta. Have some gur with water.'] },
  planter1: { name: 'Savitri', hi: 'सावित्री', role: 'Transplanting rice', color: '#e8558a',
    idle: ['One seedling, two seedlings… a thousand to go!', 'We sing so the back doesn\'t notice.'] },
  planter2: { name: 'Lakshmi', hi: 'लक्ष्मी', role: 'Transplanting rice', color: '#ffb000',
    idle: ['Careful, the bund is slippery.', 'By the monsoon these will be taller than Chotu.'] },
  munni: { name: 'Munni Didi', hi: 'मुन्नी दीदी', role: 'Mango orchard keeper', color: '#e8781a',
    idle: ['Langra, Dussehri, Chausa — I know every tree by name.', 'Don\'t climb the old tree, it bites. Well, its ants do.', 'Try the jhoola! Everyone deserves a swing in mango season.'] },
  dadaji: { name: 'Dadaji', hi: 'दादाजी', role: 'Elder of the banyan', color: '#8a6a3e',
    idle: ['This bargad has seen four generations of my family.', 'In my day the moon came down for the Mela every year. Maybe she still does…', 'Sit in the shade, child. The fields will wait.'] },
  bhola: { name: 'Captain Bhola', hi: 'कप्तान भोला', role: 'Balloon keeper, River Meadow', color: '#2f6db5',
    idle: ['Step in the basket and press E — she flies to the Fort Shoulder.', 'Best view of the valley is from four hundred feet.', 'The burner is loud but the sky is quiet.'] },
  nanaji: { name: 'Nanaji', hi: 'नानाजी', role: 'Hill village elder', color: '#647865',
    idle: ['The shrine bell can be heard all the way to the river.', 'Climb slowly. The hill isn\'t going anywhere.'] },
  kamla: { name: 'Kamla Tai', hi: 'कमला ताई', role: 'At the ghats', color: '#586f70',
    idle: ['The river is kind this season.', 'At dusk the diyas float like little stars.'] },
};

const ADOPT = { 'station-chaiwala': 'ramu', 'sweets-shopkeeper': 'sharma', 'balloon-keeper': 'bhola', 'hill-grandfather': 'nanaji', 'river-water-carrier': 'kamla' };

export function createNPCs(scene, { player, spots, life }) {
  const root = new THREE.Group(); root.name = 'farm-folk'; scene.add(root);
  const talkers = [], updaters = [];
  const look = new THREE.Vector3(), delta = new THREE.Vector3();
  let talkingTo = null;

  function stand(id, h, spot, action) {
    const d = new Driver(h, { seed: h.seed });
    const pos = new THREE.Vector3(...spot.position);
    if (!spot.sit && !spot.bend) pos.y = Math.max(pos.y, surfaceY(pos.x, pos.z));
    root.add(h.group);
    const t = { id, ...NPC_INFO[id], position: pos, human: h, yaw: spot.yaw };
    talkers.push(t);
    updaters.push((time, dt) => {
      d.place(pos.x, pos.y, pos.z, spot.yaw); d.reset();
      if (spot.bend) d.stand({ stance: 1.35, hy: -0.16, hz: -0.06, hrx: 0.72 });
      else d.stand({ stance: 1.08, hy: -0.012 });
      d.breathe(time, 1, { pitch: false });
      d.arm('L', 0.05, 0.08, 0, 0.23); d.arm('R', 0.05, 0.08, 0, 0.23);
      if (action) action(d, h, time);
      delta.copy(player.position).sub(pos);
      const near = delta.length() < 5 && !player.transported;
      if ((near || talkingTo === t) && !spot.bend) {
        look.copy(player.position); look.y += 1.48; d.lookAt(look, dt, { maxYaw: 0.9, maxUp: 0.35, maxDown: 0.4 });
      } else d.lookYP(Math.sin(time * 0.16 + h.seed) * 0.2, spot.bend ? 0.4 : 0.03, dt);
      d.blink(time, talkingTo === t && Math.sin(time * 9) > 0);
      d.wind(time, dt, { boost: 0.55 });
      h.group.updateMatrixWorld(true); h.mesh.skeleton.update();
    });
    return t;
  }

  const S = spots.npcs;
  stand('baldev', person({ key: 'farmer-baldev', seed: 61, skin: '#c99068', outfit: { kind: 'kurta-vest', topColor: '#f4f0e6', waistcoat: '#1f7a52', bottomColor: '#f6f2ea', shoes: '#6a4a30' },
    props: [propPagdi('#ff8c1a', '#d4321f'), propLathi('R')] }), S.baldev, (d, h, t) => { d.arm('R', 0.12, 0.13, 0, 0.39); d.arm('L', 0.2, 0.1, 0, 0.9 + Math.sin(t * 0.8) * 0.15); });
  stand('chotu', person({ key: 'kid-chotu', seed: 64, kid: true, skin: '#d29a70', outfit: { kind: 'kurta', topColor: '#ffd000', bottomColor: '#2f6db5', shoes: '#6a4a30' } }),
    S.chotu, (d, h, t) => { d.arm('R', 1.35 + Math.sin(t * 2.2) * 0.12, 0.25, 0, 0.35); d.arm('L', 0.9, 0.18, 0, 1.1 + Math.sin(t * 2.2 + 1) * 0.2); });
  stand('ganga', person({ key: 'farmer-ganga', seed: 66, female: true, skin: '#c8906a', outfit: { kind: 'saree', topColor: '#1f9a62', bottomColor: '#2fb07a', pallu: '#ffd000', hem: '#d4321f', shoes: '#6a4a30' },
    props: [propMatka('L')] }), S.ganga, (d) => { d.arm('L', 0.24, 0.16, 0, 1.0); d.arm('R', 0.3, 0.16, 0, 0.7); });
  stand('planter1', person({ key: 'planter-savitri', seed: 67, female: true, skin: '#c48a62', outfit: { kind: 'saree', topColor: '#e8558a', bottomColor: '#f27aa6', pallu: '#e8558a', hem: '#ffd000', shoes: '#6a4a30' } }),
    S.planter1, (d, h, t) => { const k = Math.sin(t * 1.6); d.arm('R', 0.6 + k * 0.25, 0.1, 0, 0.3); d.arm('L', 0.45 - k * 0.15, 0.12, 0, 0.5); });
  stand('planter2', person({ key: 'planter-lakshmi', seed: 68, female: true, skin: '#cf9870', outfit: { kind: 'saree', topColor: '#ffb000', bottomColor: '#ffc83a', pallu: '#d4321f', hem: '#1f9a62', shoes: '#6a4a30' } }),
    S.planter2, (d, h, t) => { const k = Math.sin(t * 1.4 + 1); d.arm('L', 0.6 + k * 0.25, 0.1, 0, 0.3); d.arm('R', 0.45 - k * 0.15, 0.12, 0, 0.5); });
  stand('munni', person({ key: 'orchard-munni', seed: 69, female: true, skin: '#d6a07a', outfit: { kind: 'kameez', topColor: '#ff8c1a', bottomColor: '#f6e6c0', dupatta: '#e8558a', shoes: '#6a4a30' },
    props: [propJhola('R', '#c05a1a', false)] }), S.munni, (d, h, t) => { d.arm('L', 0.35, 0.12, 0, 0.9 + Math.sin(t) * 0.1); });
  stand('dadaji', person({ key: 'elder-dadaji', seed: 70, gray: true, height: 1.62, skin: '#d4a07c', outfit: { kind: 'kurta', topColor: '#fbf8f0', bottomColor: '#fbf8f0', shoes: '#6a4a30' },
    props: [propPagdi('#fbf8f0', '#e8e0c8'), propLathi('R')] }), { ...S.dadaji, sit: false }, (d) => { d.arm('R', 0.12, 0.13, 0, 0.39); });

  // adopt existing residents by key
  for (const r of life.residents) {
    const id = ADOPT[r.name]; if (!id || !r.position) continue;
    talkers.push({ id, ...NPC_INFO[id], position: new THREE.Vector3(...r.position), human: r.human });
  }

  return {
    group: root, talkers,
    update(t, dt) { for (const u of updaters) u(t, dt); },
    get(id) { return talkers.find((n) => n.id === id); },
    setTalking(t) { talkingTo = t; },
    nearest(p, range = 2.6) {
      let best = null, bd = range;
      for (const n of talkers) { const d = Math.hypot(n.position.x - p.x, n.position.z - p.z); if (d < bd && Math.abs(n.position.y - p.y) < 3) { bd = d; best = n; } }
      return best;
    },
  };
}
