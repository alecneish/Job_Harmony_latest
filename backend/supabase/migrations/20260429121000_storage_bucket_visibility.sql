-- Allow the frontend to resolve the public resumes bucket metadata.
-- Object access remains constrained by the storage.objects policies.

drop policy if exists resumes_bucket_select_public on storage.buckets;
create policy resumes_bucket_select_public
  on storage.buckets
  for select
  to anon, authenticated
  using (id = 'resumes');
