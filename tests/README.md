# Remote-seat test harness

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

