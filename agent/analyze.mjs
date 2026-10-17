import { chromium } from 'playwright';
import fs from 'node:fs';

// Programmatic "eyes": for each vantage point, measures what the
// frame actually contains — moon placement + occlusion, centre-of-frame
// target, exposure bands, warm-light share, colour variety — so the
// world can be critiqued without human eyes on every shot.

const VIEWS = [
  { name: '01-square-opening', p: [3, 2.0, 0], t: [-1, 3, -9], wantMoon: false, note: 'hub: station across the square' },
  { name: '02-street-south', p: [0, 1.8, 12], t: [0, 3.2, 30], wantMoon: true, note: 'moon grazes the street-mouth tree' },
  { name: '03-street-back-north', p: [0, 1.8, 21], t: [0, 3, -2], wantMoon: false, note: 'street looking back at station' },
  { name: '04-promenade-west', p: [22.5, 1.9, 29.6], t: [-50, 1.8, 30.8], wantMoon: true, note: 'railing + lamps + moon upper right' },
  { name: '05-bridge-crest', p: [14, 3.4, 36], t: [-14, 11, 50], wantMoon: true, note: 'moon over water from bridge, off-centre' },
  { name: '06-hill-road-crossing', p: [-9, 1.8, -8], t: [-14.5, 1.5, -16], wantMoon: false, note: 'crossing deck + hill mass' },
  { name: '07-observatory-town', p: [-50, 14.2, -27], t: [-6, 2, 24], wantMoon: true, note: 'town below, moon above rooftops' },
  { name: '08-terrace-moon', p: [24, 1.8, 47], t: [-18, 10, 62], wantMoon: true, note: 'moon over rooftops from the far bank' },
  { name: '09-station-platform', p: [3, 1.6, -12.5], t: [-8, 2.2, -11], wantMoon: false, note: 'platform + parked train' },
  { name: '10-promenade-mid', p: [-14, 1.8, 29.5], t: [-40, 3, 31], wantMoon: false, note: 'lamps + railing + water, no moon' },
];

let browser;
try { browser = await chromium.launch({ headless: true }); }
catch { browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] }); }
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
await page.waitForTimeout(6000);

// font + wiring sanity
const sanity = await page.evaluate(() => ({
  cjkFont: document.fonts.check('16px "Noto Sans CJK JP"') || document.fonts.check('16px "Noto Sans CJK SC"'),
  toolsWired: !!window.__moon,
  moonHome: window.__moon ? window.__moon.sceneInfo().moon.pos : null,
}));
console.log('SANITY', JSON.stringify(sanity));

const results = [];
for (const v of VIEWS) {
  await page.evaluate(([px, py, pz, tx, ty, tz]) => window.__moon.viewFrom(px, py, pz, tx, ty, tz), [...v.p, ...v.t]);
  await page.waitForTimeout(450);
  const buf = await page.screenshot({ fullPage: false });

  const stats = await page.evaluate(async (pngBase64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + pngBase64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const W = c.width, H = c.height;
    let lum = 0, dark = 0, bright = 0, warm = 0;
    const bands = [0, 0, 0];
    const hueBins = new Array(32).fill(0);
    let hueCounted = 0;
    for (let y = 0; y < H; y += 3) {
      for (let x = 0; x < W; x += 3) {
        const i = (y * W + x) * 4;
        const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        lum += l;
        if (l < 0.04) dark++;
        if (l > 0.85) bright++;
        if (r > 0.22 && r > g * 1.15 && g > b * 0.9) warm++;
        bands[Math.min(2, Math.floor(y / H * 3))] += l;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        if (mx > 0.06) {
          let hue = 0;
          if (mx === r) hue = ((g - b) / (mx - mn || 1) + 6) % 6;
          else if (mx === g) hue = (b - r) / (mx - mn || 1) + 2;
          else hue = (r - g) / (mx - mn || 1) + 4;
          hueBins[Math.min(31, Math.floor(hue * 32 / 6))]++;
          hueCounted++;
        }
      }
    }
    const n = Math.ceil(W / 3) * Math.ceil(H / 3);
    let entropy = 0;
    for (const hBin of hueBins) {
      if (hBin === 0) continue;
      const p = hBin / hueCounted;
      entropy -= p * Math.log2(p);
    }
    return {
      meanLum: +(lum / n).toFixed(3),
      crushed: +(dark / n).toFixed(3),
      blown: +(bright / n).toFixed(3),
      warmShare: +(warm / n).toFixed(3),
      bandTop: +(bands[0] / (n / 3)).toFixed(3),
      bandMid: +(bands[1] / (n / 3)).toFixed(3),
      bandBot: +(bands[2] / (n / 3)).toFixed(3),
      hueEntropy: +entropy.toFixed(2),
    };
  }, buf.toString('base64'));

  const geo = await page.evaluate(() => window.__moon.frameInfo());
  results.push({ name: v.name, note: v.note, wantMoon: v.wantMoon, stats, geo });
}

fs.writeFileSync('agent/shots/analysis.json', JSON.stringify(results, null, 2));

// compact report
for (const r of results) {
  const s = r.stats;
  const g = r.geo;
  const occl = g.moonOccluders.map((o) => `${o.what}@(${o.at.join(',')})`).slice(0, 2).join(' ');
  const moonStr = r.wantMoon
    ? `moonNDC=(${g.moonNDC}) vis=${g.moonVisible} blocked=${g.moonBlockedFrac}${occl ? ' by ' + occl : ''}`
    : 'moon: not wanted';
  console.log(
    `${r.name.padEnd(24)} lum=${s.meanLum} crush=${s.crushed} blown=${s.blown} warm=${s.warmShare} ` +
    `top=${s.bandTop} mid=${s.bandMid} bot=${s.bandBot} ent=${s.hueEntropy} | centre=${g.centreHit}@${g.centreDist} | ${moonStr}`,
  );
}
await browser.close();
console.log('analysis written to agent/shots/analysis.json');
