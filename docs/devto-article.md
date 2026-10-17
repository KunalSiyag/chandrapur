**Chandrapur** is a small browser game about one day in a North Indian railway
town: the day of the *Fasal Mela*, the harvest fair. You step off the morning
train, help the villagers get ready — marigolds for the sweet-maker's garlands,
laddoos for a farmer who forgets to eat, mangoes from across the river — ring
the shrine bell at dusk, light the diyas on the ghats, and bring the moon down
to the river.

Everything you see is generated in code with Three.js: no 3D assets. This
week I gave it three things it was missing — **a real soundtrack, villagers who
talk back, and a realistic atmosphere** — and this post is about how.

🎮 **Code:** https://github.com/KunalSiyag/chandrapur · 🎵 **The song:** [chanda-utar-aa.mp3](https://github.com/KunalSiyag/chandrapur/blob/main/public/audio/chanda-utar-aa.mp3)

![Ramu Chaiwala answering a question at the station chai stall](https://raw.githubusercontent.com/KunalSiyag/chandrapur/main/docs/images/voice-chat-ramu.jpg)

## 1. A soundtrack written as data, rendered with ACE-Step

[ACE-Step](https://github.com/ace-step/ACE-Step) is an open-weight music
generation model that sings lyrics. I wanted the finale to have a song, in
Hindi, about the moon coming down: *Chanda Utar Aa* (“Moon, come down”), in
Raag Bhupali, the pentatonic raga the game's procedural music already used.

Each song is a JSON file next to the code:

```json
{
  "title": "Chanda Utar Aa (Moon, Come Down)",
  "caption": "indian folk ballad, hindustani classical fusion, raag bhupali, female vocal, warm intimate voice, bansuri flute, tanpura drone, tabla, harmonium, santoor, acoustic, live room recording, gentle, nostalgic",
  "language": "hi", "bpm": 84, "key": "C major", "duration": 165,
  "lyrics": "[verse]\nसरसों के खेतों में, धूप ने गाया गीत\n…",
  "lyrics_latin": "[verse]\nSarson ke kheton mein, dhoop ne gaaya geet\n…"
}
```

A short script (`tools/acestep.py`, runnable with `uv run`) sends it to the
official ACE-Step Hugging Face Space through `gradio_client` and saves each
take with its seed. My laptop GPU has 4 GB, so ZeroGPU doing the work was the
whole point.

Two things I learned the hard way:

- **ACE-Step 1.5's Space reserves 180 s of GPU per request** — more than an
  anonymous user's daily ZeroGPU quota. The v1 Space reserves far less, so the
  script supports both engines (`--engine v1|v15`), and v1 gets the lyrics in
  romanized Hindi, which it pronounces much better than Devanagari.
- **Check that it actually sang your words.** I ran the take through Whisper,
  and the chorus came back nearly verbatim: *“चंदा उतरा, चंदा उतरा … माँ की
  लोरी बनके, आँखों में बस जा”*. Whisper's word timestamps then gave me line timings
  for **on-screen karaoke** in Hindi and English during the finale.

In the game, recorded pieces play through and then the valley rests on
ambience for half a minute or so — like a film score, not a radio. When no
recording is sounding (or a file is missing), the old generative WebAudio raga
fills in, so nothing ever goes silent or breaks.

## 2. Villagers you can talk to

Every NPC already had scripted quest lines. Now:

- **Every line is spoken**, in a voice that fits the person: Dadaji slow and
  low, Chotu fast and high, Captain Bhola booming.
- **Press T next to anyone and just talk** — into the mic or by typing.

```
🎙 speech recognition (en-IN) ─┐
⌨  typed text                  ├─► POST /api/npc ─► GLM-5.3-Flash on GMI Cloud (any OpenAI-compatible model)
                               │    persona + valley + hour + place + quest + inventory
🗣 scripted lines ◄── pre-rendered Inworld TTS-2 clips, directed per villager
   live replies   ◄── /api/tts → Inworld TTS-2 Flash on GMI Cloud (same voice, ~2 s)
```

The design choices that mattered:

**One source of truth for who people are.** `src/game/characters.js` holds
each villager's name, role, personality, idle lines and voice settings, plus
a short world brief. The browser uses it for the scripted dialogue; the server
uses the same file to build the system prompt. Ramu sounds like Ramu in both.

**Context makes them feel intelligent, not the model size.** Each request
carries the in-game clock, where you're standing, your current quest and
what you're carrying, plus a short brief of the valley. The system prompt
asks for one to three short sentences, because every answer is read aloud.
A few real answers from Ramu, at the station, mid-afternoon:

> **“Where is the mango orchard?”** — *Arre beta, Munni Didi's mango orchard
> is across the river, ji. From my stall go…*
>
> **“What train did I come on?”** — *Arre beta, you came on the 6:40 passenger
> this morning, I remember it well!*
>
> **“kya haal hai?”** — *Arre beta, sab khush-hal! Bas Fasal Mela ka josh
> dekho — puri valley saja hui hai…*
>
> **“Are you an AI?”** — *Arre beta, what is this AI-AYE? I am Ramu, thirty
> years at this stall…*

The 6:40 passenger is in his idle lines; the orchard directions come from
the valley brief; nobody told him to switch to Hinglish when you do.

**A cast, not a voice.** Each villager has a voice and an acting note:
Ramu is a chatty chai seller, Dadaji speaks slowly and a little hoarse,
Chotu is a breathless nine-year-old. All 132 scripted lines are
pre-rendered with Inworld TTS-2 (directed by those notes) for about twenty
cents, so quest dialogue plays instantly — even from a static host with no
server at all. Free-conversation replies go through the faster Flash model
live. I checked every rendered clip against its script with Whisper.

**One key.** GMI Cloud serves both halves: GLM-5.3-Flash for the brain
(median 1.6 s for an in-character answer) and Inworld TTS through its
request queue for the voices. A first version timed out and retried on the
occasional stalled request, which meant 23-second waits; now a second
request is fired after 2.5 s and whichever answers first wins. (My first
implementation of that hedge referenced a promise before it existed, so it
never fired. The end-to-end test that forces a stalled request caught it.)

**Keys stay on the server.** The endpoint is a tiny Connect-style middleware
that runs inside Vite in development (`configureServer` /
`configurePreviewServer`) and inside a 30-line Node server in production. It
caps input sizes, keeps the last 10 turns per villager, rate-limits, and
strips `<think>` blocks from reasoning models.

**It degrades gracefully.** No API key, or hosted as static files? The
villagers still answer from their own lines and quest hints (“where is Munni
Didi?” gets real directions), and the browser's speech synthesis still gives
each one a distinct voice. The music ducks whenever anyone speaks.

**Tested end to end.** `npm run test:voice` starts a stand-in
OpenAI-compatible server, points Vite at it, then a Playwright browser walks
up to Ramu, presses T, types a question, and checks the reply, the context
the model received, that the scripted line played its pre-rendered clip,
the live speech request, a forced stall, the offline fallback, and that
typing “wasd” into the chat box never moves the player.

## 3. A realistic atmosphere

The town started life as an anime cel-shaded scene: toon ramps, screen-space
ink outlines, indigo night shadows. Pretty, but it fought the soundtrack —
a live-room recording of a bansuri over a cartoon. So the renderer went
physically based:

- **Materials.** The `toonMaterial()` factory that two dozen files call kept
  its name and now returns `MeshStandardMaterial` with surface presets
  (plaster, earth, wood, cloth, foliage, metal, water). The old “hand-painted”
  world-space noise became weathering: a little colour drift, grime and
  roughness variation, so flat-coloured low-poly walls stop looking like
  plastic.
- **One sky lights everything.** A Preetham physical sky follows the sun; a
  CPU copy of the same model gives the fog colour and the sun's colour, so
  haze, light and horizon always agree. The sky also feeds a PMREM
  environment map for image-based lighting, rebuilt only when the sun has
  moved more than 0.8° — cheap enough for a 12-minute day.
- **Air.** Fog is height-aware (thicker down in the valley, thinner on the
  hill), golden by day, blue at dusk, dark at night.
- **Camera.** The ink pass is gone, which halved draw calls. In its place:
  half-res ambient occlusion, bloom only on genuinely bright things (lamps,
  the moon), a warm glare veil toward the sun, AgX tone mapping with exposure
  driven by the hour, a gentle warm/cool grade, vignette and grain.
- **Water.** The river is dark and silty, with rippled normals reflecting the
  sky — and the moon's path on it when she comes down for the finale.

Same camera, same hour (dusk), before and after:

![Before: the station at dusk, cel-shaded](https://raw.githubusercontent.com/KunalSiyag/chandrapur/main/docs/images/before-toon-dusk-station.jpg)

![After: the station at dusk, physically based](https://raw.githubusercontent.com/KunalSiyag/chandrapur/main/docs/images/realistic-dusk-station.jpg)

And the finale, with the moon's reflection on the river:

![The moon comes down to the river](https://raw.githubusercontent.com/KunalSiyag/chandrapur/main/docs/images/realistic-night-moon-finale.jpg)

It's still a low-poly town, so it reads as a *realistically lit* stylised
world rather than photoreal — which, honestly, is the look I wanted.

## What's next

- Render the night piece and the fair music (the specs are already in
  `music/songs/`) with ACE-Step 1.5 and a Hugging Face token.
- Let villagers react in the world, not just in words — point the way,
  walk you somewhere.

Clone it, `npm install && npm run dev`, and press **Begin the Day**. With
no key at all the villagers still speak their scripted lines and answer
from what they know; add a GMI Cloud key to `.env` and they really talk.

*Music generated with ACE-Step (Apache-2.0); villager voices by Inworld
TTS-2 via GMI Cloud. Lyrics written for the game.*
