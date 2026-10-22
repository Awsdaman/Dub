# Recording stability checks — 2026-10-22

The reported freeze could not be reproduced in an isolated Chrome session. The deployed version completed the 105.64-second Lion King recording and started replay. This does not rule out a Brave-specific or device/memory-dependent failure.

Fixed concrete reliability weaknesses:
- Decoded audio cache now has a 64 MiB / six-entry limit instead of retaining every round.
- Playback waits also check the final media position when a browser misses the ended event.
- Ensemble mixing decodes one take at a time, merges overlapping intervals and yields to the UI during mixing.
- Stopped audio sources disconnect and release their buffers; exported video object URLs are released.
- Audio HTTP errors and fetch timeouts are handled instead of decoding failed responses.

Validation:
- Original deployment: full 105.64-second capture and replay completed.
- Updated local game: full 105.64-second capture and replay completed.
- Injected missing-ended-event recovery: passed.
- Cache limit under repeated insertions: passed.
- Overlapping lines do not double the same player's audio: passed.
- Solo selection, capture, original voices outside selected lines, and replay: passed.
- Two-character subtitle editor and isolated persistence/validation: passed.

Synthetic microphones were used; physical microphone and Brave-specific behavior were not verified.
`n- Multi-player suite: all 11 checks passed, including two remote players, sequential mixing, voting, reconnect, failed-upload resend, cancellation and no browser errors.
