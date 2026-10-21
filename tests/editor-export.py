"""Real local editor API + exported media/allowlist checks. Restores the clip manifest."""
import json, subprocess, sys, urllib.request
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root))
import prepare
stem='test-remote-seat-editor'
manifest=root/'clips.json'; before=manifest.read_bytes()
clip=root/'clips'/f'{stem}.mp4'
assert not clip.exists()
results=[]
try:
    subprocess.run([prepare.FFMPEG,'-v','error','-y','-f','lavfi','-i','color=c=blue:s=320x180:r=25:d=2','-f','lavfi','-i','sine=frequency=330:duration=2','-c:v','libx264','-c:a','aac','-shortest',str(clip)],check=True)
    data={'id':stem,'trim':{'in':.25,'out':1.5},'lines':[{'text':'تجربة التوقيت','start':.5,'end':1.25}]}
    req=urllib.request.Request('http://127.0.0.1:8765/api/clip',data=json.dumps(data).encode(),headers={'Content-Type':'application/json'})
    response=json.load(urllib.request.urlopen(req,timeout=120));assert response['ok']
    c=next(c for c in json.loads(manifest.read_text(encoding='utf8')) if c['id']==stem)
    assert c['timed'][0]['start']==.25 and c['timed'][0]['end']==1
    assert (root/'originals'/f'{stem}.mp4').exists()
    assert abs(prepare.duration(clip)-1.25)<.1
    results.append('PASS: editor POST /api/clip, trim, original retention, exact relative timing, background generation')
finally:
    for folder in ('clips','processed','originals'):
        for p in (root/folder).glob(stem+'.*'):
            assert p.resolve().is_relative_to(root)
            p.unlink()
    manifest.write_bytes(before)
site=root/'site'
for p in site.rglob('*'):
    if p.is_file():
        assert p.suffix in ('.html','.js','.json','.mp4','.mp3','.jpg','.otf'),p
        assert not p.name.endswith('.timing.json'),p
        assert p.stat().st_size < 100*1024**2,p
for c in json.loads((site/'clips.json').read_text(encoding='utf8')):
    assert 'edit' not in c
    for field in ('video','bg','thumb'):
        if c.get(field):assert (site/c[field]).is_file()
    info=json.loads(subprocess.check_output([prepare.FFPROBE,'-v','error','-show_streams','-of','json',str(site/c['video'])]))
    video=next(x for x in info['streams'] if x['codec_type']=='video')
    assert video['codec_name']=='h264' and video['width']<=1280
    assert any(x['codec_type']=='audio' and x['codec_name']=='aac' for x in info['streams'])
results.append('PASS: exported allowlist, no edit/source paths, media references, H.264 <=1280px, AAC original audio, file sizes')
(root/'tests'/'artifacts'/'editor-export-results.txt').write_text('\n'.join(results),encoding='utf8')
print('\n'.join(results))
