-- One-night game storage. Public anonymous access matches PLAN-remote-seat.md.
-- Room codes organize files; they are not authentication or access controls.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('takes', 'takes', true, 52428800,
  array['audio/webm','audio/mp4','audio/ogg'])
on conflict (id) do nothing;

create policy "takes insert" on storage.objects
  for insert to anon with check (bucket_id = 'takes');
create policy "takes read" on storage.objects
  for select to anon using (bucket_id = 'takes');
create policy "takes delete" on storage.objects
  for delete to anon using (bucket_id = 'takes');
