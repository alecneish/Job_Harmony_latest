-- Storage support for frontend-only resume uploads.
-- Safe to run repeatedly.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  true,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists resumes_select_public on storage.objects;
create policy resumes_select_public
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'resumes');

drop policy if exists resumes_insert_authenticated on storage.objects;
create policy resumes_insert_authenticated
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'resumes');

drop policy if exists resumes_update_authenticated on storage.objects;
create policy resumes_update_authenticated
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'resumes')
  with check (bucket_id = 'resumes');

drop policy if exists resumes_delete_authenticated on storage.objects;
create policy resumes_delete_authenticated
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'resumes');
