"""Build a local-only quick-rounds sandbox; never edits original clips or site/."""
import json,shutil,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[1]
out=root/'tests/artifacts/quick-rounds'
out.mkdir(parents=True,exist_ok=True)
for folder in ['clips','processed']:(out/folder).mkdir(exist_ok=True)
for name in ['index.html','ensemble.js','recovery.js']:shutil.copy2(root/name,out/name)
shutil.copytree(root/'fonts',out/'fonts',dirs_exist_ok=True)
(out/'config.js').write_text('window.DUBLAJ={site:true};',encoding='utf8')
html=(out/'index.html').read_text(encoding='utf8').replace("'dub-state'","'dub-quick-rounds-state'")
html=html.replace('<section class="screen on" id="s-setup">','<section class="screen on" id="s-setup"><p style="text-align:center">نسخة تجريبية — جولات قصيرة من ١٥ إلى ٣٠ ثانية</p>')
(out/'index.html').write_text(html,encoding='utf8')
clips=json.loads((root/'site/clips.json').read_text(encoding='utf8'));exported=[]
ffmpeg=shutil.which('ffmpeg')
for clip in clips:
 lines=clip.get('timed',[])
 if not lines:continue
 start=max(0,min(l['start'] for l in lines)-.3)
 duration=float(subprocess.check_output([shutil.which('ffprobe'),'-v','error','-show_entries','format=duration','-of','csv=p=0',str(root/'site'/clip['video'])]))
 ends=[min(duration,l['end']+.2) for l in lines if 15<=min(duration,l['end']+.2)-start<=30 and not any(x['start']<min(duration,l['end']+.2)<x['end'] for x in lines)]
 if not ends:continue
 end=min(ends,key=lambda t:abs(t-start-22))
 c=dict(clip);c['timed']=[dict(l,start=round(max(0,l['start']-start),3),end=round(l['end']-start,3)) for l in lines if l['start']>=start and l['end']<=end]
 used={cid for l in c['timed'] for cid in l.get('characters',[l.get('character')])}
 c['characters']=[ch for ch in clip['characters'] if ch['id'] in used];c['voices']=len(c['characters'])
 c['lines']='\n'.join(l['text'] for l in c['timed']);c['speech']=[[max(a,start)-start,min(b,end)-start] for a,b in clip.get('speech',[]) if b>start and a<end]
 for key in ['video','bg']:
  if not clip.get(key):continue
  dest=out/clip[key];dest.parent.mkdir(parents=True,exist_ok=True)
  args=[ffmpeg,'-v','error','-y','-ss',str(start),'-i',str(root/'site'/clip[key]),'-t',str(end-start)]
  args+=['-c:v','libx264','-preset','ultrafast','-crf','26','-c:a','aac','-movflags','+faststart'] if key=='video' else ['-c:a','libmp3lame']
  subprocess.run(args+[str(dest)],check=True)
 if clip.get('thumb'):shutil.copy2(root/'site'/clip['thumb'],out/clip['thumb'])
 exported.append(c);print(f"{c['title']}: {end-start:.1f}s ({len(c['characters'])} characters)")
(out/'clips.json').write_text(json.dumps(exported,ensure_ascii=False,indent=2),encoding='utf8')
print('Sandbox: http://localhost:8765/tests/artifacts/quick-rounds/')
