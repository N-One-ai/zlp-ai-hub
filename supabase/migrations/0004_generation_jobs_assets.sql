-- Creative Hub — AI image generation jobs + the creative_assets library.
--
-- DEVIATION FROM THE ORIGINAL TASK PLAN (tasks/tasks-creative-hub.md):
-- Task 3.8 ("khi job thành công, lưu kết quả vào creative_assets") needs
-- creative_assets to exist, but it was originally slated for Task 4.0's
-- migration 0005 alongside design_documents. Creating it here instead,
-- now, is the only way Task 3.0 can actually save anything — so
-- creative_assets is created in THIS migration; migration 0005 (Task 4.0)
-- will ALTER it if banners need columns this doesn't already cover, and
-- add design_documents/exports alongside it. This is documented here and
-- in the task list rather than silently diverging.
--
-- Idempotent — safe to run more than once. Does not modify 0001-0003.

-- ------------------------------------------------------------------ --
-- is_workspace_contributor — admin OR creator, i.e. "can make things"   --
-- ------------------------------------------------------------------ --
-- A Viewer (PRD §4: "xem và tải xuống tài sản được chia sẻ; không tạo
-- hoặc thay đổi cấu hình") must never be able to create a generation job
-- or save an asset — only read/download. Admin and Creator both can.
create or replace function public.is_workspace_contributor(p_workspace_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.memberships
    where workspace_id = p_workspace_id
      and user_id = p_user_id
      and role in ('admin', 'creator')
      and status = 'active'
  );
$$;

grant execute on function public.is_workspace_contributor(uuid, uuid) to authenticated;

-- ------------------------------------------------------------------ --
-- generation_jobs                                                      --
-- ------------------------------------------------------------------ --
-- Deliberately owner-scoped, not workspace-wide visible: a generation
-- job's prompt is someone's in-progress working input, not yet a shared
-- deliverable — the thing that becomes shared team content is the saved
-- creative_asset once generation succeeds (see below), not the job itself.
--
-- There is no separate background worker in Phase 1 (see README's
-- "Generation job" stack decision) — the SAME Server Action that inserts
-- a 'queued' row also calls the provider and updates it to
-- 'processing' -> 'succeeded'/'failed' synchronously, all as the
-- requesting user's own session. This is why update is owner-scoped too,
-- not restricted to a service-role-only path: the "worker" IS the user's
-- own authenticated request.
create table if not exists public.generation_jobs (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  brand_id        uuid not null references public.brands(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  job_type        text not null default 'image' check (job_type in ('image')),
  prompt          text not null,
  negative_prompt text not null default '',
  -- { "aspectRatio": "1:1", "width": 1080, "height": 1080, "count": 2,
  --   "sizePresetId": "..." }
  params          jsonb not null default '{}',
  provider        text not null default 'demo',
  model           text,
  status          text not null default 'queued'
                    check (status in ('queued', 'processing', 'succeeded', 'failed', 'cancelled')),
  error           text,
  -- [{ "path": "...", "width": 1080, "height": 1080, "isDemo": true }, ...]
  output          jsonb not null default '[]',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_generation_jobs_user on public.generation_jobs (user_id, created_at desc);
create index if not exists idx_generation_jobs_workspace on public.generation_jobs (workspace_id);

alter table public.generation_jobs enable row level security;

drop trigger if exists generation_jobs_set_updated_at on public.generation_jobs;
create trigger generation_jobs_set_updated_at
  before update on public.generation_jobs
  for each row execute function public.bump_updated_at();

drop policy if exists "own generation jobs" on public.generation_jobs;
create policy "own generation jobs" on public.generation_jobs
  for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.is_workspace_contributor(workspace_id, auth.uid())
  );

-- ------------------------------------------------------------------ --
-- creative_assets — the shared, workspace-visible library               --
-- ------------------------------------------------------------------ --
-- `type` already includes 'banner' and 'video' even though Phase 1 only
-- ever writes 'image' rows — PRD §11: "Thiết kế schema để CreativeAsset
-- hỗ trợ loại image, banner và sau này video; không cần xây dựng pipeline
-- video ở Phase 1." Task 4.0 (migration 0005) will add design_documents
-- for the 'banner' type; this table does not change shape for that, only
-- gets a new sibling table it can reference.
--
-- guideline_version_id snapshots whichever brand_guideline_versions row
-- was CURRENT at creation time (PRD §8.2 / principle #5) — never updated
-- afterward, so an old asset's "why does this look different from the
-- brand today" is always answerable from its own row.
create table if not exists public.creative_assets (
  id                      uuid primary key default gen_random_uuid(),
  workspace_id            uuid not null references public.workspaces(id) on delete cascade,
  brand_id                uuid not null references public.brands(id) on delete cascade,
  owner_id                uuid references public.profiles(id) on delete set null,
  type                    text not null check (type in ('image', 'banner', 'video')),
  name                    text not null default '',
  campaign                text not null default '',
  tags                    text[] not null default '{}',
  status                  text not null default 'ready' check (status in ('draft', 'ready', 'archived')),
  -- Storage path in the `creative-assets` bucket (private, signed URLs
  -- only — same convention as brand-assets). Populated for 'image' rows
  -- immediately; for 'banner' rows this becomes the exported PNG/JPG
  -- once Task 4.0's export step runs, and may be null before that.
  storage_path            text,
  width                   integer,
  height                  integer,
  prompt                  text,
  source_generation_job_id uuid references public.generation_jobs(id) on delete set null,
  guideline_version_id    uuid references public.brand_guideline_versions(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists idx_creative_assets_workspace on public.creative_assets (workspace_id, created_at desc);
create index if not exists idx_creative_assets_brand on public.creative_assets (brand_id);

alter table public.creative_assets enable row level security;

drop trigger if exists creative_assets_set_updated_at on public.creative_assets;
create trigger creative_assets_set_updated_at
  before update on public.creative_assets
  for each row execute function public.bump_updated_at();

-- Any active workspace member can see and download the library (PRD §4:
-- Creator "xem và quản lý tài sản trong phạm vi được cấp"; Viewer "xem và
-- tải xuống tài sản được chia sẻ"). Only a contributor (admin/creator) can
-- create/edit, and PRD §7.4 "Xóa theo quyền" is enforced by requiring
-- either the asset's own owner or a workspace admin, not any contributor.
drop policy if exists "view creative assets in own workspace" on public.creative_assets;
create policy "view creative assets in own workspace" on public.creative_assets
  for select
  using (public.is_workspace_member(workspace_id, auth.uid()));

drop policy if exists "contributor creates creative assets" on public.creative_assets;
create policy "contributor creates creative assets" on public.creative_assets
  for insert
  with check (
    public.is_workspace_contributor(workspace_id, auth.uid())
    and owner_id = auth.uid()
  );

drop policy if exists "owner or admin manages creative assets" on public.creative_assets;
create policy "owner or admin manages creative assets" on public.creative_assets
  for update
  using (owner_id = auth.uid() or public.is_workspace_admin(workspace_id, auth.uid()))
  with check (owner_id = auth.uid() or public.is_workspace_admin(workspace_id, auth.uid()));

drop policy if exists "owner or admin deletes creative assets" on public.creative_assets;
create policy "owner or admin deletes creative assets" on public.creative_assets
  for delete
  using (owner_id = auth.uid() or public.is_workspace_admin(workspace_id, auth.uid()));

-- ------------------------------------------------------------------ --
-- Storage — creative-assets bucket (private)                           --
-- ------------------------------------------------------------------ --
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('creative-assets', 'creative-assets', false, 10485760, array['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Objects are uploaded under "<workspace_id>/<brand_id>/<filename>",
-- same convention as brand-assets (migration 0002).
drop policy if exists "view creative assets in own workspace" on storage.objects;
create policy "view creative assets in own workspace" on storage.objects
  for select
  using (
    bucket_id = 'creative-assets'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

drop policy if exists "contributor manages creative asset files" on storage.objects;
create policy "contributor manages creative asset files" on storage.objects
  for all
  using (
    bucket_id = 'creative-assets'
    and public.is_workspace_contributor((storage.foldername(name))[1]::uuid, auth.uid())
  )
  with check (
    bucket_id = 'creative-assets'
    and public.is_workspace_contributor((storage.foldername(name))[1]::uuid, auth.uid())
  );
