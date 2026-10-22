-- Creative Hub — size presets and banner templates.
--
-- Size presets are WORKSPACE-scoped, not brand-scoped: a channel's pixel
-- dimensions (e.g. "Instagram Post — 1080x1080") are not brand-specific,
-- so one set of presets is reusable across every brand in a workspace —
-- PRD §8.2 lists presets separately from per-brand Template, and §7.3
-- says presets are Admin-configured, not hard-coded, without tying them
-- to one brand. Templates ARE brand-scoped (a template's logo placement
-- is meaningless without a specific brand's logo).
--
-- Idempotent — safe to run more than once. Does not modify 0001-0002.

create table if not exists public.size_presets (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  name          text not null,
  channel       text not null default '',
  width         integer not null check (width > 0),
  height        integer not null check (height > 0),
  export_format text not null default 'png' check (export_format in ('png', 'jpg')),
  created_at    timestamptz not null default now()
);

create index if not exists idx_size_presets_workspace on public.size_presets (workspace_id);

alter table public.size_presets enable row level security;

drop policy if exists "view size presets in own workspace" on public.size_presets;
create policy "view size presets in own workspace" on public.size_presets
  for select
  using (public.is_workspace_member(workspace_id, auth.uid()));

drop policy if exists "admin manages size presets" on public.size_presets;
create policy "admin manages size presets" on public.size_presets
  for all
  using (public.is_workspace_admin(workspace_id, auth.uid()))
  with check (public.is_workspace_admin(workspace_id, auth.uid()));

-- ------------------------------------------------------------------ --
-- templates — brand-scoped banner layouts                              --
-- ------------------------------------------------------------------ --
-- `layout` is a minimal MVP schema consumed by the Task 4.0 editor:
-- { "logo": { "x": 24, "y": 24, "widthPx": 96 },
--   "textFields": [{ "id": "headline", "x": 24, "y": 400, "maxWidthPx": 600 }] }
-- It intentionally does not try to describe a full design document (see
-- design_documents in Task 4.0) — a template is a starting point, not a
-- saved banner.
create table if not exists public.templates (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid not null references public.brands(id) on delete cascade,
  name           text not null,
  size_preset_id uuid references public.size_presets(id) on delete set null,
  layout         jsonb not null default '{}',
  status         text not null default 'active' check (status in ('active', 'archived')),
  created_at     timestamptz not null default now()
);

create index if not exists idx_templates_brand on public.templates (brand_id);

alter table public.templates enable row level security;

drop policy if exists "view templates in own workspace" on public.templates;
create policy "view templates in own workspace" on public.templates
  for select
  using (
    exists (
      select 1 from public.brands b
      where b.id = templates.brand_id
        and public.is_workspace_member(b.workspace_id, auth.uid())
    )
  );

drop policy if exists "admin manages templates" on public.templates;
create policy "admin manages templates" on public.templates
  for all
  using (
    exists (
      select 1 from public.brands b
      where b.id = templates.brand_id
        and public.is_workspace_admin(b.workspace_id, auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.brands b
      where b.id = templates.brand_id
        and public.is_workspace_admin(b.workspace_id, auth.uid())
    )
  );
