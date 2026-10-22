# دوبلاج

**[Play the public game](https://dub-ashen-ten.vercel.app/)**

An Arabic party game: choose a movie clip or draw one randomly, watch it, record your dub, and replay it with your voice. Players can share one microphone or join from multiple devices, take character roles, and record sequentially. The game combines their voices afterward.

The **اختار اللي تحس انك حتبدع فيه** button lets you choose from the clip library.

Use Chrome or Edge, allow the microphone, and wear headphones while recording. Save favorite takes before refreshing the host page.

- Hosted on Vercel; updates to `main` deploy automatically.
- Supabase provides room messages, temporary player identities and recording transfers.
- Recordings are publicly viewable while stored, as requested. Upload/delete access is limited to the owner. Received uploads are automatically removed after the host downloads them.
- Only `site/` is published. Clip preparation and editing stay local.

See [deployment instructions](DEPLOY.md) and [test results](TEST-RESULTS-remote-seat.md).

To name characters, assign subtitle lines, adjust overlapping dialogue, and publish your edits, follow [the local editing guide](LOCAL-EDITING.md). `4-publish-site.bat` exports and pushes clip updates to GitHub.
