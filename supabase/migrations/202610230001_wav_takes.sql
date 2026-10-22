-- Takes with re-recorded parts are joined on the player's device and sent as WAV.
update storage.buckets
set allowed_mime_types = array['audio/webm','audio/mp4','audio/ogg','audio/wav']
where id = 'takes';
