-- User requested public recordings; upload/delete remain owner-restricted.
update storage.buckets set public=true where id='takes';
