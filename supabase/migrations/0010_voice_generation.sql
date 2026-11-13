-- Creative Hub — Vbee Text-to-Speech ("Tạo giọng nói").
--
-- Mirrors generation_jobs' own shape/RLS pattern (migration 0004) almost
-- exactly — same "no background worker, the requesting user's own
-- session IS the worker" reasoning applies here too, EXCEPT for one
-- deliberate difference: Vbee's Batch API calls back a webhook
-- (src/app/api/integrations/vbee/callback/route.ts) that runs with NO
-- signed-in user at all, so `update` here is intentionally NOT
-- owner-scoped like generation_jobs' is — the webhook route uses the
-- service-role client (lib/supabase/admin.ts) to update a row by its
-- vbee_request_id regardless of whose session is "active" (there is
-- none). select/insert/delete stay owner-scoped exactly like
-- generation_jobs.
--
-- Idempotent — safe to run more than once. Does not modify 0001-0009.

create table if not exists public.voice_generation_jobs (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  brand_id        uuid not null references public.brands(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  text            text not null,
  voice_code      text not null,
  voice_name      text not null default '',
  -- 'sync' = Vbee Realtime API (<=300 chars, 5-voice whitelist, audio
  -- returned directly in the response body); 'async' = Batch API
  -- (requestId + webhook/poll). Decided server-side from the real
  -- documented constraints, never guessed client-side.
  mode            text not null check (mode in ('sync', 'async')),
  output_format   text not null default 'mp3' check (output_format in ('mp3', 'wav')),
  bitrate         integer not null default 128 check (bitrate in (8, 16, 32, 64, 128)),
  speed           numeric not null default 1.0 check (speed >= 0.25 and speed <= 1.9),
  sample_rate     integer,
  -- Only set for mode='async' — Vbee's own id for the Batch request, used
  -- to poll "Get Request" and to match an incoming webhook callback.
  vbee_request_id text,
  status          text not null default 'processing'
                    check (status in ('processing', 'succeeded', 'failed')),
  error           text,
  -- Populated the MOMENT the job succeeds (sync: immediately in the same
  -- request; async: by the webhook or the polling fallback, whichever
  -- notices completion first) — never left pointing at Vbee's own
  -- audio_link/audioLink, which the docs confirm expires in ~3 minutes.
  -- "Lưu vào Thư viện" only ever registers a creative_assets row against
  -- this ALREADY-stored file, same separation generateImages/
  -- saveGenerationResult already uses for images.
  storage_path    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_voice_generation_jobs_user on public.voice_generation_jobs (user_id, created_at desc);
create index if not exists idx_voice_generation_jobs_workspace on public.voice_generation_jobs (workspace_id);
create index if not exists idx_voice_generation_jobs_vbee_request on public.voice_generation_jobs (vbee_request_id) where vbee_request_id is not null;

alter table public.voice_generation_jobs enable row level security;

drop trigger if exists voice_generation_jobs_set_updated_at on public.voice_generation_jobs;
create trigger voice_generation_jobs_set_updated_at
  before update on public.voice_generation_jobs
  for each row execute function public.bump_updated_at();

drop policy if exists "own voice generation jobs select" on public.voice_generation_jobs;
create policy "own voice generation jobs select" on public.voice_generation_jobs
  for select
  using (user_id = auth.uid());

drop policy if exists "own voice generation jobs insert" on public.voice_generation_jobs;
create policy "own voice generation jobs insert" on public.voice_generation_jobs
  for insert
  with check (
    user_id = auth.uid()
    and public.is_workspace_contributor(workspace_id, auth.uid())
  );

-- Covers the user's OWN polling update path (lib/voice/actions.ts calling
-- Vbee's Get Request API from the user's own session). The webhook route
-- never goes through RLS at all (service-role client), so it needs no
-- policy of its own here.
drop policy if exists "own voice generation jobs update" on public.voice_generation_jobs;
create policy "own voice generation jobs update" on public.voice_generation_jobs
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "own voice generation jobs delete" on public.voice_generation_jobs;
create policy "own voice generation jobs delete" on public.voice_generation_jobs
  for delete
  using (user_id = auth.uid());

-- ------------------------------------------------------------------ --
-- creative_assets — add 'audio' as a valid type                        --
-- ------------------------------------------------------------------ --
-- Same table Task 4.0/Phase 1 already scoped for 'image' | 'banner' |
-- 'video' (migration 0004's own comment: "PRD §11 ... không cần xây dựng
-- pipeline video ở Phase 1" — the type column was always meant to grow).
-- No new columns needed: voice_code/text aren't asset-level concerns,
-- they live on voice_generation_jobs above; the asset row just needs
-- storage_path (already present) and `type = 'audio'`.
alter table public.creative_assets drop constraint if exists creative_assets_type_check;
alter table public.creative_assets add constraint creative_assets_type_check
  check (type in ('image', 'banner', 'video', 'audio'));

-- ------------------------------------------------------------------ --
-- Storage — allow audio mime types in the existing creative-assets      --
-- bucket                                                                --
-- ------------------------------------------------------------------ --
-- The bucket (migration 0004) was created image-only
-- (allowed_mime_types). Widening it here rather than creating a second
-- bucket — same workspace/brand path convention, same RLS policies
-- already in place (storage.objects policies check workspace/brand
-- membership generically, not file type), so no new Storage policy is
-- needed, only this mime allow-list update.
update storage.buckets
set allowed_mime_types = array['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp', 'audio/mpeg', 'audio/wav', 'audio/x-wav']
where id = 'creative-assets';
