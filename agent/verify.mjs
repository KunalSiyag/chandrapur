import { chromium } from 'playwright';

// Headless verification v6: cinema/orbit mode gives a deterministic
// camera (flyTo 0.05 s), so probes land where they aim.

let browser;
try {
  browser = await chromium.launch({ headless: true });
} catch {
  browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
}

const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
await page.waitForTimeout(6000);

// deterministic camera from here on
await page.evaluate(() => window.__moon.cinemaMode(true));
await page.waitForTimeout(800);

const find = (n) => page.evaluate((name) => window.__moon.find(name), n);
const project = (w) => page.evaluate(([x, y, z]) => window.__moon.project(x, y, z), w);
const view = async (px, py, pz, tx, ty, tz) => {
  await page.evaluate(([a, b, c, d, e, f]) => window.__moon.viewFrom(a, b, c, d, e, f), [px, py, pz, tx, ty, tz]);
  await page.waitForTimeout(400);
};

async function probeRegion(x, y, half = 40) {
  const cx = Math.max(2, Math.min(1598 - half * 2, x - half));
  const cy = Math.max(2, Math.min(898 - half * 2, y - half));
  const buf = await page.screenshot({ clip: { x: cx, y: cy, width: half * 2, height: half * 2 }, timeout: 60000 });
  const b64 = buf.toString('base64');
  return await page.evaluate(async ([b64, w, h]) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, w, h).data;
    let mx = 0, best = [0, 0, 0];
    let r0 = 0, g0 = 0, b0 = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
      if (l > mx) { mx = l; best = [d[i], d[i + 1], d[i + 2]]; }
      r0 += d[i]; g0 += d[i + 1]; b0 += d[i + 2];
    }
    const n = d.length / 4;
    return { avg: [Math.round(r0 / n), Math.round(g0 / n), Math.round(b0 / n)], max: best };
  }, [b64, half * 2, half * 2]);
}

async function probeWorld(name, w, half = 40) {
  const r = await project(w);
  if (!r.visible) return { name, offscreen: true };
  const p = await probeRegion(r.x, r.y, half);
  return { name, at: [r.x, r.y], ...p };
}

/** stand the orbit camera at [px,py,pz], aim exactly at the found landmark, probe */
async function probeNamed(name, camPos, half = 40, up = 0) {
  const found = await find(name);
  if (!found.length) return { name, missing: true };
  const [x, y, z] = found[0];
  await view(camPos[0], camPos[1], camPos[2], x, y + up, z);
  const r = await project([x, y + up, z]);
  if (!r.visible) return { name, offscreen: true, pos: found[0] };
  const p = await probeRegion(r.x, r.y, half);
  return { name, at: [r.x, r.y], pos: found[0], ...p };
}

const out = {};

// ---- the moon disc, from the ghat ----
await view(-8.5, 2.2, 28.8, -20, 20, 58);
out.moonDisc = await probeWorld('moon-disc', [-20, 20, 58]);

// ---- people, each aimed from its own station ----
out.chaiWala = await probeNamed('chai-wala', [8.5, 2.0, -0.6], 40, 0.9);
out.sweetsOwner = await probeNamed('sweets-owner', [-1.0, 1.9, 7.2], 40, 0.9);
out.womanA = await probeNamed('woman-a', [3.5, 1.9, 14.0], 40, 0.9);
out.womanB = await probeNamed('woman-b', [3.5, 1.9, 14.0], 40, 0.9);
out.kidA = await probeNamed('kid-a', [-11, 1.9, -1.2], 36, 0.55);
out.kidB = await probeNamed('kid-b', [-11, 1.9, -1.2], 36, 0.55);
out.kiteBoy = await probeNamed('kite-boy', [-4.2, 2.0, 27.2], 36, 0.65);
out.kite = await probeNamed('kite', [-4.2, 2.0, 27.2], 30, 0);
out.oldMan = await probeNamed('old-man', [-30, 1.9, 26.5], 40, 1.0);
out.matkaWoman = await probeNamed('matka-woman', [-5.5, 2.2, 27.0], 40, 1.0);
out.moonGazer = await probeNamed('moon-gazer', [-3.0, 2.0, 29.0], 40, 1.15);
out.chaiDrinker = await probeNamed('chai-drinker', [-9.8, 1.9, 27.5], 40, 0.8);
out.rickshawSleeper = await probeNamed('rickshaw-sleeper', [14.0, 2.2, -8.2], 40, 0.5);
out.peacock = await probeNamed('peacock', [12.0, 2.6, 34.5], 36, 0.2);
out.decoratedCow = await probeNamed('cow-decorated', [-30.5, 1.8, 27.0], 44, 1.1);
out.calf = await probeNamed('calf', [20.5, 1.9, 43.0], 40, 0.6);
out.balloon1 = await probeNamed('balloon-drift', [10.0, 3.4, 34.0], 60, 0);
out.melaBalloon = await probeNamed('balloon-mela', [4.5, 2.2, -1.0], 60, 0);

// ---- moon down, polled ----
await page.evaluate(() => window.__moon.moonDown());
{
  let pos = null;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(1000);
    pos = await page.evaluate(() => window.__moon.sceneInfo().moon.pos);
    if (Math.hypot(pos[0] - 10, pos[1] - 8.6, pos[2] - 44) < 1.5) break;
  }
  out.moonArrived = pos;
  await view(-6.0, 2.2, 28.5, 10, 8.6, 44);
  out.moonDown = await probeWorld('moon-down', [10, 8.6, 44], 50);
}

out.consoleErrors = errors.slice(0, 20);
console.log(JSON.stringify(out, null, 2));
await browser.close();
