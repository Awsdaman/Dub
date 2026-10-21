-- Player-owned recordings. Public viewing is enabled by the next migration.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('takes','takes',false,52428800,array['audio/webm','audio/mp4','audio/ogg']);
create policy "owner upload" on storage.objects for insert to authenticated
with check (bucket_id='takes' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "owner read" on storage.objects for select to authenticated
using (bucket_id='takes' and owner_id=(select auth.uid())::text);
create policy "owner delete" on storage.objects for delete to authenticated
using (bucket_id='takes' and owner_id=(select auth.uid())::text);
