# Remote-seat implementation and test results

Date: 21 October 2026 (Asia/Riyadh).

## Delivered

- One static `index.html`: optional runtime config, hosted-only editor hiding, remote room setup, presence light, solo remote selection, shared `captureTake`, preview/send, host download/playback, remote votes with host override, reconnect replay, cancel/retry/skip, and room recording cleanup.
- Supabase JS pinned to **2.118.0**, loaded only with remote configuration. All Supabase operations are contained in the inline `remote` module. Storage requests have a 45-second network deadline; the host turn timeout remains clip duration + 90 seconds.
- `config.js`, `export.py`, `3-export-site.bat`, root-anchored `.gitignore`, and generated `site/` with Vercel cache settings.
- **9 clips**, **35 exported files**, **91.15 MB total**. Largest video: **33.18 MB**. No file reaches the 50 MB warning threshold. Exported videos use H.264, width at most 1280, AAC original audio, and fast-start metadata.
- `DEPLOY.md` with private GitHub, Vercel Root Directory `site`, Supabase bucket/policies/public-key setup, updates and the rehearsal checklist. Arabic instructions added to `اقرأني.txt`.

No accounts, GitHub repository, Supabase project or Vercel deployment were created. `config.local.json` and a production URL were not supplied. The generated website therefore currently has the remote controls hidden until the owner configures and re-exports it.

## Section 6 results

| Plan test | Result | Evidence and limits |
|---|---|---|
| **1. Local regression** | **PASS — automated browser/API coverage** | The same `serve.py` used by `2-start-game.bat` served a complete Chrome round with two local players: spin, watch, record, dub playback, vote, final and reel. Editor visibility was checked. A temporary two-second clip was saved through the real `/api/clip` endpoint: trim, untouched original, relative line timing and background generation passed. The fixture was removed and the manifest restored. The batch launcher itself was not manually double-clicked. |
| **2. Exported site** | **PASS — local static hosting** | Generated export completed; a static server served a complete Chrome round, vote, final and reel. The editor key was hidden. All exported references and file types passed checks; no `edit` metadata, original sources, Python files, environment or timing sidecars were exported. Source and exported HTML are byte-identical. |
| **3. Two browser profiles** | **PASS with a test transport; live Supabase NOT VERIFIED** | Two isolated Chrome contexts exercised join, unknown-name rejection, presence, remote solo selection, record/preview/upload, host decoding/playback and scoring, local take plus remote vote, vote closing, failed-upload retention/resend, reload/rejoin of a pending take, disconnect/retry/skip and recording cleanup. Actual audio Blobs crossed an HTTP test service. Supabase Broadcast/Presence/Storage were represented by a test-only API double, not a real project. |
| **4. Vercel + second device/network** | **NOT RUN — owner setup required** | No deployed URL or Supabase credentials were supplied. HTTPS microphone permissions, real RLS policies, live Realtime connectivity and second-network behavior remain unverified. |
| **5. Owner rehearsal** | **CHECKLIST DELIVERED; rehearsal NOT RUN** | `DEPLOY.md`, section 8 includes a friend call, screen sharing with audio, joining from another device/network, one remote dub, one local dub with remote vote, disconnect/rejoin, Chrome/Edge checks and cleanup. |

### Microphone and timing limits

Browser tests used a **synthetic microphone**, not a person's physical microphone. Chrome suite captures were shortened by seeking near the end to test the recording/finish pipeline. A separate **Edge full-duration capture** ran without seeking: video duration **12.469 s**, captured audio **12.900 s**, offset **0.038 s**, MIME `audio/webm;codecs=opus`, Blob **250,050 bytes**. It decoded, played and scored successfully. This checks timing metadata and execution, not a human listening/lip-sync judgment. Safari's MP4 MIME branch is implemented but was not browser-tested.

The initial recovery test accelerated the timer. A separate run **passed using the actual clip-duration-plus-90-second deadline**, followed by retry with a new take ID and skip; its result is recorded in `tests/artifacts/real-timeout-results.json`.

### Additional verification

- The actual pinned Supabase UMD distribution loaded successfully from jsDelivr in Edge, independently of the test double. No live Supabase operations were attempted without a project.
- Missing `config.js` and a blocked SDK download keep remote UI hidden while local setup remains usable.
- Git ignore rules were tested in a disposable repository: root clips, processed files and local config are ignored; the corresponding `site/` files remain eligible for commit.
- New Arabic strings use logical Unicode order. No bidi control characters or Arabic presentation-form characters were found in the HTML. The page remains RTL with an isolated LTR room-code field.
- Desktop host setup, seat waiting, seat recording, and narrow-screen layouts were captured and inspected. Existing typefaces and components were reused; no new visual identity was introduced.
- No browser JavaScript errors occurred in the completed Chrome or Edge checks.
- The design detector ran in its fallback mode because optional parser dependencies were absent. It reported palette/type-scale advisories and existing light-glow warnings; this was not treated as a clean accessibility/contrast audit.

## Reproduce and inspect

See `tests/README.md`. Test files are source-only and are not shipped in `site/`.

- `tests/artifacts/results.json`: local/export and simulated remote integration results.
- `tests/artifacts/remote-final-results.json`: final remote waiting-state and host vote-override checks, plus remote regression coverage.
- `tests/artifacts/real-timeout-results.json`: remote checks with the real timeout deadline.
- `tests/artifacts/editor-export-results.txt`: real editor API and exported media validation.
- `tests/artifacts/edge-sdk.json`: Edge recording measurements and live CDN SDK load.
- `tests/artifacts/*.png`: screenshots.

The remaining acceptance work is the real Supabase/Vercel setup and the rehearsal on two devices. Follow `DEPLOY.md` before inviting the full group.
