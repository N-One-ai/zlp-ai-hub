-- Creative Hub — foundation: profiles, workspaces, memberships.
--
-- Every statement is safe to run more than once (idempotent) — re-running
-- after a partial or full success is a no-op, never an error. This
-- convention is used for every migration in this project.

-- ------------------------------------------------------------------ --
-- profiles — extends auth.users 1-1                                    --
-- ------------------------------------------------------------------ --
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text,
  email       text not null,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (id = auth.uid())
  with check (id = auth.uid());

-- ------------------------------------------------------------------ --
-- workspaces                                                           --
-- ------------------------------------------------------------------ --
create table if not exists public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.workspaces enable row level security;

-- ------------------------------------------------------------------ --
-- memberships — who belongs to which workspace, with what role         --
-- ------------------------------------------------------------------ --
-- "invited" vs "active": Phase 1 keeps invites simple — an Admin invites
-- by email, and the invite can only be created if a profile with that
-- email already exists (the person has already signed up at least once).
-- A full "invite someone who has never signed up yet" flow (email + token)
-- is deliberately out of scope for Phase 1; see README for this
-- limitation and how to extend it later.
create table if not exists public.memberships (
  id          uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        text not null default 'creator' check (role in ('admin', 'creator', 'viewer')),
  status      text not null default 'active' check (status in ('invited', 'active', 'revoked')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists idx_memberships_user on public.memberships (user_id);
create index if not exists idx_memberships_workspace on public.memberships (workspace_id);

alter table public.memberships enable row level security;

create or replace function public.bump_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists memberships_set_updated_at on public.memberships;
create trigger memberships_set_updated_at
  before update on public.memberships
  for each row execute function public.bump_updated_at();

-- ------------------------------------------------------------------ --
-- RLS helper functions — SECURITY DEFINER, no recursion                --
-- ------------------------------------------------------------------ --
-- A policy on `memberships` that queries `memberships` itself (to check
-- "does the caller admin this workspace?") would re-trigger the same
-- policy on its own subquery, causing infinite recursion (error 42P17).
-- Wrapping the check in a SECURITY DEFINER function sidesteps this: the
-- function's internal query runs with the function owner's privileges,
-- not the caller's, so it is not itself subject to memberships' RLS.
-- `set search_path = ''` means every identifier must be schema-qualified
-- (already the case here), removing any reliance on `public` staying
-- exactly as expected.
create or replace function public.is_workspace_member(p_workspace_id uuid, p_user_id uuid)
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
      and status = 'active'
  );
$$;

create or replace function public.is_workspace_admin(p_workspace_id uuid, p_user_id uuid)
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
      and role = 'admin'
      and status = 'active'
  );
$$;

-- Returns true if the CALLING user (auth.uid()) and p_other_user_id share
-- at least one active workspace — lets teammates see each other's basic
-- profile (name/email/avatar) without exposing every profile to everyone.
create or replace function public.shares_workspace_with(p_other_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.memberships m1
    join public.memberships m2 on m1.workspace_id = m2.workspace_id
    where m1.user_id = auth.uid() and m1.status = 'active'
      and m2.user_id = p_other_user_id and m2.status = 'active'
  );
$$;

grant execute on function public.is_workspace_member(uuid, uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid, uuid) to authenticated;
grant execute on function public.shares_workspace_with(uuid) to authenticated;

-- Additive SELECT policy on profiles — lets a user see the basic profile
-- of anyone they share an active workspace with (needed for the Members
-- screen and for showing "created by" on assets/brands). Does not weaken
-- or replace "own profile" above; a user can still only INSERT/UPDATE/
-- DELETE their own row.
drop policy if exists "view profiles of fellow workspace members" on public.profiles;
create policy "view profiles of fellow workspace members" on public.profiles
  for select
  using (public.shares_workspace_with(id));

-- ------------------------------------------------------------------ --
-- RLS: workspaces                                                      --
-- ------------------------------------------------------------------ --
drop policy if exists "view own workspaces" on public.workspaces;
create policy "view own workspaces" on public.workspaces
  for select
  using (public.is_workspace_member(id, auth.uid()));

drop policy if exists "admin can update own workspace" on public.workspaces;
create policy "admin can update own workspace" on public.workspaces
  for update
  using (public.is_workspace_admin(id, auth.uid()))
  with check (public.is_workspace_admin(id, auth.uid()));

-- No INSERT policy for `authenticated` — the only way a workspace is ever
-- created is create_workspace_with_owner() below (SECURITY DEFINER),
-- which also creates the owner's admin membership atomically. No DELETE
-- policy either; deleting a workspace is out of scope for Phase 1.

-- ------------------------------------------------------------------ --
-- RLS: memberships                                                     --
-- ------------------------------------------------------------------ --
drop policy if exists "view own or admin-visible memberships" on public.memberships;
create policy "view own or admin-visible memberships" on public.memberships
  for select
  using (
    user_id = auth.uid()
    or public.is_workspace_admin(workspace_id, auth.uid())
  );

-- Admin may update role/status of memberships in a workspace they admin.
-- Revoking access is an UPDATE (status -> 'revoked'), not a DELETE — Phase
-- 1 deliberately has no DELETE policy on memberships, keeping a visible
-- audit trail of who was ever a member.
drop policy if exists "admin can update memberships" on public.memberships;
create policy "admin can update memberships" on public.memberships
  for update
  using (public.is_workspace_admin(workspace_id, auth.uid()))
  with check (public.is_workspace_admin(workspace_id, auth.uid()));

-- No INSERT policy for `authenticated` — the only way a membership row is
-- created is create_workspace_with_owner() (the first admin) or
-- invite_member() (migration 0001 below), both SECURITY DEFINER and both
-- re-validating the caller's own admin status server-side before writing.

-- ------------------------------------------------------------------ --
-- create_workspace_with_owner — the only way a workspace is created     --
-- ------------------------------------------------------------------ --
-- Creates a workspace and makes the calling user its first admin member,
-- atomically. Used both by the signup trigger below (auto-bootstrap a
-- first workspace, so a brand-new user can start creating immediately —
-- PRD goal: "đăng nhập, chọn thương hiệu và tạo sản phẩm đầu tiên mà
-- không cần hướng dẫn trực tiếp") and by a future "create another
-- workspace" action if ever exposed in the UI.
create or replace function public.create_workspace_with_owner(p_name text, p_owner_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
begin
  insert into public.workspaces (name, created_by)
  values (p_name, p_owner_id)
  returning id into v_workspace_id;

  insert into public.memberships (workspace_id, user_id, role, status)
  values (v_workspace_id, p_owner_id, 'admin', 'active');

  return v_workspace_id;
end;
$$;

grant execute on function public.create_workspace_with_owner(text, uuid) to authenticated;

-- ------------------------------------------------------------------ --
-- invite_member — the only way an existing membership row is created    --
-- for someone OTHER than the workspace's own first admin                --
-- ------------------------------------------------------------------ --
-- Re-validates the caller is an active admin of the target workspace
-- server-side — never trusts that the "Invite" button only appears for
-- admins in the UI. Requires the invited person to already have a
-- profiles row (i.e. they've signed up at least once) — see the
-- memberships table comment above for why this is a deliberate Phase 1
-- limitation.
create or replace function public.invite_member(p_workspace_id uuid, p_email text, p_role text)
returns public.memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_user_id uuid;
  v_row public.memberships;
begin
  if not public.is_workspace_admin(p_workspace_id, auth.uid()) then
    raise exception 'not authorized to invite members to this workspace';
  end if;

  if p_role not in ('admin', 'creator', 'viewer') then
    raise exception 'invalid role';
  end if;

  select id into v_target_user_id
  from public.profiles
  where lower(email) = lower(p_email)
  limit 1;

  if v_target_user_id is null then
    raise exception 'no account found for this email — they must sign up first';
  end if;

  insert into public.memberships (workspace_id, user_id, role, status)
  values (p_workspace_id, v_target_user_id, p_role, 'invited')
  on conflict (workspace_id, user_id)
  do update set role = excluded.role, status = 'invited', updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.invite_member(uuid, text, text) to authenticated;

-- ------------------------------------------------------------------ --
-- handle_new_user — auto-create profile + a default workspace           --
-- ------------------------------------------------------------------ --
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := coalesce(new.raw_user_meta_data ->> 'name', '');

  insert into public.profiles (id, name, email)
  values (new.id, v_name, new.email);

  perform public.create_workspace_with_owner(
    case when v_name = '' then 'My Workspace' else v_name || '''s Workspace' end,
    new.id
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
