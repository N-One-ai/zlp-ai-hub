-- Creative Hub — brands and brand guideline versions.
--
-- A brand's guideline is versioned (brand_guideline_versions), not edited
-- in place — PRD principle #5 ("Không làm mất dữ liệu: lưu phiên bản khi
-- chỉnh sửa") and §8.2 ("Tài sản cũ giữ snapshot phiên bản guideline đã
-- áp dụng khi tạo"). brands.current_guideline_version_id always points at
-- the latest version; assets created later (Task 3+) snapshot whichever
-- version was current at creation time, so an old asset's "why does this
-- look different from the brand today" is always answerable.
--
-- Idempotent — safe to run more than once. Does not modify 0001.

-- ------------------------------------------------------------------ --
-- brands                                                               --
-- ------------------------------------------------------------------ --
create table if not exists public.brands (
  id          uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name        text not null,
  description text not null default '',
  status      text not null default 'active' check (status in ('active', 'archived')),
  avatar_url  text,
  -- Added via ALTER after brand_guideline_versions exists, below — the two
  -- tables reference each other (a version belongs to a brand; a brand
  -- points at its current version), so one FK has to come second.
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_brands_workspace on public.brands (workspace_id);

alter table public.brands enable row level security;

drop trigger if exists brands_set_updated_at on public.brands;
create trigger brands_set_updated_at
  before update on public.brands
  for each row execute function public.bump_updated_at();

-- ------------------------------------------------------------------ --
-- brand_guideline_versions                                             --
-- ------------------------------------------------------------------ --
-- Logo/image fields store a STORAGE PATH inside the `brand-assets`
-- bucket (e.g. "<workspace_id>/<brand_id>/logo-primary.svg"), never a
-- public URL — the bucket is private and every read goes through a
-- signed URL generated server-side, re-checked against the same RLS as
-- everything else (PRD §12: "tránh public URL không kiểm soát").
create table if not exists public.brand_guideline_versions (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references public.brands(id) on delete cascade,
  version     integer not null,

  logo_primary_path   text,
  logo_secondary_path text,
  logo_light_path     text,
  logo_dark_path      text,

  -- [{ "name": "Primary", "hex": "#...", "role": "primary" }, ...]
  colors      jsonb not null default '[]',
  -- { "heading": { "family": "Inter", "fallback": "sans-serif" },
  --   "body":    { "family": "Inter", "fallback": "sans-serif" } }
  fonts       jsonb not null default '{}',
  -- { "topPx": 24, "rightPx": 24, "bottomPx": 24, "leftPx": 24,
  --   "notes": "..." } — simple fixed-px MVP model, see README.
  safe_zone   jsonb not null default '{}',
  -- { "preferredVariant": "primary", "minSizePx": 32, "clearSpacePx": 16,
  --   "acceptableBackgrounds": "light" }
  logo_rules  jsonb not null default '{}',
  layout_notes text not null default '',

  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (brand_id, version)
);

create index if not exists idx_guideline_versions_brand on public.brand_guideline_versions (brand_id, version desc);

alter table public.brand_guideline_versions enable row level security;

alter table public.brands
  add column if not exists current_guideline_version_id uuid references public.brand_guideline_versions(id) on delete set null;

-- ------------------------------------------------------------------ --
-- RLS: brands                                                          --
-- ------------------------------------------------------------------ --
-- Any active workspace member can READ brand config (they need it to
-- create images/banners) — only an Admin may create/edit it (PRD §4:
-- Admin "tạo và chỉnh sửa cấu hình thương hiệu, guideline"; Creator only
-- "xem và quản lý tài sản trong phạm vi được cấp").
drop policy if exists "view brands in own workspace" on public.brands;
create policy "view brands in own workspace" on public.brands
  for select
  using (public.is_workspace_member(workspace_id, auth.uid()));

drop policy if exists "admin manages brands" on public.brands;
create policy "admin manages brands" on public.brands
  for all
  using (public.is_workspace_admin(workspace_id, auth.uid()))
  with check (public.is_workspace_admin(workspace_id, auth.uid()));

-- ------------------------------------------------------------------ --
-- RLS: brand_guideline_versions                                        --
-- ------------------------------------------------------------------ --
-- No helper function needed here beyond a direct EXISTS against brands —
-- this does not recurse because brands' own policies never query
-- brand_guideline_versions back, so there is no cycle.
drop policy if exists "view guideline versions in own workspace" on public.brand_guideline_versions;
create policy "view guideline versions in own workspace" on public.brand_guideline_versions
  for select
  using (
    exists (
      select 1 from public.brands b
      where b.id = brand_guideline_versions.brand_id
        and public.is_workspace_member(b.workspace_id, auth.uid())
    )
  );

drop policy if exists "admin manages guideline versions" on public.brand_guideline_versions;
create policy "admin manages guideline versions" on public.brand_guideline_versions
  for all
  using (
    exists (
      select 1 from public.brands b
      where b.id = brand_guideline_versions.brand_id
        and public.is_workspace_admin(b.workspace_id, auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.brands b
      where b.id = brand_guideline_versions.brand_id
        and public.is_workspace_admin(b.workspace_id, auth.uid())
    )
  );

-- ------------------------------------------------------------------ --
-- Storage — brand-assets bucket (private)                              --
-- ------------------------------------------------------------------ --
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-assets', 'brand-assets', false, 5242880, array['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Objects are uploaded under "<workspace_id>/<brand_id>/<filename>" —
-- storage.foldername(name) splits the path, so element 1 is the
-- workspace id. Reusing is_workspace_member/is_workspace_admin keeps this
-- consistent with every other table's authorization rather than
-- reinventing a parallel scheme for Storage.
drop policy if exists "view brand assets in own workspace" on storage.objects;
create policy "view brand assets in own workspace" on storage.objects
  for select
  using (
    bucket_id = 'brand-assets'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

drop policy if exists "admin manages brand assets" on storage.objects;
create policy "admin manages brand assets" on storage.objects
  for all
  using (
    bucket_id = 'brand-assets'
    and public.is_workspace_admin((storage.foldername(name))[1]::uuid, auth.uid())
  )
  with check (
    bucket_id = 'brand-assets'
    and public.is_workspace_admin((storage.foldername(name))[1]::uuid, auth.uid())
  );

-- ------------------------------------------------------------------ --
-- create_or_update_guideline — the only way a guideline version is       --
-- written, atomically bumping brands.current_guideline_version_id       --
-- ------------------------------------------------------------------ --
-- Re-validates the caller is an active admin of the brand's workspace —
-- never trusts that the edit form only renders for admins. Returns the
-- new version row.
create or replace function public.create_guideline_version(
  p_brand_id uuid,
  p_logo_primary_path text,
  p_logo_secondary_path text,
  p_logo_light_path text,
  p_logo_dark_path text,
  p_colors jsonb,
  p_fonts jsonb,
  p_safe_zone jsonb,
  p_logo_rules jsonb,
  p_layout_notes text
)
returns public.brand_guideline_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
  v_next_version integer;
  v_row public.brand_guideline_versions;
begin
  select workspace_id into v_workspace_id from public.brands where id = p_brand_id;
  if v_workspace_id is null then
    raise exception 'brand not found';
  end if;
  if not public.is_workspace_admin(v_workspace_id, auth.uid()) then
    raise exception 'not authorized to edit this brand''s guideline';
  end if;

  select coalesce(max(version), 0) + 1 into v_next_version
  from public.brand_guideline_versions
  where brand_id = p_brand_id;

  insert into public.brand_guideline_versions (
    brand_id, version, logo_primary_path, logo_secondary_path, logo_light_path, logo_dark_path,
    colors, fonts, safe_zone, logo_rules, layout_notes, created_by
  )
  values (
    p_brand_id, v_next_version, p_logo_primary_path, p_logo_secondary_path, p_logo_light_path, p_logo_dark_path,
    p_colors, p_fonts, p_safe_zone, p_logo_rules, p_layout_notes, auth.uid()
  )
  returning * into v_row;

  update public.brands set current_guideline_version_id = v_row.id where id = p_brand_id;

  return v_row;
end;
$$;

grant execute on function public.create_guideline_version(uuid, text, text, text, text, jsonb, jsonb, jsonb, jsonb, text) to authenticated;
