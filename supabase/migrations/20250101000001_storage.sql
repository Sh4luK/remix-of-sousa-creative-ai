-- Private bucket for AI-generated images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-images',
  'generated-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Users can read their own files (path format: {user_id}/{uuid}.webp)
create policy "users_read_own_images"
  on storage.objects for select
  using (
    bucket_id = 'generated-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Uploads are performed by the edge function via service role (bypasses RLS)
