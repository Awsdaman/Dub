"""Isolated check: a clip video replaced by hand is never overwritten by a cut of its old original."""
import json, os, subprocess, sys, tempfile, time
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import prepare, serve


def video(path, seconds, color):
    subprocess.run([prepare.FFMPEG, '-v', 'error', '-y', '-f', 'lavfi', '-i', f'color=c={color}:s=320x180:r=25:d={seconds}', '-f', 'lavfi', '-i', f'sine=frequency=330:duration={seconds}',
                    '-c:v', 'libx264', '-c:a', 'aac', '-shortest', str(path)], check=True)


with tempfile.TemporaryDirectory(prefix='dub-replaced-test-') as tmp:
    root = Path(tmp)
    clips, out, originals = root / 'clips', root / 'processed', root / 'originals'
    clips.mkdir()
    clip = clips / 'fixture.mp4'
    video(clip, 4, 'blue')
    # the server re-runs prepare.py in a subprocess; the test runs prepare.main() itself instead
    real_run = subprocess.run
    skip = lambda: patch.object(serve.subprocess, 'run', side_effect=lambda cmd, *a, **k: SimpleNamespace(returncode=0) if any(str(x).endswith('prepare.py') for x in cmd) else real_run(cmd, *a, **k))
    with patch.object(prepare, 'ROOT', root), patch.object(prepare, 'CLIPS', clips), patch.object(prepare, 'OUT', out), \
         patch.object(prepare, 'ORIGINALS', originals), patch.object(sys, 'argv', ['prepare.py', '--no-ai']):
        # trimmed in the editing room: the original is kept and the clip becomes a 2-second cut
        with skip(): serve.save_clip({'id': 'fixture', 'trim': {'in': .5, 'out': 2.5}, 'lines': []})
        assert (originals / 'fixture.mp4').exists() and abs(prepare.duration(clip) - 2) < .2
        prepare.main()
        assert (originals / 'fixture.mp4').exists(), 'an ordinary cut must keep its original'
        # the owner drops in a different, longer video under the same name
        time.sleep(1.1); video(clip, 6, 'red'); new_size = clip.stat().st_size
        prepare.main()
        assert clip.stat().st_size == new_size and abs(prepare.duration(clip) - 6) < .2, 'replacement was overwritten'
        assert not (originals / 'fixture.mp4').exists() and any((originals / 'replaced').iterdir())
        c = json.loads((root / 'clips.json').read_text(encoding='utf8'))[0]
        assert c['edit']['source'] == 'clips/fixture.mp4' and c['edit']['trim'] is None, c['edit']
        # trimming the new video afterwards cuts from the new video, not the old one
        with skip(): serve.save_clip({'id': 'fixture', 'trim': {'in': 1, 'out': 4}, 'lines': []})
        assert abs(prepare.duration(originals / 'fixture.mp4') - 6) < .2 and abs(prepare.duration(clip) - 3) < .2
print('PASS ordinary cuts keep their original; a hand-replaced clip is kept, its stale original moved aside, and later trims cut from the new video')
