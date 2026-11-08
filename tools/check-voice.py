"""Проверка озвучки: распознаёт каждый клип Whisper-ом и сравнивает с текстом (доля ошибок по символам)."""
import sys, os, json, difflib, re
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
from faster_whisper import WhisperModel
m = WhisperModel("small", device="cpu", compute_type="int8")
norm = lambda s: re.sub(r"[^а-яёa-z0-9 ]", "", s.lower().replace("ё", "е"))
def load16(path):
    import subprocess, numpy as np
    raw = subprocess.run(["ffmpeg","-v","error","-i",path,"-f","f32le","-ac","1","-ar","16000","-"],capture_output=True,check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)
def check(path, ref):
    segs, _ = m.transcribe(load16(path), language="ru", beam_size=1)
    hyp = " ".join(s.text for s in segs)
    r, h = norm(ref), norm(hyp)
    return 1 - difflib.SequenceMatcher(None, r, h, autojunk=False).ratio(), hyp
if __name__ == "__main__":
    texts = {x["key"]: x["spoken"] for x in json.load(open(sys.argv[1]))}
    base = os.path.join(os.path.dirname(__file__), "..", "audio", "voice")
    bad = []
    for key, ref in texts.items():
        path = os.path.join(base, key + ".mp3")
        if not os.path.exists(path):
            print("нет файла", key); continue
        cer, hyp = check(path, ref)
        flag = cer > float(os.environ.get("MAX_CER", "0.12"))
        if flag: bad.append(key)
        print(f"{'!!' if flag else 'ok'} {cer:.3f} {key} {hyp[:90]}", flush=True)
    print("BAD:", ",".join(bad))
