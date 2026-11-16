-- Creative Hub — "Tạo phiên bản kích thước khác" (banner size variants).
--
-- A size VARIANT is just another ordinary 'banner' creative_assets row
-- (its own design_documents history, its own exports, editable/savable/
-- exportable through the EXACT same editor and actions every other
-- banner already uses) — not a new storage system. These 3 columns are
-- the only thing that links a family of variants together and lets the
-- list view show "which preset, which is the original" without opening
-- every design_documents row.
--
-- Idempotent — safe to run more than once. Does not modify 0001-0010.

alter table public.creative_assets
  add column if not exists source_banner_id uuid,
  add column if not exists size_preset_id uuid,
  add column if not exists thumbnail_path text;

-- Added as separate, NOT VALID -> validate steps (same two-step pattern
-- as 0005's current_design_document_id FK) so this never locks/blocks on
-- a large existing creative_assets table, and stays safe to re-run.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'creative_assets_source_banner_id_fkey'
      and conrelid = 'public.creative_assets'::regclass
  ) then
    alter table public.creative_assets
      add constraint creative_assets_source_banner_id_fkey
      foreign key (source_banner_id) references public.creative_assets(id) on delete set null
      not valid;
  end if;
end $$;
do $$
begin
  alter table public.creative_assets validate constraint creative_assets_source_banner_id_fkey;
exception when others then
  null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'creative_assets_size_preset_id_fkey'
      and conrelid = 'public.creative_assets'::regclass
  ) then
    alter table public.creative_assets
      add constraint creative_assets_size_preset_id_fkey
      foreign key (size_preset_id) references public.size_presets(id) on delete set null
      not valid;
  end if;
end $$;
do $$
begin
  alter table public.creative_assets validate constraint creative_assets_size_preset_id_fkey;
exception when others then
  null;
end $$;

create index if not exists idx_creative_assets_source_banner on public.creative_assets (source_banner_id);
