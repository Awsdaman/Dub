# Remote-seat test harness

Current multi-player release: `node tests/ensemble.cjs` runs a host and two remote browsers against real Supabase, including recording, guide audio, role claims, votes, rejoin, failed-upload retry and local editor controls. It reads the ignored `config.local.json` and defaults to localhost:8765; set `GAME_URL` to test another deployment. The test injects a timed multi-character fixture in browser responses without modifying the owner's clips.

Re-recording and studio features: `node tests/studio-features.cjs` runs a host and one remote browser against real Supabase. It stops a take mid-way, drags the band back, re-records one part (locally, from the result screen, and on the remote seat), checks the joined audio pass by pass, checks the WAV upload, plays a head-to-head with the +2 bonus, resets points, plays the bloopers, and uses the editing room's typed times and effect menu. Set `GAME_URL` to run it against the published site (the editing-room part is skipped there). `python tests/voice-fx-editor.py` checks in a temporary folder that per-line voice effects are saved, validated and reach `clips.json`.

`node tests/slow-network.cjs` plays the published copy (`site/`) of the largest clip at 2 Mbit/s and checks that it never stops to buffer, that picture and microphone stay within 150 ms through a whole recording, and that the stall safety net re-aligns the sound; set `CLIP` and `KBPS` to try others. `node tests/back-and-watch-together.cjs` (real Supabase) checks that the original plays on the host and remote devices together, that a slow device joins at everyone's position, and the back buttons from watching, review and a finished take. `node tests/multi-review.cjs` checks the review step each player gets on a shared device, its survival across a refresh, and one player taking every character of a clip. `python tests/replaced-video.py` checks in a temporary folder that a clip video replaced by hand is never overwritten by a cut of its old original. `python tests/character-editor.py` verifies character metadata persistence in an isolated temporary folder. Older single-seat test scripts below are historical coverage and use the previous selection flow.

The game has no package/build dependency. Tests use a separate ignored `.test-tools` directory:

```powershell
npm install --prefix .test-tools playwright@1.58.2 --no-audit --no-fund
.\.venv\Scripts\python.exe serve.py --no-browser
```

In another terminal, after `3-export-site.bat` has finished:

```powershell
node tests/remote-seat.cjs
node tests/edge-sdk.cjs
.\.venv\Scripts\python.exe tests/editor-export.py
```

Installed Chrome and Edge are required. Browser tests use isolated profiles and a synthetic microphone. They do not access your ordinary browser sessions. `remote-seat.cjs` runs its own static/test server on 8877. The regular local server must be running on 8765.

`supabase-double.js` is a test-only API double routed over the pinned SDK URL by Playwright. It uses the test server to deliver messages, track presence, and store actual uploaded audio bytes. It does not ship in `site/`, and cannot be enabled by runtime game configuration. This verifies the UI/state/capture/upload/download flow, not Supabase's live service, RLS policies or Internet connectivity. `edge-sdk.cjs` separately checks loading the real CDN SDK, without a Supabase project.

The editor test creates a two-second fixture, calls the actual save endpoint, checks trimming and timing, deletes its own fixture, and restores the manifest. Do not run it while a person is editing or preparing clips. It leaves the user's original clips untouched.

Screenshots and machine-readable results go to ignored `tests/artifacts/`. See `TEST-RESULTS-remote-seat.md` for the reported scope and unverified checks.
# Live deployment checks

`node tests/live-supabase.cjs` tests real Supabase against the local export by default. Set `GAME_URL=https://dub-ashen-ten.vercel.app/` to test the published game. It uses synthetic microphone audio, verifies public viewing and owner-only writes/deletes, records a full clip, transfers it, plays it on the host and votes remotely.

`node tests/live-recovery.cjs` checks the published game's reconnection and actual clip-duration-plus-90-second timeout. It takes around two minutes. Both scripts create temporary anonymous player identities; successful uploads are deleted by their owner.

