-- Creative Hub — Dashboard hero carousel banners.
--
-- Workspace-scoped (not brand-scoped): the Dashboard hero is a single
-- cross-brand welcome/promo surface, not tied to any one brand. Admin
-- manages content; every workspace member can view (read) the active
-- banners that render in their own Dashboard. Same two-tier pattern as
-- size_presets (0003): RLS enforces it independently of the app's own
-- FORBIDDEN count-check in lib/dashboard/actions.ts.
--
-- Idempotent — safe to run more than once. Does not modify 0001-0011.

-- image_width/image_height are the uploaded file's own natural pixel size
-- (read client-side at upload time) — persisted so the management list and
-- form can display "1600×800 px · 2:1" without re-probing the file on
-- every render. focal_x/focal_y (0-100, percentage) are the CSS
-- object-position anchor used when the image is cover-cropped into the
-- Dashboard frame, the simplest reliable "adjust image position in the
-- frame" mechanism available without adding a cropping library.
-- mobile_image_path is OPTIONAL — a banner with none just reuses image_path
-- for the mobile (4:3) frame too, cover-cropped with its own focal point.
create table if not exists public.dashboard_banners (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,
  title               text not null,
  description         text not null default '',
  cta_label           text not null default '',
  cta_url             text not null default '',
  image_path          text not null,
  image_width         integer,
  image_height        integer,
  focal_x             smallint not null default 50 check (focal_x between 0 and 100),
  focal_y             smallint not null default 50 check (focal_y between 0 and 100),
  mobile_image_path   text,
  mobile_image_width  integer,
  mobile_image_height integer,
  mobile_focal_x      smallint not null default 50 check (mobile_focal_x between 0 and 100),
  mobile_focal_y      smallint not null default 50 check (mobile_focal_y between 0 and 100),
  sort_order          integer not null default 0,
  is_active           boolean not null default true,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_dashboard_banners_workspace on public.dashboard_banners (workspace_id, sort_order);

alter table public.dashboard_banners enable row level security;

drop policy if exists "view dashboard banners in own workspace" on public.dashboard_banners;
create policy "view dashboard banners in own workspace" on public.dashboard_banners
  for select
  using (public.is_workspace_member(workspace_id, auth.uid()));

drop policy if exists "admin manages dashboard banners" on public.dashboard_banners;
create policy "admin manages dashboard banners" on public.dashboard_banners
  for all
  using (public.is_workspace_admin(workspace_id, auth.uid()))
  with check (public.is_workspace_admin(workspace_id, auth.uid()));

-- Keep updated_at current on every edit, same convention as other
-- versioned/editable tables in this schema.
create or replace function public.touch_dashboard_banner_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_dashboard_banners_touch on public.dashboard_banners;
create trigger trg_dashboard_banners_touch
  before update on public.dashboard_banners
  for each row
  execute function public.touch_dashboard_banner_updated_at();
