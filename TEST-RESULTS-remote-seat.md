# Remote-seat build and test results

## Multi-device update — 22 October 2026

`tests/ensemble.cjs` passed **11 checks** with a host and two isolated remote Chrome contexts using real Supabase:

- Multiple remote joins, role claims, and multiple characters assigned to one player.
- Local first take, two sequential remote takes, aligned combined WAV and playback.
- Original soundtrack outside assigned lines; music/effects during assigned lines, including overlaps (sample-value assertions).
- One-device recording and independent remote votes.
- Reconnect restores the pending character assignment and retains previous takes.
- Failed upload retains the take; resend continues the ensemble.
- Offline next player supports retry and abandoning the clip.
- Local editor character controls and per-line assignment; no browser errors.

Desktop/mobile role selection and overlapping subtitle lanes were visually reviewed. An isolated Python check verified that character names, overlapping times and speaker IDs persist; invalid IDs are rejected without overwriting saved data. This test does not touch the owner's clips.

The recording checks use synthetic microphone audio. Physical devices, real microphones and human listening quality still need the owner rehearsal. Existing clips need explicit character assignments and timed lines before multi-device dubbing is enabled; one-device mode remains available.

The prior single-seat harnesses below describe the earlier release; use `tests/ensemble.cjs` for the current role-selection flow. No Supabase schema or storage-policy changes were needed for this update.

Date: 21 October 2026.
Live website: https://dub-ashen-ten.vercel.app/
Repository: https://github.com/Awsdaman/Dub

## Delivered
- Public Vercel website connected to GitHub main; root vercel.json publishes site/.
- Supabase Dublaj project with Realtime, temporary anonymous player identities and public recording viewing.
- Owner-only upload/delete policies; short-lived host playback links; uploaded take removed after successful host receipt.
- Nine prepared clips, about 91 MB total, largest about 33 MB.
- Exact-label clip chooser: **اختار اللي تحس انك حتبدع فيه**, with thumbnails and voice counts. Random selection remains available.
- Local editing, shared recording routine, remote seat, voting, reconnect/retry/skip and final reel.
- Real-service testing found and fixed Supabase rejecting percent-encoded Arabic upload filenames. Recordings now use ASCII UUID filenames.

## Section 6 results

| Plan test | Result | Evidence and limits |
|---|---|---|
| 1. Local regression | PASS — automated browser/API | Full two-player round, recording, playback, voting, final reel and clip chooser pass. Earlier real editor API test verified trimming, background generation, line timing and unchanged originals. The batch launcher was not manually double-clicked. |
| 2. Exported site | PASS | Static export full round and chooser pass; editor hidden; mobile layout checked. Exported media and file references verified. Source and exported game HTML match. |
| 3. Two browser profiles | PASS — real Supabase and simulated failure coverage | Isolated Chrome contexts joined the real service, recorded a full 12.469-second clip, uploaded it, downloaded and played it on the host, voted remotely and received the end-of-night event. Simulated regression suite also covers failed upload/resend, unknown names, host vote override and unavailable SDK. |
| 4. Vercel + second device/network | PARTIAL PASS | Public HTTPS URL passed the real recording/voting integration and owner-isolation storage tests in two browser contexts. A second physical device/network and human microphone remain untested. See live recovery results for actual timeout/reconnection coverage. |
| 5. Owner rehearsal | CHECKLIST DELIVERED; human rehearsal not run | DEPLOY.md includes friend call, screen sharing with audio, TV host, room join, one remote dub, one local dub with remote vote, headphones and saving favorites. |

## Test evidence
- tests/artifacts/results.json: **17 passing checks** for local/export and simulated remote regression.
- tests/artifacts/live-results.json: **7 passing checks** on the production Vercel URL with real Supabase.
- tests/artifacts/live-recovery-results.json: live reconnection and real timeout results, generated separately.
- tests/artifacts/editor-export-results.txt: earlier real local editor and export validation.
- tests/artifacts/edge-sdk.json: earlier Edge full-duration capture, playback, voting and real SDK loading.
- tests/artifacts/public-game.png and *clip-library-mobile.png: reviewed UI screenshots.

Production storage tests verified public viewing succeeds, another player cannot upload into or delete the owner's files, and successful takes are removed after host receipt. The bucket contained zero leftover recordings after the live recording tests.

Browser tests use synthetic microphone audio. They establish transfer, decoding, timing metadata and playback execution, not human listening quality. The deployed full-duration recording test does not seek to shorten recording. Safari has not been tested.

The Impeccable detector ran with reduced parser support, so its output is not a full contrast/accessibility audit. New UI was inspected on mobile; existing design was retained.

## Reproduce
See tests/README.md. Test code and artifacts are not published in site/.
