# دوبلاج online

Website: https://dub-ashen-ten.vercel.app/
Repository: https://github.com/Awsdaman/Dub
Supabase: Dublaj (qtmcbysddhynirrppnoe), Awsdaman's Org.

## Hosting
Import Awsdaman/Dub into Vercel, choose Other, and leave Root Directory at ./.
The root vercel.json publishes only site/ with no install or build command.
Pushes to main trigger deployment after connecting the repository.
The committed site/ contains all nine prepared clips, backgrounds, thumbnails and fonts.

## Recording access
The owner requested a public website and public recordings. The takes bucket is public for viewing.
Upload and delete permissions are restricted to the temporary authenticated player who owns the recording.
The public game key alone cannot delete another player's recordings.
Authentication → Sign In / Providers → Allow anonymous sign-ins is enabled.
Players do not need email or password. A temporary browser identity survives refresh.
The host receives a two-minute playback link. Once the host downloads and decodes a take, its owner automatically removes the uploaded copy.
The host retains the recording in memory for playback and the final reel. Refreshing the host loses these takes.

Room codes match friends; they are not authentication. Anyone with a public recording URL can view it while it exists.
The host's امسح تسجيلات الليلة requests deletion by the connected remote player.
If that player disconnected, reconnect them first. The project owner can remove abandoned uploads in Supabase Storage.
Never put a secret or service-role key in the website.
The SQL migrations in supabase/migrations reproduce these settings on a fresh project and supersede the original plan's unrestricted anonymous policies.

## Update clips
1. Add source videos to clips/ and run 1-prepare-clips.bat.
2. Open 2-start-game.bat, trim clips and adjust timings in غرفة المونتاج.
3. Finish saving before running 3-export-site.bat.
4. Commit and push the updated site/ to GitHub.

The ignored config.local.json holds the public Supabase URL/key used by the exporter. Keep it when exporting.
site/config.js intentionally publishes these browser-safe values. Root config.js disables remote play in the local editing version.
The exporter warns above 50 MB per file and rejects files at or above 100 MB.
Current assets total about 91 MB; largest clip about 33 MB.

## Rehearsal
- Use Chrome or Edge over HTTPS, and allow the microphone.
- Call one friend. Have them share their screen with audio.
- Friend opens the game on the TV laptop, enables the remote seat, enters your name, and reads the room code.
- Join with that code and exact name.
- Try one remote dub and one local dub with a remote vote.
- Wear headphones during recording.
- Save favorites before closing or refreshing the host.

اختار اللي تحس انك حتبدع فيه opens all clips for manual selection; هات كليب! remains random.
