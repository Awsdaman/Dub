# Plan C: hosted game + one remote seat

Brief for the agent building this. Read it fully before touching code.

## 1. Goal

The owner of this project (the "remote player") lives away from his friends. On game night the friends sit together in one room around one laptop connected to a TV, and the owner joins from his own computer at home over a Discord/Zoom call.

Build two things:

1. **Hosted copy (Part A).** The game, published on Vercel from a GitHub repo, so the friends just open a link. Nothing to install on their side.
2. **Remote seat (Part B).** A way for the owner to be a full player from home: when the spin picks him, he records his dub **on his own computer** (so it stays perfectly in sync), the take uploads, and the friends' TV plays it like any local dub. He also votes on the friends' dubs from his screen.

The owner watches the TV through the call's screen share (with sound). The remote seat does **not** need to mirror the TV's picture; it only needs his recording turn and his vote pads.

## 2. What exists today (read these first)

Project root: `C:\Users\Aous\Downloads\دوبلاج` (Arabic folder name; quote paths).

| File | What it is |
|---|---|
| `index.html` | The entire game: one page, inline CSS + JS, no framework, no build step. Arabic, RTL. |
| `prepare.py` | Offline clip prep: Demucs voice removal → `processed/<id>.bg.mp3`, speech segments → `processed/<id>.speech.json`, thumbnails → `processed/<id>.jpg`, trims from the editing room, writes `clips.json`. Runs in `.venv` (CPU torch + demucs). |
| `serve.py` | Local server on `http://localhost:8765` with byte-range support, plus `POST /api/clip` used by the editing room to save trims/lines and re-run `prepare.py`. |
| `1-prepare-clips.bat`, `2-start-game.bat` | Owner's launchers. |
| `clips/` | Game clips (`<id>.mp4`), optional `<id>.txt` lines, `<id>.timing.json` from the editing room. |
| `originals/` | Untrimmed sources of clips trimmed in the editing room. Never publish. |
| `processed/` | Generated audio, speech timing, thumbnails. |
| `fonts/` | Self-hosted Thmanyah Sans OTFs (400/500/700/900). |
| `PRODUCT.md`, `DESIGN.md`, `.impeccable/surfaces/index-html.md` | Product truth, design system, direction contract. **Follow DESIGN.md for every new UI.** |

### `clips.json` entry shape

```json
{
  "id": "عوم واتمخطر",
  "title": "عوم واتمخطر",
  "voices": 1,
  "video": "clips/عوم واتمخطر.mp4",
  "bg": "processed/عوم واتمخطر.bg.mp3",
  "thumb": "processed/عوم واتمخطر.jpg",
  "lines": "line1\nline2",
  "speech": [[0.78, 4.0], [4.56, 5.4]],
  "timed": [{"start": 0.8, "end": 3.9, "text": "..."}],
  "edit": {"source": "clips/....mp4", "trim": null, "lines": null}
}
```

Paths are relative and URL-encoded segment by segment in JS (`url()` helper).

### Key pieces inside `index.html`

- **State `S`:** `players` (`{name, score, dubs, color}`; color is a wax index 0–7), `scored`, `played`, `dubs`, `current` (clip), `dubbers` (names), `round`, `last` (the latest take).
- **A take** (`S.last` / items of `S.dubs`): `{id, clip, dubbers, blob, offset, adjust, score}`.
  - `blob` is the mic recording (webm/opus in Chrome).
  - `offset` = seconds into the recording at which the video was at time 0.
  - `adjust` = the user's sync nudge in ms.
- **Audio:** one `AudioContext` (`ctx`); `voiceGain` and `bgGain` feed both the speakers and `mixDest` (used by "save video").
  - `getBuffer(key, src)` decodes and caches a Blob or URL.
  - `startBuffer(buf, gain, offset)` and `stopAll()` (bumps `playToken`, stops buffers, pauses video, resolves `ended()` waiters).
- **Screens:** `show(id)` switches `.screen` sections: `s-setup`, `s-home`, `s-spin`, `s-play` (the booth), `s-final`, `s-edit`. `controls(id)` switches the booth console between `c-watch`, `c-record`, `c-result` and `c-reel`.
- **Flow:**
  - `spin()` → pick dubbers (tape chips) → `watchOriginal()`.
  - `record()`: countdown on the band, a `MediaRecorder` on the mic, video muted, computes `offset`, then `showResult()`.
  - `showResult()` → `playDub(entry)` + `renderVote()` → `#nextBtn` scores and goes `goHome()`.
- **Voting:** `voters()` returns non-dubber player names. `votes[name] = 1..10`; `avgScore()`.
- **Rhythmo band:** `drawBand(canvas, B)`; the booth uses `band` with `band.clock = () => v.currentTime`.
- **Editing room** (`s-edit`): talks to `POST api/clip`. **This only works on the local server.**
- **Lamp:** `lamp('')`, `lamp('on')`, `lamp('on blink')`, `applause()`. **Toast:** `toast(msg)`.

**Do not break the local flow.** Everything below must degrade to today's behavior when the site runs locally, or when remote-seat config is missing.

## 3. Part A: hosted copy on Vercel

### A1. Runtime config

Add `config.js`, loaded by `index.html` before the main script and optional (no error if missing):

```js
window.DUBLAJ = {
  site: false,            // true in the exported site
  supabaseUrl: "",        // filled for Part B
  supabaseAnonKey: ""     // anon key is public by design
};
```

In `index.html`:
- Read `window.DUBLAJ || {}`.
- Hide `#toEditBtn` (the editing room) when `DUBLAJ.site` is true.

### A2. Export script

Add `export.py` (run with `.venv\Scripts\python.exe export.py`) and `3-export-site.bat` (same style as the other `.bat` files: `chcp 65001`, `PYTHONUTF8=1`, `cd /d "%~dp0"`, `pause` at the end). It should:

1. Run `prepare.py` logic first, or require it was run: fail clearly if `clips.json` is missing.
2. Recreate `site/` from scratch (delete it first; it is generated).
3. Copy `index.html` and `fonts/`.
4. Write `site/config.js` with `site: true`, plus Supabase values read from a local, git-ignored `config.local.json` if present.
5. For each clip in `clips.json`:
   - **Re-encode the video** to `site/clips/<id>.mp4`: ffmpeg, H.264, scaled to max 1280 wide, `-crf 26`, `-preset medium`, AAC 128k, `+faststart`. Keep the audio track; the "watch original" step needs it.
   - **Copy** `bg` (mp3) and `thumb` (jpg).
   - **Rewrite paths** in a new `site/clips.json`. Drop the `edit` field: it exposes local paths and isn't needed online.
6. Print each file's size and **warn above 50 MB** (GitHub hard limit is 100 MB per file).
7. Never copy `originals/`, `.venv/`, `.impeccable/`, `*.py`, `*.bat`, `*.timing.json`.

### A3. Repo and Vercel

- Add a `.gitignore` at the root: `.venv/`, `originals/`, `processed/`, `clips/`, `__pycache__/`, `.impeccable/review/`, `config.local.json`.
  - Only `site/` (the generated output) and the source files get committed. Note: `site/` **is** committed, because Vercel serves it as is.
- Vercel project settings: Framework preset "Other", **Root Directory = `site`**, no build command, no output directory override.
- Optional `site/vercel.json` with `Cache-Control: public, max-age=86400` for `/clips/*` and `/processed/*`.
- The owner must create the GitHub repo (private) and the Vercel project himself. You cannot create accounts. Give him exact click-by-click steps in `DEPLOY.md`.
- Copyright: the clips are Disney/Pixar. Tell the owner to keep the repo **private** and share the link only with the friends. Do not add analytics, SEO or social preview tags.

### A4. Acceptance for Part A

- [ ] `3-export-site.bat` produces `site/` with only the listed files. Sizes are printed.
- [ ] Serving `site/` with any static server (`python -m http.server` from inside `site/`) plays a full round: spin, watch, record, playback, vote, final, reel.
- [ ] The editing room button is hidden in the exported site and still visible on `2-start-game.bat`.
- [ ] The microphone works on the deployed HTTPS URL in Chrome and Edge.

## 4. Part B: the remote seat

### B1. Transport: Supabase (free tier)

- **Realtime Broadcast** on channel `dublaj:<ROOM>` for messages, and **Presence** on the same channel to show whether the seat is online. No database tables are needed.
- **Storage** bucket `takes` for uploaded recordings, path `<ROOM>/<takeId>.<ext>`.
- Load `@supabase/supabase-js` v2 from jsDelivr with an **exact pinned version** (check the current v2 release; do not use `@2` or `latest`). Load it only when `DUBLAJ.supabaseUrl` is set.
- Owner setup (put it in `DEPLOY.md`):
  1. Create a project.
  2. Create a **public** bucket `takes`.
  3. Run the storage policies below (verify the syntax against current Supabase docs).
  4. Copy the Project URL and anon key into `config.local.json`.

```sql
create policy "takes insert" on storage.objects for insert to anon with check (bucket_id = 'takes');
create policy "takes read"   on storage.objects for select to anon using (bucket_id = 'takes');
create policy "takes delete" on storage.objects for delete to anon using (bucket_id = 'takes');
```

Isolate all Supabase code behind a tiny module inside `index.html`:
- `remote.open(room, role)`, `remote.send(event, payload)`, `remote.on(event, fn)`, `remote.online()`.
- `remote.upload(path, blob)` and `remote.downloadUrl(path)`.

Nothing else in the game should touch Supabase directly.

### B2. Roles and the room

- **Host** is the friends' TV game, the existing flow.
  - New setup option on the setup desk: "مقعد عن بعد" with a switch (default off).
  - When on, the host generates a **4-letter room code** from an unambiguous alphabet (`ABCDEFGHJKMNPQRSTUVWXYZ`) and shows it in the top rail next to the take counter, with an online LED (presence).
  - The host adds the remote player by name as a normal player with `remote: true`, wax color assigned as usual.
- **Seat** is the owner's screen.
  - New setup key: "انضم كمقعد عن بعد" opens a new screen `#s-seat`.
  - He types the room code and his name. Remember both in `localStorage` for reconnects.

### B3. Messages

Every payload carries `room`. Use `takeId = <clipId>-<timestamp>`.

| Direction | Event | Payload | When |
|---|---|---|---|
| seat → host | `hello` | `{name}` | On join and every reconnect |
| host → seat | `welcome` | `{name, color, scored}` | Reply to `hello`; reject unknown names with `{error:"unknown"}` |
| host → seat | `state` | `{phase, round, players:[{name,color,score,dubs}], clipTitle}` | On every phase change. `phase` is one of `home`, `spin`, `watch`, `recording`, `result`, `final`. |
| host → seat | `your_turn` | `{takeId, clipId}` | When the dubbers include the remote player and the host presses its record key |
| seat → host | `turn_status` | `{takeId, status}` | `status` is one of `watching`, `countdown`, `recording`, `uploading` |
| seat → host | `take_ready` | `{takeId, path, offset, mime}` | After upload |
| seat → host | `take_failed` | `{takeId, reason}` | Mic denied, upload error, cancelled |
| host → seat | `vote_open` | `{takeId, dubbers}` | `showResult()` for a local take when the remote player is a voter |
| seat → host | `vote` | `{takeId, score}` | The remote player taps a pad |
| host → seat | `vote_closed` | `{takeId, avg}` | Host pressed "اللي بعده" |
| host → seat | `ended` | `{}` | Final screen or the host turns the remote seat off |

The host is the single source of truth. The seat never changes scores itself.

On reconnect (`hello` from a known name), the host re-sends `welcome`, `state`, and any pending `your_turn` or `vote_open`.

### B4. Host-side changes (`index.html`)

1. **Picking dubbers:**
   - **v1 rule:** the remote player dubs **alone**. If he is selected together with local players, show a toast ("فلان يدبلج لحاله من بعيد") and keep only the last selection.
   - Mixed local + remote dubbing on one clip is out of scope (see §7).
2. **Watch screen:** unchanged. Friends watch the original on the TV; the owner watches via screen share.
   - When the only dubber is remote, the record key becomes "دور فلان" (send `your_turn`).
   - The booth then shows a **waiting state** instead of the countdown:
     - the lamp blinks;
     - the monitor shows a slate with the remote player's tape label and his live `turn_status` ("يشوف الكليب", "يسجّل", "يرفع التسجيل…");
     - a "ألغِ" key cancels.
3. **On `take_ready`:**
   - `fetch(remote.downloadUrl(path))` → Blob.
   - Build `S.last = {id: takeId, clip, dubbers:[remoteName], blob, offset, adjust:0, score:null}`.
   - Call `showResult()`. Everything else (playback, sync nudge, save video, voting) works unchanged.
4. **Timeouts:** if no `take_ready` arrives within `clip duration + 90 s`, or on `take_failed`, show two keys: "اطلب مرة ثانية" (re-send `your_turn` with a new takeId) and "تخطَّ" (back to home without scoring).
5. **Voting with a remote voter:**
   - In `renderVote()`, the remote player's row shows a waiting label instead of pads until a `vote` arrives. Then it lights the pad like a local tap.
   - The host can still tap his row manually, as an override if the remote player is gone.
   - Send `vote_open` when the result shows and `vote_closed` on "اللي بعده".
6. **Presence:** if the seat is offline when his turn comes, toast "فلان مو متصل" and offer "تخطَّ".
7. **End:** on the final screen send `ended`, and offer "امسح تسجيلات الليلة" which deletes `takes/<ROOM>/*`.

### B5. Seat-side screen `#s-seat` (`index.html`)

Same booth world (DESIGN.md), sized for a laptop. States:

1. **Join:** room code input (4 letters, auto-uppercase), name input, "انضم" key. Show errors from `welcome`. Mic permission is requested here with the VU meter (reuse `meterLoop`).
2. **Waiting:** tape label with his name and color, the room's scoreboard (from `state`), a line saying what's happening on the TV, and a connection LED.
3. **Your turn** (`your_turn`):
   - Load the clip and its `bg`.
   - Show the monitor + rhythmo band, with "شوف الأصلي" (play with sound, any number of times) and a big "سجّل" key.
   - Recording reuses the **exact same capture code** as the host's `record()`: countdown on the band, `MediaRecorder`, offset calculation. **Refactor** `record()` into a shared `captureTake(clip, {hearBg}) → {blob, offset, mime}` used by both host and seat. Keep the host's behavior identical.
   - After capture: a short preview of his dub (`playDub`) with "أرسلها" and "سجّل من جديد".
   - **Send:** upload, show progress, then `take_ready`.
   - Send `turn_status` at each step.
4. **Vote** (`vote_open`): 1–10 pads in his color; a tap sends `vote`. Lock after `vote_closed`.
5. **Ended:** a credits-style thanks screen.

Handle the `mime` coming from `MediaRecorder` (`audio/webm;codecs=opus` in Chrome, `audio/mp4` in Safari): upload with that content type and use the matching file extension.

### B6. Copy (Gulf dialect, playful; match the existing voice)

Suggested strings:
- مقعد عن بعد
- انضم كمقعد عن بعد
- كود الغرفة
- دور {name}
- بانتظار {name}…
- {name} يشوف الكليب / يسجّل / يرفع التسجيل…
- {name} مو متصل
- اطلب مرة ثانية
- تخطَّ
- أرسلها
- وصل التسجيل!
- امسح تسجيلات الليلة

No emoji in the UI; icons are inline SVG from the existing sprite (add new symbols in the same 2px round-stroke style).

## 5. Constraints

- Follow `DESIGN.md`:
  - Thmanyah Sans for UI; Marhey only for hand-written things.
  - One big key per screen; matte keys; glow only on real lights.
  - Time axes run right to left; wax color per player.
- RTL everywhere, Arabic Gulf copy, readable from a sofa.
- No framework, no build step; the game stays a static `index.html`.
- Graceful degradation: no `config.js`, no Supabase values, or no network all mean the remote-seat UI is hidden and the game is exactly today's game.
- Do not break `serve.py`, the editing room, or `prepare.py`.
- Keep secrets out of git. The anon key is public by design, but the `config.local.json` source stays git-ignored.

## 6. Test plan

Automated checks are hard here; do these manually and write the results in your final report.

1. **Local regression:** `2-start-game.bat` → full round with 2 local players and voting. The editing room still saves.
2. **Exported site:** serve `site/` locally → full round. The editing room is hidden.
3. **Remote seat, two browser windows on one machine:** host in Chrome, seat in a second Chrome profile.
   - Join.
   - Remote turn: record, upload, the host plays it, vote.
   - Local turn with a remote vote.
   - Seat closes mid-turn → timeout/skip works.
   - Seat reconnects → it resumes its pending turn.
4. **Deployed:** the same as test 3 on the Vercel URL, the seat on a second device or network.
5. **Rehearsal checklist for the owner** (put it in `DEPLOY.md`):
   - Call with one friend.
   - Friend shares screen **with audio**.
   - Friend opens the link on the TV laptop, turns on the remote seat, reads the code.
   - Owner joins.
   - One remote dub and one local dub with a remote vote.

## 7. Out of scope (v1)

- Every friend on their own phone (full multiplayer).
- Mixed local + remote dubbers on the same clip. A future v2: locals record first, then the seat records while hearing their take.
- Accounts, auth, persistence beyond one night, and mirroring the TV picture to the seat.

## 8. Deliverables

- [ ] Updated `index.html` (config, remote module, host changes, seat screen, shared `captureTake`).
- [ ] `config.js` (default, `site:false`, empty Supabase values).
- [ ] `export.py`, `3-export-site.bat`, `.gitignore`, optional `site/vercel.json`.
- [ ] `DEPLOY.md`: GitHub (private repo), Vercel (Root Directory `site`), Supabase (project, bucket, policies, keys), how to re-export after adding clips, and the rehearsal checklist. Written for a non-developer, step by step.
- [ ] Update `اقرأني.txt` with a short Arabic section on remote play.
- [ ] Final report: what was built, each test from §6 with pass/fail, anything not verified.
