# Recording recovery and quick-rounds preview

Completed recordings are backed up in IndexedDB in the same browser and URL path. On reopening or refreshing, use **استرجع التسجيلات**. This restores completed rounds, the pending result, collected ensemble takes, or a remote player's captured take. Remote players rejoin the original room to resend; after a host refresh, pending remote players must join the host's new room.

A failed final mix keeps the raw takes and offers **أعد تجهيز التسجيل**. Retrying recombines those takes without recording again.

Backups are local, not an additional cloud upload. Clearing site data removes them. Private browsing may discard them. An interrupted recording that never completed cannot be recovered. Storage failures show a warning to download recordings before refreshing.

## Local quick-rounds preview

Run `python tests/build-quick-rounds.py` using the project's virtual environment while the local server is running. Open http://localhost:8765/tests/artifacts/quick-rounds/ .

This creates a separate static game under ignored test artifacts. It never changes the original clips or the published site. Six eligible scenes currently have a 15–30-second excerpt ending outside a timed dialogue line. Original audio, music, subtitles, speech intervals and character lists are cut together. Scenes without a suitable boundary are omitted. The sandbox has separate game/recovery storage and remote play disabled; it is for trying pacing locally before deciding whether to add quick rounds to the main game.

Checks: `tests/recovery.cjs`, `tests/seat-recovery.cjs`, `tests/quick-rounds.cjs`, `tests/ensemble.cjs`, `tests/solo-character.cjs`, `tests/recording-reliability.cjs`.
