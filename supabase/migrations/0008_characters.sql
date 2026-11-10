-- Creative Hub — Character Builder.
--
-- A "character" is a reusable identity (tag name, gender, a locked face)
-- used to generate consistent multi-angle turnaround sheets (front/side/
-- back) through the EXISTING generation_jobs pipeline — this migration
-- adds a `characters` table plus optional linkage columns on
-- generation_jobs, never touching how a normal (non-character) image job
-- behaves. Idempotent — safe to run more than once, same convention as
-- every other migration in this project.

-- ------------------------------------------------------------------ --
-- characters                                                           --
-- ------------------------------------------------------------------ --
create table if not exists public.characters (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  created_by        uuid not null references public.profiles(id) on delete cascade,
  -- Free-text display name (optional — falls back to "@tag_name" in the UI
  -- when empty) PLUS the validated @tag handle used to reference this
  -- character elsewhere. Two separate fields per product ask: a name is
  -- free-form, a tag is a stable, URL/mention-safe identifier.
  display_name      text not null default '',
  tag_name          text not null,
  gender            text not null default 'female' check (gender in ('male', 'female')),
  -- Locked identity traits, same rationale as gender — a character's race/
  -- age shouldn't drift between sheets, so these live here (immutable
  -- after creation, see renameCharacter() in character-actions.ts) rather
  -- than among the re-editable per-sheet generation params (style/outfit).
  ethnicity         text not null default 'vietnamese' check (ethnicity in ('vietnamese', 'asian', 'european')),
  -- Exact age (not a bucket) — product chose a stepper input over age
  -- ranges. 12-80 matches the stepper's own min/max in character-builder.tsx.
  age               integer not null default 22 check (age between 12 and 80),
  face_source       text not null check (face_source in ('upload', 'ai')),
  -- Storage path in the EXISTING creative-assets bucket (first path
  -- segment = workspace_id, same convention as every other path in that
  -- bucket — see migration 0004) — "<workspace_id>/_character-faces/<uuid>.<ext>"
  -- for an uploaded face, or the generation_jobs output path directly
  -- (no re-upload) when face_source = 'ai'.
  face_storage_path text,
  face_locked       boolean not null default false,
  -- Required true when face_source = 'upload' (enforced in the Server
  -- Action, not just the UI) — "đây là ảnh của tôi hoặc người đã đồng ý
  -- cho sử dụng". Not meaningful for an AI-generated face.
  consent_confirmed boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_characters_workspace on public.characters (workspace_id, created_at desc);

-- Tag uniqueness is per-workspace, case-insensitive — "@nhanvatnu" and
-- "@NhanVatNu" are the same handle. Enforced here as the source of truth;
-- createCharacter()/renameCharacter() in character-actions.ts also do a
-- fast client-visible pre-check against the already-loaded character list,
-- but this index is what actually prevents a race between two concurrent
-- requests (the Server Action catches Postgres' unique-violation error
-- code 23505 and turns it into a friendly Vietnamese message).
create unique index if not exists idx_characters_workspace_tag_unique
  on public.characters (workspace_id, lower(tag_name));

alter table public.characters enable row level security;

drop trigger if exists characters_set_updated_at on public.characters;
create trigger characters_set_updated_at
  before update on public.characters
  for each row execute function public.bump_updated_at();

-- Same visibility shape as creative_assets (migration 0004): any active
-- workspace member can see a character once created (shared team
-- context), only a contributor (admin/creator) can create one, and only
-- its owner or a workspace admin can edit/delete it.
drop policy if exists "view characters in own workspace" on public.characters;
create policy "view characters in own workspace" on public.characters
  for select
  using (public.is_workspace_member(workspace_id, auth.uid()));

drop policy if exists "contributor creates characters" on public.characters;
create policy "contributor creates characters" on public.characters
  for insert
  with check (
    public.is_workspace_contributor(workspace_id, auth.uid())
    and created_by = auth.uid()
  );

drop policy if exists "owner or admin manages characters" on public.characters;
create policy "owner or admin manages characters" on public.characters
  for update
  using (created_by = auth.uid() or public.is_workspace_admin(workspace_id, auth.uid()))
  with check (created_by = auth.uid() or public.is_workspace_admin(workspace_id, auth.uid()));

drop policy if exists "owner or admin deletes characters" on public.characters;
create policy "owner or admin deletes characters" on public.characters
  for delete
  using (created_by = auth.uid() or public.is_workspace_admin(workspace_id, auth.uid()));

-- ------------------------------------------------------------------ --
-- generation_jobs — optional character-sheet linkage                   --
-- ------------------------------------------------------------------ --
-- A "character sheet" batch is 1-3 generation_jobs rows (one per view
-- angle) sharing the same character_sheet_id, generated client-side as
-- crypto.randomUUID() once per "Tạo bảng nhân vật" click (see
-- lib/generation/character-actions.ts). Every job row still goes through
-- the UNMODIFIED generateImages() pipeline in lib/generation/actions.ts —
-- these columns are only ever set afterwards, as a follow-up UPDATE the
-- caller already owns (RLS "own generation jobs" still applies).
-- "portrait" (close-up face) was added alongside front/side/back after
-- the first version of this migration, before it was ever applied
-- anywhere — see README's Character Builder section for why a close-up
-- is its own view rather than folded into "front".
alter table public.generation_jobs add column if not exists character_id uuid references public.characters(id) on delete set null;
alter table public.generation_jobs add column if not exists character_view text check (character_view in ('portrait', 'front', 'side', 'back'));
alter table public.generation_jobs add column if not exists character_sheet_id uuid;

-- Belt-and-suspenders for anyone who DID already run the first version of
-- this migration before this update landed: widen the check constraint in
-- place instead of silently leaving "portrait" rejected by a stale rule.
alter table public.generation_jobs drop constraint if exists generation_jobs_character_view_check;
alter table public.generation_jobs add constraint generation_jobs_character_view_check
  check (character_view in ('portrait', 'front', 'side', 'back'));

create index if not exists idx_generation_jobs_character on public.generation_jobs (character_id, created_at desc);
create index if not exists idx_generation_jobs_sheet on public.generation_jobs (character_sheet_id);
