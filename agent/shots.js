import { chromium } from 'playwright';

// Multi-view screenshot runner, robust edition: a fresh page per view
// (the heavy scene occasionally stalls SwiftShader; fresh pages recover).

const VIEWS = [
  { name: '01-square-opening', p: [3, 2.0, 0], t: [-1, 3, -9] },
  { name: '02-street-south', p: [0, 1.8, 12], t: [0, 3.2, 30] },
  { name: '03-street-back-north', p: [0, 1.8, 21], t: [0, 3, -2] },
  { name: '04-promenade-west', p: [22.5, 1.9, 29.6], t: [-50, 1.8, 30.8] },
  { name: '05-bridge-crest', p: [14, 3.4, 36], t: [-14, 11, 50] },
  { name: '06-hill-road-crossing', p: [-9, 1.8, -8], t: [-14.5, 1.5, -16] },
  { name: '07-observatory-town', p: [-50, 14.2, -27], t: [-6, 2, 24] },
  { name: '08-terrace-moon', p: [24, 1.8, 47], t: [-18, 10, 62] },
  { name: '09-station-platform', p: [3, 1.6, -12.5], t: [-8, 2.2, -11] },
  { name: '10-promenade-mid', p: [-14, 1.8, 29.5], t: [-40, 3, 31] },
  { name: '11-avatar-front', p: [6.6, 0, -4.6], t: [5.2, 1.1, -3.2] },
  { name: '12-avatar-under-lamp', p: [-13.6, 0, -6.4], t: [-11.3, 1.4, -5.2] },
  { name: '13-mela-balloon', p: [4.5, 1.9, -1.5], t: [-7, 14, -2] },
  { name: '14-balloon-river', p: [13, 3.2, 35.5], t: [-34, 17, 48] },
  { name: '15-cat-platform', p: [-3.4, 1.6, -10.4], t: [-5.5, 1.5, -12.1] },
  { name: '16-cat-awning', p: [-2.4, 1.7, 7.6], t: [-4.2, 3.1, 6.2] },
  { name: '17-cow-promenade', p: [-30, 1.8, 28.2], t: [-36.5, 1.5, 27.9] },
  { name: '18-cow-calf', p: [20.8, 1.8, 42.8], t: [24.5, 1.3, 44.5] },
  { name: '19-bats-ghat', p: [-8, 2.6, 28.6], t: [2, 11, 37] },
  { name: '20-ghat-life', p: [-10.4, 2.4, 26.4], t: [-12.7, 0.5, 31.6] },
  { name: '21-moon-disc', p: [-10, 2.0, 29.6], t: [-20, 19, 58] },
  { name: '22-terrace-cow-cat', p: [21.5, 1.8, 45.6], t: [26.5, 2.2, 48.5] },
  { name: '23-square-life', p: [9, 2.2, 0.5], t: [-11, 1.2, -5.5] },
  { name: '24-lane-women', p: [2.8, 1.9, 15.5], t: [-3.2, 1.3, 15.5] },
  { name: '25-kite-sky', p: [-3.5, 2.6, 29.2], t: [3.5, 13.5, 40.5] },
  { name: '26-chaiwala', p: [9, 1.9, -0.9], t: [12.2, 1.3, -3.2] },
  { name: '27-sweets-owner', p: [-1.2, 1.8, 6.8], t: [-4.0, 1.5, 4.0] },
  { name: '28-terrace-peacock', p: [17.5, 2.6, 33.5], t: [26, 3.4, 48.4] },
  { name: '29-ghat-matka', p: [-5.5, 2.4, 27.2], t: [-2.2, 0.4, 31.8] },
  { name: '30-old-man-cow', p: [-30.5, 1.9, 26.8], t: [-35.5, 1.4, 27.9] },
  { name: '31-rickshaw-sleeper', p: [14.2, 1.6, -8.0], t: [12.3, 0.9, -4.9] },
  { name: '32-moon-down', p: [-8.5, 2.0, 28.8], t: [10, 8.2, 44], moonDown: true },
  { name: '33-moon-down-bridge', p: [14, 3.6, 36.5], t: [10, 8.2, 44], moonDown: true },
];

let browser;
try { browser = await chromium.launch({ headless: true }); }
catch {
  browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
}

async function shoot(v) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  try {
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(7000);
    if (v.moonDown) {
      await page.evaluate(() => window.__moon.moonDown());
      // poll until she actually arrives (headless rAF throttles)
      for (let i = 0; i < 60; i++) {
        const pos = await page.evaluate(() => window.__moon.sceneInfo().moon.pos);
        if (Math.hypot(pos[0] - 10, pos[1] - 8.6, pos[2] - 44) < 1.5) break;
        await page.waitForTimeout(1000);
      }
    }
    await page.evaluate(([px, py, pz, tx, ty, tz]) => {
      window.__moon.viewFrom(px, py, pz, tx, ty, tz);
    }, [...v.p, ...v.t]);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `agent/shots/${v.name}.png`, fullPage: false, timeout: 45000 });
    console.log(`captured ${v.name}`);
    return true;
  } catch (e) {
    console.log(`FAILED ${v.name}: ${e.message.split('\n')[0].slice(0, 80)}`);
    return false;
  } finally {
    await page.close().catch(() => {});
  }
}

for (const v of VIEWS) {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (await shoot(v)) break;
  }
}
await browser.close();
console.log('All views captured.');
