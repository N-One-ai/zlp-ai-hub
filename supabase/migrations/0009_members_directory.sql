-- Creative Hub — Members directory: paginated/searchable member list +
-- "newly registered but not yet in this workspace" lookup.
--
-- `profiles` RLS (migration 0001) only lets a user see their own profile
-- or a fellow ACTIVE-workspace-member's profile ("view profiles of fellow
-- workspace members") — by design, nobody can browse the full account
-- list. Finding users who have signed up but aren't in a given workspace
-- yet therefore needs a privileged, admin-gated RPC (the same shape as
-- invite_member below: SECURITY DEFINER, re-checks is_workspace_admin()
-- itself, never trusts the caller's own RLS visibility). Idempotent —
-- safe to run more than once, same convention as every other migration.

-- ------------------------------------------------------------------ --
-- search_workspace_members — paginated, searchable, admin-only          --
-- ------------------------------------------------------------------ --
-- Same data getWorkspaceMembers() (lib/workspace/queries.ts) already
-- reads via plain RLS-scoped select — this is the backend-paginated/
-- searched version for the Members page specifically. Every other caller
-- of getWorkspaceMembers (dashboard/library/settings member counts) is
-- untouched and keeps using the plain query.
create or replace function public.search_workspace_members(
  p_workspace_id uuid,
  p_search text default '',
  p_limit int default 10,
  p_offset int default 0
)
returns table (
  membership_id uuid,
  user_id uuid,
  name text,
  email text,
  avatar_url text,
  role text,
  status text,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not public.is_workspace_admin(p_workspace_id, auth.uid()) then
    raise exception 'not authorized to view members of this workspace';
  end if;

  return query
    select
      m.id,
      m.user_id,
      p.name,
      p.email,
      p.avatar_url,
      m.role,
      m.status,
      m.created_at,
      count(*) over() as total_count
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    where m.workspace_id = p_workspace_id
      and (
        p_search = ''
        or p.name ilike '%' || p_search || '%'
        or p.email ilike '%' || p_search || '%'
      )
    order by m.created_at asc
    limit p_limit offset p_offset;
end;
$$;

grant execute on function public.search_workspace_members(uuid, text, int, int) to authenticated;

-- ------------------------------------------------------------------ --
-- search_unassigned_users — signed-up accounts with NO membership row   --
-- in this workspace (any status) — admin-only, paginated, searchable.   --
-- ------------------------------------------------------------------ --
-- Deliberately workspace-SCOPED, not a global user directory: an admin
-- only ever sees "people who could be added to MY workspace", never a
-- cross-workspace account list — matches the product ask ("Không công
-- khai danh sách tài khoản toàn hệ thống cho thành viên thông thường")
-- and is itself gated to admins only, same as search_workspace_members.
create or replace function public.search_unassigned_users(
  p_workspace_id uuid,
  p_search text default '',
  p_limit int default 10,
  p_offset int default 0
)
returns table (
  user_id uuid,
  name text,
  email text,
  avatar_url text,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not public.is_workspace_admin(p_workspace_id, auth.uid()) then
    raise exception 'not authorized to view this workspace''s member directory';
  end if;

  return query
    select
      p.id,
      p.name,
      p.email,
      p.avatar_url,
      p.created_at,
      count(*) over() as total_count
    from public.profiles p
    where not exists (
        select 1 from public.memberships m
        where m.workspace_id = p_workspace_id and m.user_id = p.id
      )
      and (
        p_search = ''
        or p.name ilike '%' || p_search || '%'
        or p.email ilike '%' || p_search || '%'
      )
    order by p.created_at desc
    limit p_limit offset p_offset;
end;
$$;

grant execute on function public.search_unassigned_users(uuid, text, int, int) to authenticated;
