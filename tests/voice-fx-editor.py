"""Isolated check that per-line voice effects survive saving and preparation; never touches the owner's clips."""
import json, subprocess, sys, tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import prepare, serve
with tempfile.TemporaryDirectory(prefix='dub-fx-test-') as tmp:
    root = Path(tmp)
    clips, out, originals = root / 'clips', root / 'processed', root / 'originals'
    clips.mkdir()
    subprocess.run([prepare.FFMPEG, '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=blue:s=320x180:r=25:d=3', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=3',
                    '-c:v', 'libx264', '-c:a', 'aac', '-shortest', str(clips / 'fixture.mp4')], check=True)
    body = {'id': 'fixture', 'characters': [{'id': 'a', 'name': 'الأول'}],
            'lines': [{'start': .5, 'end': 1.25, 'text': 'بصدى', 'character': 'a', 'fx': 'echo'},
                      {'start': 1.5, 'end': 2.5, 'text': 'بدون', 'character': 'a'}]}
    # the server re-runs prepare.py in a subprocess; this test runs it in-process instead
    skip = lambda: patch.object(serve.subprocess, 'run', return_value=SimpleNamespace(returncode=0))
    with patch.object(prepare, 'ROOT', root), patch.object(prepare, 'CLIPS', clips), patch.object(prepare, 'OUT', out), \
         patch.object(prepare, 'ORIGINALS', originals), patch.object(sys, 'argv', ['prepare.py', '--no-ai']):
        with skip(): assert serve.save_clip(body)['ok']
        saved = json.loads((clips / 'fixture.timing.json').read_text(encoding='utf8'))
        assert saved['lines'][0]['fx'] == 'echo' and 'fx' not in saved['lines'][1]
        bad = json.loads(json.dumps(body)); bad['lines'][1]['fx'] = 'bogus'
        try:
            with skip(): serve.save_clip(bad)
        except ValueError: pass
        else: raise AssertionError('Unknown effect accepted')
        assert json.loads((clips / 'fixture.timing.json').read_text(encoding='utf8')) == saved
        prepare.main()
        timed = json.loads((root / 'clips.json').read_text(encoding='utf8'))[0]['timed']
        assert timed[0]['fx'] == 'echo' and 'fx' not in timed[1], timed
print('PASS voice effect saved per line, unknown effect rejected without changing saved data, effect reaches clips.json timed lines')
