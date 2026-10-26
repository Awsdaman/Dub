"""Export an allowlisted, static copy. Run prepare.py before exporting new clips."""
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SITE = ROOT / 'site'


def source(path):
    p = (ROOT / path).resolve()
    if not p.is_relative_to(ROOT) or not p.is_file():
        raise ValueError(f'Missing or invalid asset: {path}. Run 1-prepare-clips.bat first.')
    return p


def export():
    manifest = ROOT / 'clips.json'
    if not manifest.is_file():
        raise ValueError('clips.json is missing. Run 1-prepare-clips.bat first.')
    clips = json.loads(manifest.read_text(encoding='utf-8-sig'))
    if not clips:
        raise ValueError('No prepared clips. Run 1-prepare-clips.bat first.')
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:
        raise ValueError('ffmpeg is missing from PATH.')
    cfg = {}
    if (ROOT / 'config.local.json').exists():
        cfg = json.loads((ROOT / 'config.local.json').read_text(encoding='utf-8-sig'))
    public = {k: str(cfg.get(k, '')) for k in ('supabaseUrl', 'supabaseAnonKey')}
    key = public['supabaseAnonKey']
    if key.startswith('sb_secret_'):
        raise ValueError('Use a publishable/anon key, never a secret key.')
    if key.count('.') == 2:
        import base64
        try:
            payload = json.loads(base64.urlsafe_b64decode(key.split('.')[1] + '==='))
        except Exception as exc:
            raise ValueError('Invalid anon key') from exc
        if payload.get('role') != 'anon':
            raise ValueError('Only the public anon key may be exported.')
    # Preflight every input before deleting any previously exported copy.
    seen = set()
    for c in clips:
        ident = c['id']
        if not ident or ident in seen or any(x in ident for x in '/\\:') or ident.startswith('.'):
            raise ValueError(f'Invalid/duplicate clip id: {ident}')
        seen.add(ident)
        for k in ('video', 'bg', 'thumb'):
            if c.get(k):
                source(c[k])
    if SITE.is_symlink() or SITE.resolve() != ROOT / 'site':
        raise ValueError('Refusing to replace a redirected site directory.')
    if SITE.exists():
        shutil.rmtree(SITE)
    (SITE / 'clips').mkdir(parents=True)
    (SITE / 'processed').mkdir()
    shutil.copy2(ROOT / 'index.html', SITE / 'index.html')
    shutil.copy2(ROOT / 'ensemble.js', SITE / 'ensemble.js')
    shutil.copy2(ROOT / 'recovery.js', SITE / 'recovery.js')
    shutil.copy2(ROOT / 'studio.js', SITE / 'studio.js')
    shutil.copytree(ROOT / 'fonts', SITE / 'fonts')
    (SITE / 'config.js').write_text('window.DUBLAJ = ' + json.dumps({'site': True, **public}, ensure_ascii=False) + ';\n', encoding='utf-8')
    exported = []
    for c in clips:
        target = SITE / 'clips' / (c['id'] + '.mp4')
        print(f"Encoding {c['title']}...", flush=True)
        subprocess.run([ffmpeg, '-v', 'error', '-y', '-i', str(source(c['video'])),
                        # each clip is downloaded completely before it plays, so smaller files start sooner;
                        # 960px looks the same as 1280px for these upscaled cartoons, at about 40% less data
                        '-map', '0:v:0', '-map', '0:a:0?', '-vf', "scale=w='min(960,iw)':h=-2",
                        '-c:v', 'libx264', '-crf', '27', '-preset', 'slow', '-pix_fmt', 'yuv420p',
                        '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', str(target)], check=True)
        out = {k: c[k] for k in ('id', 'title', 'voices', 'characters', 'lines', 'speech', 'timed') if k in c}
        out['video'] = target.relative_to(SITE).as_posix()
        for k, suffix in [('bg', '.bg.mp3'), ('thumb', '.jpg')]:
            out[k] = None
            if c.get(k):
                dst = SITE / 'processed' / (c['id'] + suffix)
                if k == 'bg':  # 112 kbps is plenty for background music; decodes with the same alignment
                    subprocess.run([ffmpeg, '-v', 'error', '-y', '-i', str(source(c[k])), '-b:a', '112k', str(dst)], check=True)
                else:
                    shutil.copy2(source(c[k]), dst)
                out[k] = dst.relative_to(SITE).as_posix()
        exported.append(out)
    (SITE / 'clips.json').write_text(json.dumps(exported, ensure_ascii=False, indent=2), encoding='utf-8')
    (SITE / 'vercel.json').write_text(json.dumps({'headers': [
        {'source': '/clips/(.*)', 'headers': [{'key': 'Cache-Control', 'value': 'public, max-age=0, must-revalidate'}]},
        {'source': '/processed/(.*)', 'headers': [{'key': 'Cache-Control', 'value': 'public, max-age=0, must-revalidate'}]}
    ]}, indent=2), encoding='utf-8')
    too_large = False
    for p in sorted(SITE.rglob('*')):
        if p.is_file():
            mb = p.stat().st_size / 1024**2
            print(f'{p.relative_to(SITE)}: {mb:.2f} MB' + (' WARNING: above 50 MB' if mb > 50 else ''))
            too_large |= mb >= 100
    if too_large:
        raise ValueError('An exported file reaches GitHub\'s 100 MB limit. Trim that clip and export again.')
    print(f'Ready: {len(exported)} clips in site/. See DEPLOY.md.')


if __name__ == '__main__':
    try:
        export()
    except (ValueError, OSError, subprocess.CalledProcessError) as exc:
        sys.exit(f'Export failed: {exc}')
