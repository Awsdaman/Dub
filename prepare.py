"""
تجهيز الكليبات للعبة الدوبلاج.

- يقرأ كل الفيديوهات من مجلد clips/
- يحذف الأصوات (الكلام) بالذكاء الاصطناعي Demucs ويحتفظ بالموسيقى والمؤثرات
- يأخذ صورة مصغرة لكل كليب
- يكتب قائمة clips.json التي تقرأها اللعبة

تشغيل:  .venv\\Scripts\\python.exe prepare.py          (تجهيز الجديد فقط)
        .venv\\Scripts\\python.exe prepare.py --force  (إعادة تجهيز الكل)
        .venv\\Scripts\\python.exe prepare.py --no-ai  (بدون حذف الأصوات)
"""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CLIPS = ROOT / "clips"
OUT = ROOT / "processed"
ORIGINALS = ROOT / "originals"  # untouched sources of clips trimmed in the editing room
BROWSER_OK = {".mp4", ".webm", ".m4v"}
VIDEO_EXT = BROWSER_OK | {".mkv", ".mov", ".avi", ".wmv", ".flv", ".mpg", ".mpeg", ".ts"}
SR = 44100

FFMPEG = shutil.which("ffmpeg")
FFPROBE = shutil.which("ffprobe")

_model = None


def run(args, **kw):
    return subprocess.run(args, check=True, **kw)


def is_fresh(target: Path, source: Path) -> bool:
    return target.exists() and target.stat().st_mtime >= source.stat().st_mtime


def has_audio(src: Path) -> bool:
    out = subprocess.run(
        [FFPROBE, "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", str(src)],
        capture_output=True, text=True,
    ).stdout.strip()
    return bool(out)


def load_model():
    global _model
    if _model is None:
        from demucs.pretrained import get_model
        print("  ⏳ تحميل نموذج Demucs (أول مرة يحمّل حوالي 80MB)...")
        _model = get_model("htdemucs")
        _model.eval()
    return _model


def remove_vocals(src: Path, dst: Path):
    import numpy as np
    import torch
    from demucs.apply import apply_model

    model = load_model()
    raw = run([FFMPEG, "-v", "error", "-i", str(src), "-vn", "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
              capture_output=True).stdout
    wav = torch.from_numpy(np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).T.copy())

    ref = wav.mean(0)
    mean, std = ref.mean(), ref.std() + 1e-8
    with torch.no_grad():
        sources = apply_model(model, ((wav - mean) / std)[None], device="cpu",
                              shifts=1, split=True, overlap=0.25, progress=True)[0]
    sources = sources * std + mean
    vocals = sources[model.sources.index("vocals")]
    background = sources.sum(0) - vocals

    pcm = background.T.contiguous().numpy().astype(np.float32).tobytes()
    run([FFMPEG, "-v", "error", "-y", "-f", "f32le", "-ac", "2", "-ar", str(SR), "-i", "-",
         "-b:a", "192k", str(dst)], input=pcm)
    return speech_segments(vocals.mean(0).numpy())


def speech_segments(mono, hop=0.02, gap=0.35, shortest=0.2):
    """Where the original characters talk, from the isolated vocal stem."""
    import numpy as np
    n = int(SR * hop)
    frames = len(mono) // n
    if not frames:
        return []
    rms = np.sqrt((mono[:frames * n].reshape(frames, n) ** 2).mean(1) + 1e-12)
    db = 20 * np.log10(rms)
    active = db > max(db.max() - 28, -45)
    segs, start = [], None
    for i, on in enumerate(active):
        if on and start is None:
            start = i
        elif not on and start is not None:
            segs.append([start * hop, i * hop])
            start = None
    if start is not None:
        segs.append([start * hop, frames * hop])
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < gap:
            merged[-1][1] = s[1]
        else:
            merged.append(s)
    return [[round(a, 2), round(b, 2)] for a, b in merged if b - a >= shortest]


def make_thumb(src: Path, dst: Path):
    for ss in ("1.5", "0"):
        r = subprocess.run([FFMPEG, "-v", "error", "-y", "-ss", ss, "-i", str(src), "-frames:v", "1",
                            "-vf", "scale=480:-2", str(dst)], capture_output=True)
        if r.returncode == 0 and dst.exists():
            return


def to_browser_mp4(src: Path, dst: Path):
    print("  🎞️ تحويل الصيغة إلى mp4...")
    run([FFMPEG, "-v", "error", "-y", "-i", str(src), "-c:v", "libx264", "-preset", "veryfast",
         "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(dst)])


def rel(p: Path) -> str:
    return p.relative_to(ROOT).as_posix()


def duration(src: Path) -> float:
    out = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(src)],
                         capture_output=True, text=True).stdout.strip()
    try:
        return float(out)
    except ValueError:
        return 0.0


def original_of(stem: str):
    if not ORIGINALS.exists():
        return None
    return next((p for p in ORIGINALS.iterdir() if p.stem == stem and p.suffix.lower() in VIDEO_EXT), None)


def cut_clip(original: Path, dst: Path, t_in: float, t_out: float):
    print(f"  ✂️ قص المشهد {t_in:.1f} → {t_out:.1f}")
    tmp = dst.with_name(dst.stem + ".cutting.mp4")
    run([FFMPEG, "-v", "error", "-y", "-ss", f"{t_in:.3f}", "-to", f"{t_out:.3f}", "-i", str(original),
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(tmp)])
    tmp.replace(dst)


def read_timing(stem: str):
    f = CLIPS / f"{stem}.timing.json"
    if not f.exists():
        return None
    try:
        return json.loads(f.read_text(encoding="utf-8"))
    except ValueError:
        print("  ⚠️ ملف التوقيت تالف، تم تجاهله")
        return None


def main():
    force = "--force" in sys.argv
    use_ai = "--no-ai" not in sys.argv

    if not FFMPEG or not FFPROBE:
        sys.exit("❌ ffmpeg غير موجود. ثبّته:  winget install Gyan.FFmpeg")

    CLIPS.mkdir(exist_ok=True)
    OUT.mkdir(exist_ok=True)

    if use_ai:
        try:
            import demucs  # noqa: F401
        except ImportError:
            print("⚠️  Demucs غير مثبت — سيتم التجهيز بدون حذف الأصوات.")
            use_ai = False

    videos = sorted(p for p in CLIPS.iterdir() if p.suffix.lower() in VIDEO_EXT and not p.stem.endswith(".cutting"))
    if not videos:
        print("📂 مجلد clips فارغ — ضع فيه الكليبات ثم أعد التشغيل.")

    manifest = []
    for i, src in enumerate(videos, 1):
        stem = src.stem
        print(f"[{i}/{len(videos)}] {src.name}")

        # trimmed in the editing room: the clip file is a cut of the original
        timing = read_timing(stem)
        original = original_of(stem)
        trim = (timing or {}).get("trim")
        if trim and original:
            timing_file = CLIPS / f"{stem}.timing.json"
            if force or not is_fresh(src, timing_file) or not is_fresh(src, original):
                cut_clip(original, src, float(trim["in"]), float(trim["out"]))

        video = src
        if src.suffix.lower() not in BROWSER_OK:
            video = OUT / f"{stem}.mp4"
            if force or not is_fresh(video, src):
                to_browser_mp4(src, video)

        thumb = OUT / f"{stem}.jpg"
        if force or not is_fresh(thumb, src):
            make_thumb(src, thumb)

        bg = OUT / f"{stem}.bg.mp3"
        speech_file = OUT / f"{stem}.speech.json"
        if use_ai and has_audio(src) and (force or not is_fresh(bg, src) or not is_fresh(speech_file, src)):
            print("  🧠 حذف الأصوات...")
            try:
                segs = remove_vocals(src, bg)
                speech_file.write_text(json.dumps(segs), encoding="utf-8")
            except Exception as e:  # keep going with the other clips
                print(f"  ❌ فشل حذف الأصوات: {e}")
        speech = json.loads(speech_file.read_text(encoding="utf-8")) if speech_file.exists() else []

        lines = ""
        txt = src.with_suffix(".txt")
        if txt.exists():
            lines = txt.read_text(encoding="utf-8-sig").strip()

        # lines timed in the editing room are stored in original-file time
        t0 = float(trim["in"]) if trim and original else 0.0
        clip_len = duration(src)
        timed = []
        for ln in (timing or {}).get("lines", []):
            if ln.get("start") is None or not str(ln.get("text", "")).strip():
                continue
            a = float(ln["start"]) - t0
            b = float(ln["end"]) - t0 if ln.get("end") is not None else a + 1.5
            if b > 0 and a < clip_len:
                timed.append({"start": round(max(0, a), 2), "end": round(min(clip_len, b), 2), "text": ln["text"].strip()})
        if timing and timing.get("lines"):
            lines = "\n".join(str(ln.get("text", "")).strip() for ln in timing["lines"] if str(ln.get("text", "")).strip())

        m = re.search(r"[\(\[]\s*(\d)\s*[\)\]]\s*$", stem)
        voices = int(m.group(1)) if m else 1
        title = re.sub(r"[\(\[]\s*\d\s*[\)\]]\s*$", "", stem).strip() or stem
        title = re.sub(r"(?<=\S)[-_](?=\S)", " ", title)

        manifest.append({
            "id": stem,
            "title": title,
            "voices": voices,
            "video": rel(video),
            "bg": rel(bg) if bg.exists() else None,
            "thumb": rel(thumb) if thumb.exists() else None,
            "lines": lines,
            "speech": speech,
            "timed": timed,
            "edit": {
                "source": rel(original) if original else rel(video),
                "trim": trim if original else None,
                "lines": (timing or {}).get("lines"),
            },
        })
        print("  ✅ جاهز" + ("" if bg.exists() else " (بدون خلفية موسيقية)"))

    (ROOT / "clips.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n🎬 {len(manifest)} كليب جاهز.")


if __name__ == "__main__":
    main()
