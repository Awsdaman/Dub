# Put دوبلاج online and play from a remote seat

The finished website is the `site` folder. Friends only need the website link, Chrome or Edge, and microphone permission. Preparation and editing stay on your computer.

## 1. Prepare your clips

1. Double-click `1-prepare-clips.bat` and wait for it to finish.
2. If you want shorter scenes or exact line timings, open `2-start-game.bat`, enter **غرفة المونتاج**, and save your edits.
3. Close the game when editing is finished. Do not export while a clip is being saved.

## 2. Set up Supabase once

1. Open [Supabase](https://supabase.com/dashboard), sign in, and choose **New project**.
2. Choose your organization, enter a project name, create a database password, choose a nearby region, and create the project. Wait until it is ready.
3. Open **Storage**, choose **New bucket**, enter **takes**, and turn **Public bucket** on. Create it. If you set a MIME restriction, allow `audio/webm`, `audio/mp4` and `audio/ogg`; keep the file size limit at 50 MB or below.
4. Open **SQL Editor**, choose **New query**, paste this, and click **Run** once:

```sql
create policy "takes insert" on storage.objects
  for insert to anon with check (bucket_id = 'takes');
create policy "takes read" on storage.objects
  for select to anon using (bucket_id = 'takes');
create policy "takes delete" on storage.objects
  for delete to anon using (bucket_id = 'takes');
```

These policies support uploading, listing and deleting takes without accounts. No database table is needed. Keep public Realtime channels enabled; if your project has **Allow public access** disabled in Realtime settings, enable it for this version of the game.

5. Open the project's **Connect** dialog (or **Project Settings → API / API Keys**). Copy the **Project URL** and **publishable key**. The older public **anon** key also works. Never use `service_role`, a secret key, your database password, or an access token.
6. In this game folder, create a text file called **config.local.json** (make sure Windows has not added `.txt`). Paste the following and replace both values:

```json
{
  "supabaseUrl": "https://YOUR-PROJECT.supabase.co",
  "supabaseAnonKey": "YOUR-PUBLISHABLE-OR-ANON-KEY"
}
```

The setting retains the name `supabaseAnonKey` for compatibility; either public key type is accepted. This local file is excluded from Git. Its two public values are intentionally included in the exported `site/config.js` so browsers can connect.

**Access model:** the four-letter room code and player name are for matching friends, not authentication. The requested public-bucket policies let anyone with the project's public key upload, read or delete files in `takes`. Use this project only for this private game night, do not put sensitive recordings there, and clear the recordings afterward. The private GitHub repository does not make the deployed URL or public storage private.

## 3. Export the website

1. Double-click **3-export-site.bat**.
2. Wait for encoding to finish. It rebuilds `site/`; don't put hand-written files in that folder.
3. Read the sizes printed at the end. Files above 50 MB get a warning; files at or above 100 MB must be shortened in the editing room and exported again.
4. `site/` contains the page, fonts, configuration, clip list, compressed videos, backgrounds, thumbnails and cache settings. It contains no original sources, Python environment or editing files.

You can export without Supabase values: the local-style game works, and the remote-seat controls stay hidden. Export again after adding the values to enable the remote seat.

## 4. Create your private GitHub repository

1. Sign in to [GitHub](https://github.com/new).
2. Enter a name such as `dublaj-night`, select **Private**, and create the repository.
3. Install and open [GitHub Desktop](https://desktop.github.com/), then sign in.
4. Choose **File → Add local repository**, select this game folder, and choose **Create a repository here** if it says the folder is not a repository. Keep the repository at this folder; do not create a second nested copy.
5. In the changed-files list, check that `site/`, `index.html`, `export.py`, the launchers, guides and `.gitignore` appear. `clips/`, `processed/`, `originals/`, `.venv/` and `config.local.json` at the root must not appear. The copies under `site/clips/` and `site/processed/` should appear.
6. Enter a commit summary such as “Ready for game night” and click **Commit to main**.
7. Choose **Repository → Repository settings → Remote**, and use the URL of the private repository you created, then **Push origin**. If Desktop instead offers **Publish repository**, use it with **Keep this code private** checked (you can let Desktop create the private repository and skip the empty GitHub one).

The clips are Disney/Pixar content. Keep the repository private and share the site link only with your friends. No analytics, SEO or social preview tags were added.

## 5. Deploy on Vercel

1. Sign in to [Vercel](https://vercel.com/new) with GitHub.
2. Choose **Add New → Project**, allow access to your private game repository, then **Import** it.
3. Set **Framework Preset** to **Other**.
4. Beside **Root Directory**, click **Edit**, select **site**, and save.
5. Leave **Build Command** empty (if an override is enabled, clear it). Leave **Output Directory** at its default with no override. There is no package installation or build step.
6. Click **Deploy**. Open the resulting HTTPS URL.
7. Check the site in Chrome and Edge. Allow the microphone when asked. The editing-room button should be absent.
8. If friends are asked to log in to Vercel, open the project **Settings → Deployment Protection** and adjust protection for the production link, or use Vercel's sharing controls. Send the production URL, not a preview restricted to your account.

## 6. Game-night setup

**Friends at the TV:**

1. Open the website and add local players.
2. Turn on **مقعد عن بعد**, enter the remote player's exact name, and click **افتح الغرفة**. It adds that person to the player list (or marks the existing matching name as remote).
3. Read the four-letter code beside the take counter to the remote player. The light turns green after the seat joins.
4. Start normally. Select the remote player alone for a remote dub. Selecting a local player afterward replaces the remote selection, and vice versa.
5. Press **دور [name]**. The TV waits while the remote player watches, records, previews and sends the take.
6. The uploaded take plays with music and effects. Sync adjustment, replay, scoring and saving video work as usual.
7. On local turns, the remote voter can vote from home. If they cannot connect, the host can use their vote pads as an override.

**Remote player:**

1. Open the same website on your own computer and click **انضم كمقعد عن بعد**.
2. Enter the code and the exact name used by the host, then click **انضم** and allow the microphone.
3. Watch the TV through the call's screen share. During your turn, use the local clip, **سجّل**, then preview and **أرسلها**. Recording is captured against your own video, so call delay does not change sync.
4. Use headphones and mute your microphone in the call while dubbing to avoid echoes. The game's music-during-recording option is for headphones.
5. Tap your score pads when they open. The host controls all scoring.
6. If disconnected, keep the page open so the pending recording is retained. If you reload, rejoin with the remembered room and name; a pending turn is resent, but an unsent recording lost to a refresh must be recorded again.

If a turn cannot finish, the host can retry with a new take or skip. The timeout is the clip's duration plus 90 seconds. Uploading shows an indeterminate status, not a guessed percentage. At the final screen, choose **امسح تسجيلات الليلة** to delete all uploaded takes in that room. Local takes remain in browser memory until refresh; save any favorites first.

## 7. Add clips or update the game later

1. Add/edit clips locally, and run `1-prepare-clips.bat`.
2. Run `3-export-site.bat` again. Never edit the generated `site/index.html` directly.
3. In GitHub Desktop, commit the changes, then push. Vercel redeploys automatically from the repository.
4. After deployment finishes, both host and remote player reload before starting the next game so they have matching clips.

## 8. Rehearsal checklist

- Call one friend before game night.
- Friend shares their screen **with audio**.
- Friend opens the production HTTPS link on the TV laptop, enables the remote seat and reads the code.
- Owner joins from another device/network with the exact registered name.
- Do one remote dub, preview/send it, and hear it on the TV.
- Do one local dub and submit a remote vote.
- Disconnect the seat mid-turn and check retry/skip. Rejoin and check a pending turn resumes.
- Repeat microphone permission/recording checks in Chrome and Edge.
- Clear the night's uploaded recordings after saving favorites.

## Reference checks

Implementation pins Supabase JS **2.118.0**, verified from the [npm release metadata](https://registry.npmjs.org/@supabase/supabase-js/latest). Storage policy syntax was checked against [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control). Broadcast and public-channel setup follow [Supabase Realtime Broadcast](https://supabase.com/docs/guides/realtime/broadcast). These links also explain public versus secret API keys.
