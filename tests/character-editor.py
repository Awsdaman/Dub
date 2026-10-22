"""Isolated persistence check; never modifies the owner's clips or manifest."""
import json, tempfile, sys
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import prepare, serve
with tempfile.TemporaryDirectory(prefix='dub-character-test-') as tmp:
    folder=Path(tmp)
    (folder/'fixture.mp4').write_bytes(b'fixture')
    body={'id':'fixture','characters':[{'id':'a','name':'الأول'},{'id':'b','name':'الثاني'}],
          'lines':[{'start':0,'end':2,'text':'سطر أول','character':'a'},{'start':1,'end':3,'text':'متداخل','character':'b'}]}
    with patch.object(prepare,'CLIPS',folder), patch.object(prepare,'original_of',return_value=None), patch.object(serve.subprocess,'run',return_value=SimpleNamespace(returncode=0)):
        assert serve.save_clip(body)['ok']
        saved=json.loads((folder/'fixture.timing.json').read_text(encoding='utf8'))
        assert saved['characters']==body['characters']
        assert saved['lines']==body['lines']
        body['lines'][0]['character']='missing'
        try: serve.save_clip(body)
        except ValueError: pass
        else: raise AssertionError('Unknown role accepted')
        assert json.loads((folder/'fixture.timing.json').read_text(encoding='utf8'))==saved
print('PASS character names, overlapping timing, speaker IDs persist; invalid IDs rejected without changing saved data')
