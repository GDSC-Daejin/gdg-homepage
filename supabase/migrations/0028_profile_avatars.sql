alter table public.profiles
  add column avatar_path text
  check (avatar_path is null or avatar_path = id::text || '/avatar');
grant update (avatar_path) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
);

create policy "avatars: own or admin read"
on storage.objects for select to authenticated
using (
  bucket_id = 'avatars'
  and (name = auth.uid()::text || '/avatar' or public.is_admin())
);

create policy "avatars: own insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and name = auth.uid()::text || '/avatar'
);

create policy "avatars: own update"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and name = auth.uid()::text || '/avatar'
)
with check (
  bucket_id = 'avatars'
  and name = auth.uid()::text || '/avatar'
);
