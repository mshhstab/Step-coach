"""يسجّل حلقة المشي: ياخذ النص من التطبيق، يحوّله صوت بـ Piper، يلصق المقاطع مع الوقفات، ويرفع MP3.

لا يطبع أي نص من الحلقة في السجل (المستودع عام).
"""
import json, os, subprocess, sys, tempfile, time, urllib.error, urllib.request, wave
from pathlib import Path

APP = os.environ.get("APP_URL", "https://step-coach.mshhstab.workers.dev").rstrip("/")
VOICES = ["en_US-lessac-medium", "en_US-ryan-medium"]   # 0: المدرّس، 1: مقاطع الاستماع والمحاضرة والقصة
VOICE_DIR = Path.home() / ".piper-voices"
JOB = Path(tempfile.gettempdir()) / "podcast-job.json"
PART = 20 * 1024 * 1024
RATE = 22050


def token():
    url = os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"] + "&audience=step-coach"
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["value"]


def call(path, method="POST", data=None, ctype="application/json", timeout=600):
    body = data if isinstance(data, (bytes, bytearray)) else (json.dumps(data).encode() if data is not None else b"{}")
    req = urllib.request.Request(APP + path, data=body, method=method,
                                 headers={"Authorization": "Bearer " + token(), "content-type": ctype, "user-agent": "step-podcast"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{path} -> HTTP {e.code}: {e.read()[:200].decode('utf-8', 'replace')}")


def output(k, v):
    with open(os.environ.get("GITHUB_OUTPUT", os.devnull), "a") as f:
        f.write(f"{k}={v}\n")


def check():
    job = call("/podcast-api/job", timeout=900)
    if job.get("idle"):
        print("لا يوجد عمل." + (" ملاحظة: " + job["error"][:120] if job.get("error") else ""))
        output("work", "no")
        return
    JOB.write_text(json.dumps(job))
    print(f"حلقة {job['date']}: {len(job['pieces'])} مقطع")
    output("work", "yes")


def load_voice(name):
    from piper import PiperVoice
    VOICE_DIR.mkdir(parents=True, exist_ok=True)
    model = VOICE_DIR / f"{name}.onnx"
    if not model.exists():
        subprocess.run([sys.executable, "-m", "piper.download_voices", name, "--data-dir", str(VOICE_DIR)], check=True)
    return PiperVoice.load(str(model))


def synth(voice, text, out, slow=False):
    with wave.open(str(out), "wb") as w:
        if hasattr(voice, "synthesize_wav"):
            cfg = None
            if slow:  # المدرّس أبطأ شوي عشان الوضوح
                try:
                    from piper import SynthesisConfig
                    cfg = SynthesisConfig(length_scale=1.08)
                except Exception:
                    cfg = None
            voice.synthesize_wav(text, w, syn_config=cfg) if cfg else voice.synthesize_wav(text, w)
        else:  # إصدارات Piper الأقدم
            voice.synthesize(text, w)


def pcm(path):
    """يرجع بيانات 16-bit mono بمعدل RATE (يحوّل لو لزم)."""
    with wave.open(str(path), "rb") as w:
        ok = w.getnchannels() == 1 and w.getsampwidth() == 2 and w.getframerate() == RATE
        if ok:
            return w.readframes(w.getnframes())
    tmp = Path(str(path) + ".r.wav")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(path), "-ac", "1", "-ar", str(RATE), "-sample_fmt", "s16", str(tmp)], check=True)
    with wave.open(str(tmp), "rb") as w:
        return w.readframes(w.getnframes())


def render():
    job = json.loads(JOB.read_text())
    date, pieces, voices, tl = job["date"], job["pieces"], job["voices"], job["tl"]
    try:
        loaded = {}
        work = Path(tempfile.mkdtemp())
        audio = []
        t0 = time.time()
        for i, text in enumerate(pieces):
            v = voices[i] if i < len(voices) else 0
            name = VOICES[min(v, len(VOICES) - 1)]
            if name not in loaded:
                loaded[name] = load_voice(name)
            f = work / f"{i}.wav"
            synth(loaded[name], text, f, slow=(v == 0))
            audio.append(pcm(f))
            if i % 40 == 39:
                call(f"/podcast-api/progress?date={date}", data={"done": i + 1})
        print(f"سجّلنا {len(pieces)} مقطع في {int(time.time() - t0)} ثانية")

        full = work / "full.wav"
        total = 0
        with wave.open(str(full), "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
            for kind, val in tl:
                if kind == "p":
                    data = audio[val]
                else:
                    data = b"\x00\x00" * int(RATE * float(val))
                w.writeframes(data)
                total += len(data) // 2
        seconds = total / RATE

        mp3 = work / "episode.mp3"
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(full), "-ac", "1", "-ar", "44100",
                        "-codec:a", "libmp3lame", "-b:a", "64k", "-write_xing", "1",
                        "-metadata", f"title=STEP walk {date}", str(mp3)], check=True)
        blob = mp3.read_bytes()
        parts = []
        for n, off in enumerate(range(0, len(blob), PART)):
            chunk = blob[off:off + PART]
            call(f"/podcast-api/upload?date={date}&part={n}", method="PUT", data=chunk, ctype="audio/mpeg")
            parts.append(len(chunk))
        call(f"/podcast-api/done?date={date}", data={"parts": parts, "seconds": seconds})
        print(f"تم: {round(seconds / 60)} دقيقة، {round(len(blob) / 1e6, 1)} ميجا، {len(parts)} جزء")
    except Exception as e:
        try:
            call(f"/podcast-api/fail?date={date}", data={"error": f"{type(e).__name__}: {e}"[:250]})
        finally:
            raise


if __name__ == "__main__":
    try:
        {"check": check, "render": render}[sys.argv[1]]()
    except Exception as e:  # يظهر كملاحظة في صفحة التشغيل (بدون أي نص من الحلقة)
        print(f"::error::{type(e).__name__}: {str(e)[:300]}")
        raise
