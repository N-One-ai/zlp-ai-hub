-- Creative Hub — banner editor: design_documents + exports.
--
-- creative_assets itself was already created in migration 0004 (moved up
-- from the original plan because Task 3.0 needed it) — this migration
-- only ADDS the two tables that didn't exist yet, plus one column on
-- creative_assets pointing at the current design document, same
-- "current_*_id" pattern already used by brands.current_guideline_version_id.
--
-- Idempotent — safe to run more than once. Does not modify 0001-0004.

alter table public.creative_assets
  add column if not exists current_design_document_id uuid;
-- FK added separately below, after design_documents exists (same
-- two-step reasoning as brands/brand_guideline_versions in migration 0002).

-- ------------------------------------------------------------------ --
-- design_documents — versioned editor state for a 'banner' asset        --
-- ------------------------------------------------------------------ --
-- Never edited in place — every save is a NEW version (PRD principle #5,
-- same pattern as brand_guideline_versions). `document` holds the actual
-- layer tree; see src/types/design.ts for its exact shape. guideline
--_version_id snapshots whichever brand guideline was current at save
-- time, independent of whatever the brand's guideline looks like later.
create table if not exists public.design_documents (
  id                    uuid primary key default gen_random_uuid(),
  asset_id              uuid not null references public.creative_assets(id) on delete cascade,
  version               integer not null,
  size_preset_id        uuid references public.size_presets(id) on delete set null,
  width                 integer not null,
  height                integer not null,
  -- { "layers": [ { id, type: 'background'|'image'|'text'|'logo'|'shape',
  --   x, y, width, height, rotation, zIndex, locked, ... } ] }
  document              jsonb not null default '{"layers": []}',
  guideline_version_id  uuid references public.brand_guideline_versions(id) on delete set null,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  unique (asset_id, version)
);

create index if not exists idx_design_documents_asset on public.design_documents (asset_id, version desc);

alter table public.design_documents enable row level security;

-- Postgres has no "add constraint if not exists" — guard manually so this
-- migration stays safe to run more than once (same idempotency convention
-- as every other migration in this project).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'creative_assets_current_design_document_id_fkey'
      and conrelid = 'public.creative_assets'::regclass
  ) then
    alter table public.creative_assets
      add constraint creative_assets_current_design_document_id_fkey
      foreign key (current_design_document_id) references public.design_documents(id) on delete set null
      not valid;
  end if;
end $$;
-- NOT VALID + a separate validate step avoids locking creative_assets
-- against a large existing table while adding the constraint; safe to
-- run repeatedly (will simply already be valid on a second run).
do $$
begin
  alter table public.creative_assets validate constraint creative_assets_current_design_document_id_fkey;
exception when others then
  null;
end $$;

-- ------------------------------------------------------------------ --
-- RLS: design_documents                                                --
-- ------------------------------------------------------------------ --
-- Same visibility shape as creative_assets itself: any workspace member
-- can view; only the asset's owner or a workspace admin can save a new
-- version (not every contributor — a banner has one responsible editor
-- per PRD's "Chủ sở hữu" framing in §4, matching creative_assets' own
-- "owner or admin manages" update policy).
drop policy if exists "view design documents in own workspace" on public.design_documents;
create policy "view design documents in own workspace" on public.design_documents
  for select
  using (
    exists (
      select 1 from public.creative_assets a
      where a.id = design_documents.asset_id
        and public.is_workspace_member(a.workspace_id, auth.uid())
    )
  );

drop policy if exists "owner or admin saves design documents" on public.design_documents;
create policy "owner or admin saves design documents" on public.design_documents
  for insert
  with check (
    exists (
      select 1 from public.creative_assets a
      where a.id = design_documents.asset_id
        and (a.owner_id = auth.uid() or public.is_workspace_admin(a.workspace_id, auth.uid()))
    )
  );

-- ------------------------------------------------------------------ --
-- exports                                                              --
-- ------------------------------------------------------------------ --
create table if not exists public.exports (
  id                  uuid primary key default gen_random_uuid(),
  asset_id            uuid not null references public.creative_assets(id) on delete cascade,
  design_document_id  uuid references public.design_documents(id) on delete set null,
  format              text not null check (format in ('png', 'jpg')),
  width               integer not null,
  height              integer not null,
  storage_path        text not null,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now()
);

create index if not exists idx_exports_asset on public.exports (asset_id, created_at desc);

alter table public.exports enable row level security;

drop policy if exists "view exports in own workspace" on public.exports;
create policy "view exports in own workspace" on public.exports
  for select
  using (
    exists (
      select 1 from public.creative_assets a
      where a.id = exports.asset_id
        and public.is_workspace_member(a.workspace_id, auth.uid())
    )
  );

drop policy if exists "owner or admin creates exports" on public.exports;
create policy "owner or admin creates exports" on public.exports
  for insert
  with check (
    exists (
      select 1 from public.creative_assets a
      where a.id = exports.asset_id
        and (a.owner_id = auth.uid() or public.is_workspace_admin(a.workspace_id, auth.uid()))
    )
  );
