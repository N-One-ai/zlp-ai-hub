-- Creative Hub — customizable Dashboard feature cards ("Tạo ảnh" / "Tạo
-- banner"), extending the Dashboard banner management feature.
--
-- At most ONE row per (workspace_id, slot) — `slot` is a fixed, app-
-- defined set ('image' | 'banner'), never a user-created list, so there
-- is no create/delete CRUD here, only upsert-or-absent. A MISSING row for
-- a slot means "use the built-in default" (title/description/CTA/art),
-- which is also the natural, fully-compatible state for every workspace
-- that existed before this migration — nothing to backfill. "Khôi phục
-- mặc định" is simply deleting the row back to that state.
--
-- image_path is OPTIONAL (unlike dashboard_banners.image_path) — a card
-- can be customized (title/CTA/background) while still falling back to
-- the existing decorative SVG art (ImageHeroArt/BannerHeroArt) when no
-- custom image has been uploaded.
--
-- Idempotent — safe to run more than once. Does not modify 0001-0012.

create table if not exists public.dashboard_feature_cards (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  slot             text not null check (slot in ('image', 'banner')),
  title            text not null,
  description      text not null default '',
  cta_label        text not null default '',
  cta_url          text not null default '',
  image_path       text,
  image_width      integer,
  image_height     integer,
  focal_x          smallint not null default 50 check (focal_x between 0 and 100),
  focal_y          smallint not null default 50 check (focal_y between 0 and 100),
  background_style text not null default 'primary' check (background_style in ('primary', 'accent', 'neutral')),
  is_active        boolean not null default true,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (workspace_id, slot)
);

create index if not exists idx_dashboard_feature_cards_workspace on public.dashboard_feature_cards (workspace_id);

alter table public.dashboard_feature_cards enable row level security;

drop policy if exists "view dashboard feature cards in own workspace" on public.dashboard_feature_cards;
create policy "view dashboard feature cards in own workspace" on public.dashboard_feature_cards
  for select
  using (public.is_workspace_member(workspace_id, auth.uid()));

drop policy if exists "admin manages dashboard feature cards" on public.dashboard_feature_cards;
create policy "admin manages dashboard feature cards" on public.dashboard_feature_cards
  for all
  using (public.is_workspace_admin(workspace_id, auth.uid()))
  with check (public.is_workspace_admin(workspace_id, auth.uid()));

drop trigger if exists trg_dashboard_feature_cards_touch on public.dashboard_feature_cards;
create trigger trg_dashboard_feature_cards_touch
  before update on public.dashboard_feature_cards
  for each row
  execute function public.touch_dashboard_banner_updated_at();
