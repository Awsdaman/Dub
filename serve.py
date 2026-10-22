"""Local server for the game, with Range support so videos can seek."""
import glob
import http.server
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import webbrowser
from pathlib import Path

PORT = 8765
ROOT = Path(__file__).resolve().parent
TYPES = {".mp4": "video/mp4", ".m4v": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg",
         ".json": "application/json; charset=utf-8", ".html": "text/html; charset=utf-8",
         ".jpg": "image/jpeg", ".txt": "text/plain; charset=utf-8", ".otf": "font/otf"}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def guess_type(self, path):
        return TYPES.get(Path(path).suffix.lower()) or super().guess_type(path)

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_head(self):
        rng = self.headers.get("Range")
        path = self.translate_path(self.path)
        if not rng or not os.path.isfile(path):
            return super().send_head()
        m = re.match(r"bytes=(\d*)-(\d*)", rng)
        size = os.path.getsize(path)
        start = int(m.group(1)) if m and m.group(1) else 0
        end = int(m.group(2)) if m and m.group(2) else size - 1
        end = min(end, size - 1)
        if start > end:
            self.send_error(416)
            return None
        f = open(path, "rb")
        f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        self._remaining = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        remaining = getattr(self, "_remaining", None)
        if remaining is None:
            return super().copyfile(source, outputfile)
        self._remaining = None
        while remaining > 0:
            chunk = source.read(min(65536, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)

    def log_message(self, *a):
        pass

    def do_POST(self):
        if self.path != "/api/clip":
            self.send_error(404)
            return
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
            result = save_clip(body)
            code = 200
        except Exception as e:
            result, code = {"ok": False, "error": str(e)}, 400
        data = json.dumps(result, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


SAVE_LOCK = threading.Lock()


def save_clip(body):
    """Store the editing room's trim and lines, cut the scene, and re-run preparation."""
    import prepare
    stem = str(body.get("id", ""))
    if not stem or "/" in stem or "\\" in stem or stem.startswith("."):
        raise ValueError("bad clip id")
    clip = next((p for p in prepare.CLIPS.iterdir() if p.stem == stem and p.suffix.lower() in prepare.VIDEO_EXT), None)
    original = prepare.original_of(stem)
    if not clip and not original:
        raise ValueError("clip not found")

    lines = []
    for ln in body.get("lines") or []:
        text = str(ln.get("text", "")).strip()
        if not text:
            continue
        num = lambda k: None if ln.get(k) is None else round(float(ln[k]), 3)
        lines.append({"text": text, "start": num("start"), "end": num("end"), "character": str(ln.get("character", ""))})

    characters = body.get("characters", [])
    if not isinstance(characters, list) or not 1 <= len(characters) <= 12:
        if "characters" in body:
            raise ValueError("Choose between 1 and 12 characters")
        characters = []  # Preserve compatibility with older editor clients.
    characters = [{"id": str(c["id"]), "name": str(c["name"]).strip()} for c in characters]
    if any(not c["id"] or not c["name"] for c in characters) or len({c["id"] for c in characters}) != len(characters):
        raise ValueError("Invalid character names or IDs")
    if characters and any(l["character"] and l["character"] not in {c["id"] for c in characters} for l in lines):
        raise ValueError("Unknown subtitle character")

    trim = body.get("trim")
    if trim:
        t_in, t_out = float(trim["in"]), float(trim["out"])
        if t_out - t_in < 0.5:
            raise ValueError("scene too short")
        trim = {"in": round(t_in, 3), "out": round(t_out, 3)}
    with SAVE_LOCK:
        # written before the cut so the fresh cut is newer than its timing file
        (prepare.CLIPS / f"{stem}.timing.json").write_text(
            json.dumps({"trim": trim, "lines": lines, "characters": characters}, ensure_ascii=False, indent=1), encoding="utf-8")
        if trim:
            if not original:
                prepare.ORIGINALS.mkdir(exist_ok=True)
                original = prepare.ORIGINALS / clip.name
                shutil.move(str(clip), str(original))
            for old in prepare.CLIPS.glob(f"{glob.escape(stem)}.*"):
                if old.suffix.lower() in prepare.VIDEO_EXT:
                    old.unlink()
            prepare.cut_clip(original, prepare.CLIPS / f"{stem}.mp4", trim["in"], trim["out"])
        env = dict(os.environ, PYTHONUTF8="1")
        run = subprocess.run([sys.executable, str(ROOT / "prepare.py")], cwd=ROOT, env=env,
                             capture_output=True, text=True, encoding="utf-8", errors="replace")
    if run.returncode:
        raise RuntimeError(run.stdout[-800:] + run.stderr[-800:])
    return {"ok": True}


if __name__ == "__main__":
    url = f"http://localhost:{PORT}/"
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Game running at {url}  (close this window to stop)")
    if "--no-browser" not in sys.argv:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except (KeyboardInterrupt, BrokenPipeError, ConnectionResetError):
        pass
