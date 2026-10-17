# Chandpur — Get You the Moon

A harvest-fair day in a little Indian railway town, built procedurally in
Three.js. Help the villagers get ready for the **Fasal Mela**: gather
marigolds in the mustard fields, carry laddoos to the farmer, pick mangoes
across the river, fly the hot-air balloon, ring the shrine bell at dusk,
light the ghats — and bring down the moon.

```sh
npm install
npm run dev
```

Open **http://localhost:5173** and press **Begin the Day**. Progress saves
automatically (localStorage); **Continue** resumes it.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Walk |
| Shift | Run |
| Space | Jump |
| Mouse (click the world first) / drag | Look around |
| Wheel | Camera distance |
| E | Talk, light a diya, rest on a charpai, ring the bell, board / leave the balloon |
| Tab | Valley map |
| M | Bring down / send home the moon |
| C | Cinema (orbit) view |
| H | How to play · reset progress |
| Esc | Release the cursor / close a panel |

## The valley

| Place | What's there |
| --- | --- |
| Old Railway Station | Chai stall (Ramu), bunting over the forecourt, the night passenger |
| Old Bazaar | Sharma ji's sweet shop, cloth and brass shops, jhandiyan across the lane |
| Sarson Fields (east) | Mustard, wheat, sugarcane, marigold and vegetable plots; Baldev Kaka's thatched farmstead with buffaloes, bullock cart, tractor, tubewell, well, haystacks, kites; Dadaji under the banyan |
| Paddy Fields (west) | Flooded rice terraces with egrets and planters, coconut palms, banana grove, lotus pond, wayside shrine, Ganga Devi's homestead |
| Riverside Ghats | Stone steps, diyas to light, the footbridge |
| Mango Orchard (across the river) | Munni Didi, mango trees, jhoola swing, machan |
| Balloon Landing ↔ Fort Shoulder | Scenic balloon flight (Captain Bhola) |
| Hill Village, Hill Fort, Shrine Hill | Terraced houses, ramparts, the shrine bell |

## Game systems

- **Quests** (`src/game/quests.js`, run by `src/game/game.js`): a 12-step story
  with talk, collect, reach, interact, light-the-diyas and moon steps, rupee
  rewards, district-discovery bonuses and a fireworks finale.
- **People** (`src/game/npcs.js`): farm folk in pagdis and sarees plus the
  town's existing residents, all talkable with idle lines and quest hints.
- **Pickups** (`src/game/pickups.js`): marigolds, mangoes, old rupee coins on
  every lane, an objective marker and fireworks.
- **Day cycle** (`src/world/daycycle.js`, `src/world/sky.js`): about a 12-minute day
  with sun, clouds, dusk and the original moonlit night. Lights, fog, windows,
  lamp glows, river colour and the post grade all follow the hour.
- **Farms** (`src/world/farm-kit.js`, `src/world/districts/farms.js`):
  instanced low-poly crops swaying in a shared breeze, terraced plots cut into
  the terrain (`FARM_PLOTS` in `src/world/layout.js`).
- **HUD** (`src/ui/game-hud.js`): quest card, compass, rotating minimap, clock,
  wallet, dialogue, banners, title screen, help and valley map.
- **Sound** (`src/audio/music.js`): a generative Raag Bhupali (tanpura, bansuri,
  tabla), birdsong by day, crickets by night, the moon lullaby for the finale,
  and game sound effects.

## Verification

With the dev server running:

```sh
npm run test:town          # connectivity, walking, balloon, life, HUD checks
node agent/playtest.mjs <out-dir> [--from <step>]   # drives the quest chain with screenshots
node agent/game-shots.mjs <out-dir> [--time 0.38]   # daytime captures of each district
npm run build
```

`WORLD_DESIGN.md` records the original town-design principles.
