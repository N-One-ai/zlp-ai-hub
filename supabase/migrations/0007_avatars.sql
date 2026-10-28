-- Creative Hub — Storage bucket for user profile avatars.
--
-- Every statement is safe to run more than once (idempotent), same
-- convention as every other migration in this project.

-- ------------------------------------------------------------------ --
-- Storage — avatars bucket (private)                                   --
-- ------------------------------------------------------------------ --
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Objects are uploaded under "<user_id>/<filename>" —
-- storage.foldername(name) splits the path, so element 1 is the owner's
-- user id.
--
-- SELECT is intentionally broader than brand-assets' workspace-scoped
-- policy: a user's avatar is shown to fellow members across EVERY
-- workspace they share (members-table.tsx, the sidebar header, etc.), so
-- scoping visibility to one workspace would break it for every other
-- shared workspace. An avatar is a low-sensitivity, user-chosen public-
-- facing picture — "any authenticated app user can view it" is the
-- appropriate bar here (never unauthenticated/public bucket access).
--
-- INSERT/UPDATE/DELETE stay strictly owner-only, same foldername-prefix
-- check used throughout this project's Storage policies.
drop policy if exists "view any avatar when authenticated" on storage.objects;
create policy "view any avatar when authenticated" on storage.objects
  for select
  using (bucket_id = 'avatars' and auth.role() = 'authenticated');

drop policy if exists "manage own avatar" on storage.objects;
create policy "manage own avatar" on storage.objects
  for all
  using (bucket_id = 'avatars' and (storage.foldername(name))[1]::uuid = auth.uid())
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1]::uuid = auth.uid());
