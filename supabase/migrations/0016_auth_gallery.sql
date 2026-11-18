-- Creative Hub — shared decorative image gallery for the pre-auth
-- /login and /register pages.
--
-- These pages render for visitors with NO session (auth.uid() is null),
-- so they cannot reuse the existing workspace-scoped "creative-assets"
-- bucket/tables (every read there is gated by workspace membership).
-- This feature therefore gets its own GLOBAL (not workspace-scoped)
-- table and its own PUBLIC Storage bucket, readable by anyone without a
-- signed URL.
--
-- There is also no existing "platform admin" role in this schema (every
-- `admin` role recorded in `memberships` is scoped to one workspace).
-- Since this gallery is shared across the whole app rather than any one
-- workspace, management is granted to anyone who is `admin` of AT LEAST
-- ONE active workspace — the same trust level the app already extends
-- to workspace admins for Dashboard banners etc., just not restricted to
-- a single workspace_id. See public.is_platform_admin() below.
--
-- Idempotent — safe to run more than once. Does not modify 0001-0015.

-- ------------------------------------------------------------------ --
-- is_platform_admin — see rationale above                              --
-- ------------------------------------------------------------------ --
create or replace function public.is_platform_admin(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.memberships
    where user_id = p_user_id
      and role = 'admin'
      and status = 'active'
  );
$$;

-- ------------------------------------------------------------------ --
-- Storage — auth-gallery bucket (PUBLIC, unlike every other bucket)    --
-- ------------------------------------------------------------------ --
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('auth-gallery', 'auth-gallery', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Public bucket reads bypass Storage RLS entirely via the
-- `/object/public/...` endpoint (what `getPublicUrl()` returns) — no
-- select policy is needed for that path. Writes still go through the
-- authenticated API and ARE subject to RLS below.
drop policy if exists "admin manages auth gallery files" on storage.objects;
create policy "admin manages auth gallery files" on storage.objects
  for all
  using (bucket_id = 'auth-gallery' and public.is_platform_admin(auth.uid()))
  with check (bucket_id = 'auth-gallery' and public.is_platform_admin(auth.uid()));

-- ------------------------------------------------------------------ --
-- auth_gallery_images                                                  --
-- ------------------------------------------------------------------ --
-- image_path is either a path inside the "auth-gallery" Storage bucket
-- (resolved via getPublicUrl, see lib/auth-gallery/storage.ts) OR a
-- site-relative "/..." URL for a static asset already shipped under
-- public/ (used by the seed rows below, and still deletable/reorderable
-- like any other row — only Storage cleanup is skipped for those, since
-- there's no Storage object to remove).
create table if not exists public.auth_gallery_images (
  id            uuid primary key default gen_random_uuid(),
  image_path    text not null,
  image_width   integer,
  image_height  integer,
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_auth_gallery_images_sort on public.auth_gallery_images (sort_order);

alter table public.auth_gallery_images enable row level security;

-- Visible to anyone (including anon visitors on /login, /register) when
-- active — this is the ONLY read path the public pages use.
drop policy if exists "public can view active auth gallery images" on public.auth_gallery_images;
create policy "public can view active auth gallery images" on public.auth_gallery_images
  for select
  using (is_active = true);

-- Admins additionally see inactive rows too, so the management page can
-- show everything, not just what's currently live.
drop policy if exists "admin can view all auth gallery images" on public.auth_gallery_images;
create policy "admin can view all auth gallery images" on public.auth_gallery_images
  for select
  using (public.is_platform_admin(auth.uid()));

drop policy if exists "admin manages auth gallery images" on public.auth_gallery_images;
create policy "admin manages auth gallery images" on public.auth_gallery_images
  for all
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

drop trigger if exists auth_gallery_images_set_updated_at on public.auth_gallery_images;
create trigger auth_gallery_images_set_updated_at
  before update on public.auth_gallery_images
  for each row execute function public.bump_updated_at();

-- ------------------------------------------------------------------ --
-- auth_gallery_settings — single global on/off switch                 --
-- ------------------------------------------------------------------ --
create table if not exists public.auth_gallery_settings (
  id          smallint primary key default 1 check (id = 1),
  is_enabled  boolean not null default true,
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);

insert into public.auth_gallery_settings (id, is_enabled)
values (1, true)
on conflict (id) do nothing;

alter table public.auth_gallery_settings enable row level security;

-- Every visitor (including anon) needs to read this to decide whether to
-- render the gallery at all.
drop policy if exists "anyone can view auth gallery settings" on public.auth_gallery_settings;
create policy "anyone can view auth gallery settings" on public.auth_gallery_settings
  for select
  using (true);

drop policy if exists "admin manages auth gallery settings" on public.auth_gallery_settings;
create policy "admin manages auth gallery settings" on public.auth_gallery_settings
  for update
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

drop trigger if exists auth_gallery_settings_set_updated_at on public.auth_gallery_settings;
create trigger auth_gallery_settings_set_updated_at
  before update on public.auth_gallery_settings
  for each row execute function public.bump_updated_at();

-- ------------------------------------------------------------------ --
-- Seed rows — the 12 original static SVG tiles already shipped under   --
-- public/auth/gallery/ (see src/components/auth/auth-gallery.tsx's     --
-- prior revision) — so the gallery isn't empty out of the box. Fixed    --
-- deterministic UUIDs keep this insert idempotent; an admin can delete  --
-- or reorder any of these later like any other row.                    --
-- ------------------------------------------------------------------ --
-- image_width/image_height are each tile's real intrinsic SVG size (see
-- the generator script used to create them) — stored so the gallery
-- renders these seed tiles at their own varied aspect ratio (matching
-- the reference design's mixed portrait/square/landscape look) instead
-- of falling back to a guessed ratio.
insert into public.auth_gallery_images (id, image_path, image_width, image_height, sort_order, is_active)
values
  ('a7e5e3f0-0001-4a00-8000-000000000001', '/auth/gallery/tile-01.svg', 360, 480, 0, true),
  ('a7e5e3f0-0001-4a00-8000-000000000002', '/auth/gallery/tile-02.svg', 480, 360, 1, true),
  ('a7e5e3f0-0001-4a00-8000-000000000003', '/auth/gallery/tile-03.svg', 360, 360, 2, true),
  ('a7e5e3f0-0001-4a00-8000-000000000004', '/auth/gallery/tile-04.svg', 340, 460, 3, true),
  ('a7e5e3f0-0001-4a00-8000-000000000005', '/auth/gallery/tile-05.svg', 420, 300, 4, true),
  ('a7e5e3f0-0001-4a00-8000-000000000006', '/auth/gallery/tile-06.svg', 340, 340, 5, true),
  ('a7e5e3f0-0001-4a00-8000-000000000007', '/auth/gallery/tile-07.svg', 360, 480, 6, true),
  ('a7e5e3f0-0001-4a00-8000-000000000008', '/auth/gallery/tile-08.svg', 440, 330, 7, true),
  ('a7e5e3f0-0001-4a00-8000-000000000009', '/auth/gallery/tile-09.svg', 340, 340, 8, true),
  ('a7e5e3f0-0001-4a00-8000-00000000000a', '/auth/gallery/tile-10.svg', 320, 420, 9, true),
  ('a7e5e3f0-0001-4a00-8000-00000000000b', '/auth/gallery/tile-11.svg', 460, 280, 10, true),
  ('a7e5e3f0-0001-4a00-8000-00000000000c', '/auth/gallery/tile-12.svg', 340, 420, 11, true)
on conflict (id) do nothing;
