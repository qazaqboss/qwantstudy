"""Озвучка QwantStudy моделью OmniVoice (k2-fsa/OmniVoice из проекта VoiceStudio).

Голос один на весь сайт: сначала создаём эталон через voice design, затем озвучиваем
все фразы клонированием эталона, чтобы тембр не менялся от фразы к фразе.

Подготовка:
    git clone https://github.com/debpalash/VoiceStudio  # нужен пакет omnivoice
    pip install torch "transformers>=5.10" accelerate pydub soundfile psutil
    node tools/list-texts.mjs > texts.json

Шаги:
    PYTHONPATH=VoiceStudio python tools/generate-voice.py design --out refs/   # 4 варианта голоса
    PYTHONPATH=VoiceStudio python tools/generate-voice.py build --ref tools/voice-reference.wav --texts texts.json --steps 16
    python tools/check-voice.py texts.json   # проверка распознаванием (faster-whisper)
"""
import argparse
import json
import os
import subprocess
import sys
import time

import soundfile as sf
import torch

REF_TEXT = ("Привет! Я ваш квантовый гид. Сегодня мы заглянем внутрь атома "
            "и узнаем, как устроен микромир.")
INSTRUCT = "female, young adult, moderate pitch"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "audio", "voice")


def load():
    from omnivoice.models.omnivoice import OmniVoice
    torch.set_num_threads(os.cpu_count() or 4)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = OmniVoice.from_pretrained(os.environ.get("OMNIVOICE_MODEL", "k2-fsa/OmniVoice"),
                                      device_map=device, dtype=torch.float32 if device == "cpu" else torch.float16)
    return model


def design(args):
    model = load()
    os.makedirs(args.out, exist_ok=True)
    for i in range(args.n):
        torch.manual_seed(1000 + i)
        t = time.time()
        audio = model.generate(text=REF_TEXT, language="Russian", instruct=INSTRUCT, num_step=args.steps)[0]
        path = os.path.join(args.out, f"voice_{i}.wav")
        sf.write(path, audio.squeeze(0).float().cpu().numpy(), model.sampling_rate)
        print(f"{path}: {audio.shape[-1] / model.sampling_rate:.1f}s за {time.time() - t:.0f}s", flush=True)


def to_mp3(wav, mp3):
    # моно, громкость по EBU R128, 64 кбит/с — хватает для речи и быстро грузится
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-af", "loudnorm=I=-17:TP=-1.5:LRA=9",
                    "-ac", "1", "-ar", "24000", "-b:a", "64k", mp3], check=True)
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3],
                         capture_output=True, text=True, check=True)
    return round(float(out.stdout.strip()), 2)


def build(args):
    model = load()
    os.makedirs(OUT_DIR, exist_ok=True)
    manifest_path = os.path.join(OUT_DIR, "manifest.json")
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
    items = json.load(open(args.texts))
    # порядок из list-texts: сначала тур, затем сцены, понятия, история, структуры, тест
    if args.only:
        keys = set(args.only.split(','))
        items = [x for x in items if x['key'] in keys]
        for x in items:
            manifest.pop(x['key'], None)
    if args.limit:
        items = items[:args.limit]
    data, sr = sf.read(args.ref, dtype="float32", always_2d=True)
    prompt = model.create_voice_clone_prompt(ref_audio=(torch.from_numpy(data.T), sr), ref_text=REF_TEXT)
    for n, it in enumerate(items, 1):
        key = it["key"]
        mp3 = os.path.join(OUT_DIR, f"{key}.mp3")
        if key in manifest and os.path.exists(mp3):
            continue
        t = time.time()
        torch.manual_seed(args.seed)
        audio = model.generate(text=it["spoken"], language="Russian", voice_clone_prompt=prompt,
                               num_step=args.steps, speed=args.speed)[0]
        wav = mp3[:-4] + ".wav"
        sf.write(wav, audio.squeeze(0).float().cpu().numpy(), model.sampling_rate)
        manifest[key] = to_mp3(wav, mp3)
        os.remove(wav)
        json.dump(manifest, open(manifest_path, "w"), ensure_ascii=False, indent=0, sort_keys=True)
        print(f"[{n}/{len(items)}] {key} {manifest[key]}s за {time.time() - t:.0f}s: {it['spoken'][:60]}", flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("design"); d.add_argument("--out", default="refs"); d.add_argument("--n", type=int, default=4)
    d.add_argument("--steps", type=int, default=32)
    b = sub.add_parser("build"); b.add_argument("--ref", required=True); b.add_argument("--texts", required=True)
    b.add_argument("--steps", type=int, default=32); b.add_argument("--speed", type=float, default=1.0)
    b.add_argument("--limit", type=int, default=0)
    b.add_argument("--only", default="", help="перегенерировать только эти ключи (через запятую)")
    b.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()
    {"design": design, "build": build}[a.cmd](a)
    sys.exit(0)
