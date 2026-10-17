# /// script
# requires-python = ">=3.10"
# dependencies = ["gradio_client>=1.3"]
# ///
"""
Render Chandrapur's soundtrack with ACE-Step.

Each song lives in music/songs/<slug>.json (caption, lyrics, bpm, key, ...).
The script sends it to an official ACE-Step Hugging Face Space (ZeroGPU, no
local GPU needed) and saves every take as music/takes/<slug>/<slug>-<n>.mp3,
logging the seed and settings to takes.jsonl so a good take can be
re-rendered later.

    uv run tools/acestep.py music/songs/chanda-utar-aa.json
    uv run tools/acestep.py music/songs/*.json --engine v15 --batch 2
    HF_TOKEN=... uv run tools/acestep.py ...   # more ZeroGPU quota

Engines:
  v1   ACE-Step/ACE-Step (3.5B). Light on quota; sings romanized lyrics
       ("lyrics_latin") best.
  v15  ACE-Step/Ace-Step-v1.5 (XL turbo + 5Hz LM planner). Better vocals and
       native Hindi, but each request reserves 180 s of ZeroGPU time, more
       than an anonymous user gets per day: set HF_TOKEN.

Pick the best take and copy it to public/audio/<slug>.mp3.
"""
import argparse
import json
import os
import random
import shutil
import sys
import time
from pathlib import Path

from gradio_client import Client
from gradio_client.exceptions import AppError

SPACES = {"v1": "ACE-Step/ACE-Step", "v15": "ACE-Step/Ace-Step-v1.5"}
ROOT = Path(__file__).resolve().parent.parent


def tags(song):
    """v1 conditions on comma tags; fold tempo and key into them."""
    extra = [f"{song['bpm']} BPM"] if song.get("bpm") else []
    if song.get("key"):
        extra.append(song["key"])
    return ", ".join([song["caption"], *extra])


def render_v1(client, song, batch, seed):
    files, seeds = [], []
    for i in range(batch):
        s = random.randrange(2**31) if seed is None else seed + i
        path, params = client.predict(
            audio_duration=song.get("duration", 120),
            prompt=tags(song),
            lyrics=song.get("lyrics_latin") or song.get("lyrics", "[instrumental]"),
            infer_step=song.get("steps_v1", 60),
            guidance_scale=song.get("guidance_v1", 15.0),
            manual_seeds=str(s),
            api_name="/__call__",
        )
        files.append(path)
        seeds += params.get("actual_seeds", [])
    return files, seeds


def render_v15(client, song, batch, seed):
    out = client.predict(
        selected_model=song.get("model", "acestep-v15-xl-turbo"),
        generation_mode="custom",
        simple_query_input="",
        simple_vocal_language=song.get("language", "en"),
        param_4=song["caption"],
        param_5=song.get("lyrics", "[Instrumental]"),
        param_6=song.get("bpm", 0),
        param_7=song.get("key", ""),
        param_8=str(song.get("time_signature", "")),
        param_9=song.get("language", "en"),
        param_10=song.get("steps", 8),
        param_11=song.get("guidance", 7.0),
        param_12=seed is None,
        param_13=str(seed if seed is not None else -1),
        param_14=None,
        param_15=song.get("duration", -1),
        param_16=batch,
        param_17=None,
        param_18="",
        param_23="text2music",
        param_27=song.get("shift", 3.0),
        param_30="mp3",
        param_32=song.get("think", True),
        param_47="vocals",
        api_name="/generation_wrapper",
    )
    return [f for f in out[:8] if f], out[11]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("songs", nargs="+", type=Path)
    ap.add_argument("--engine", choices=SPACES, default="v1")
    ap.add_argument("--batch", type=int, default=1)
    ap.add_argument("--seed", type=int, default=None)
    args = ap.parse_args()

    space = SPACES[args.engine]
    client = Client(space, token=os.environ.get("HF_TOKEN"), verbose=False)
    render = render_v1 if args.engine == "v1" else render_v15
    for path in args.songs:
        song = json.loads(path.read_text())
        slug = path.stem
        dest = ROOT / "music" / "takes" / slug
        dest.mkdir(parents=True, exist_ok=True)
        print(f"[acestep] {slug} ({args.engine}): {song['caption'][:70]}…", flush=True)
        t0 = time.time()
        try:
            files, seeds = render(client, song, args.batch, args.seed)
        except AppError as e:
            sys.exit(f"[acestep] {slug}: {e}")
        if not files:
            sys.exit(f"[acestep] {slug}: no audio returned")
        start = len(list(dest.glob(f"{slug}-*.mp3")))
        takes = []
        for i, f in enumerate(files):
            out = dest / f"{slug}-{start + i + 1}.mp3"
            shutil.copy(f, out)
            takes.append(out.name)
            print(f"[acestep]   -> {out.relative_to(ROOT)}")
        with (dest / "takes.jsonl").open("a") as fh:
            fh.write(json.dumps({"takes": takes, "engine": args.engine, "space": space, "seeds": seeds,
                                 "seconds": round(time.time() - t0, 1)}) + "\n")
        print(f"[acestep]   seeds {seeds} · {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
