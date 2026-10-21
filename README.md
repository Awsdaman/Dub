# دوبلاج

**[Play the public game](https://dub-ashen-ten.vercel.app/)**

An Arabic party game: choose a movie clip or draw one randomly, watch it, record your dub, and replay it with your voice. Local players share a microphone; one friend can join remotely using a room code.

The **اختار اللي تحس انك حتبدع فيه** button lets you choose from all nine clips.

Use Chrome or Edge, allow the microphone, and wear headphones while recording. Save favorite takes before refreshing the host page.

- Hosted on Vercel; updates to `main` deploy automatically.
- Supabase provides room messages, temporary player identities and recording transfers.
- Recordings are publicly viewable while stored, as requested. Upload/delete access is limited to the owner. Received uploads are automatically removed after the host downloads them.
- Only `site/` is published. Clip preparation and editing stay local.

See [deployment instructions](DEPLOY.md) and [test results](TEST-RESULTS-remote-seat.md).
