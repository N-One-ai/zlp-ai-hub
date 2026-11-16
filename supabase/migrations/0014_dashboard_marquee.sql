-- Creative Hub — Dashboard marquee strip, replacing the old 3-stat row's
-- position (the stats themselves move up next to the workspace title;
-- see dashboard/page.tsx).
--
-- One row per workspace (unique workspace_id) — there is only ever ONE
-- marquee per workspace, never a list, so this is upsert-or-absent, same
-- convention as dashboard_feature_cards. A MISSING row means "use the
-- built-in default text" (lib/dashboard/marquee-defaults.ts) — every
-- workspace that existed before this migration is unaffected until an
-- admin opts in, and an admin's own text is never silently overwritten.
--
-- Idempotent — safe to run more than once. Does not modify 0001-0013.

create table if not exists public.dashboard_marquee (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade unique,
  text          text not null default '',
  speed_seconds integer not null default 40 check (speed_seconds between 15 and 90),
  is_active     boolean not null default true,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_dashboard_marquee_workspace on public.dashboard_marquee (workspace_id);

alter table public.dashboard_marquee enable row level security;

drop policy if exists "view dashboard marquee in own workspace" on public.dashboard_marquee;
create policy "view dashboard marquee in own workspace" on public.dashboard_marquee
  for select
  using (public.is_workspace_member(workspace_id, auth.uid()));

drop policy if exists "admin manages dashboard marquee" on public.dashboard_marquee;
create policy "admin manages dashboard marquee" on public.dashboard_marquee
  for all
  using (public.is_workspace_admin(workspace_id, auth.uid()))
  with check (public.is_workspace_admin(workspace_id, auth.uid()));

drop trigger if exists trg_dashboard_marquee_touch on public.dashboard_marquee;
create trigger trg_dashboard_marquee_touch
  before update on public.dashboard_marquee
  for each row
  execute function public.touch_dashboard_banner_updated_at();
