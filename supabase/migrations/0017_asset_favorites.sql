-- Per-user "favorite" bookmark on a creative asset — backs the heart
-- button on Dashboard's compact "Tài sản gần đây" grid.
--
-- Deliberately per-USER, not per-workspace: a favorite here is the
-- current user's own bookmark, visible only to them. A shared,
-- workspace-wide favorites flag wasn't what was asked for, and would
-- need its own "who favorited this" UI to be meaningful — a personal
-- bookmark is the simpler, more conventional choice and matches how
-- every other "favorite"/"star" feature in consumer apps works.
--
-- No separate workspace-membership check in this table's own RLS:
-- whether the referenced asset is even visible to this user is already
-- fully enforced by creative_assets' own RLS wherever the two tables
-- are joined/read together. A dangling favorite row pointing at an
-- asset this user can no longer see (e.g. they left the workspace) is
-- harmless — it simply never surfaces anywhere, since every read path
-- joins through creative_assets first.
--
-- Idempotent — safe to run more than once. Does not modify 0001-0016.

create table if not exists public.asset_favorites (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  asset_id   uuid not null references public.creative_assets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, asset_id)
);

create index if not exists idx_asset_favorites_asset on public.asset_favorites (asset_id);

alter table public.asset_favorites enable row level security;

drop policy if exists "user manages own favorites" on public.asset_favorites;
create policy "user manages own favorites" on public.asset_favorites
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
