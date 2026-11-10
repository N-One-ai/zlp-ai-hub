import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { resolveAvatarUrl } from "@/lib/profile/storage";
import type { CurrentUser, WorkspaceMembership, MemberWithProfile, UnassignedUser, PaginatedResult } from "@/types/workspace";

export const MEMBERS_PAGE_SIZE = 10;
/** What a call to an RPC that doesn't exist yet (migration
 * 0009_members_directory.sql not applied in this environment) comes back
 * as. supabase-js routes RPC calls through PostgREST, which reports a
 * missing function as its own "PGRST202" (not Postgres' raw 42883
 * undefined_function, which PostgREST never surfaces to the client) —
 * confirmed by hitting this exact path against a database without the
 * migration applied. Distinguishes "the new DB function isn't there yet,
 * fall back" from "a real query error happened". */
const UNDEFINED_FUNCTION = "PGRST202";

export const ACTIVE_WORKSPACE_COOKIE = "active_workspace_id";

/** Plain reads for Server Components — not Server Actions (those are for mutations). */

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[getCurrentUser]", error);
    return null;
  }

  return { id: data.id, name: data.name, email: data.email, avatarUrl: await resolveAvatarUrl(supabase, data.avatar_url) };
}

/** Every active workspace the current user belongs to. */
export async function getMyWorkspaces(): Promise<WorkspaceMembership[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("memberships")
    .select("workspace_id, role, status, workspaces(name)")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (error) {
    console.error("[getMyWorkspaces]", error);
    return [];
  }

  return (data ?? [])
    .filter((row): row is typeof row & { workspaces: { name: string } } => row.workspaces !== null)
    .map((row) => ({
      workspaceId: row.workspace_id,
      workspaceName: row.workspaces.name,
      role: row.role,
      status: row.status,
    }));
}

/**
 * Resolves which workspace the current request should operate in: the
 * cookie-remembered choice if the user is still an active member of it,
 * otherwise their first active workspace. Returns null if the user has no
 * active workspace at all (shouldn't normally happen — signup bootstraps
 * one — but handled explicitly rather than assumed).
 */
export async function getActiveWorkspace(): Promise<WorkspaceMembership | null> {
  const workspaces = await getMyWorkspaces();
  if (workspaces.length === 0) return null;

  const cookieStore = await cookies();
  const preferredId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const preferred = workspaces.find((w) => w.workspaceId === preferredId);

  return preferred ?? workspaces[0];
}

/** Members of a workspace — only returns data if the caller is a member
 * themselves (RLS: "view own or admin-visible memberships" only returns
 * rows the caller is allowed to see; a non-admin only sees their own row,
 * so this naturally returns just one row for them). */
export async function getWorkspaceMembers(workspaceId: string): Promise<MemberWithProfile[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("memberships")
    .select("id, user_id, role, status, created_at, profiles(name, email, avatar_url)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[getWorkspaceMembers]", error);
    return [];
  }

  const rows = (data ?? []).filter(
    (row): row is typeof row & { profiles: { name: string | null; email: string; avatar_url: string | null } } =>
      row.profiles !== null
  );

  return Promise.all(
    rows.map(async (row) => ({
      membershipId: row.id,
      userId: row.user_id,
      name: row.profiles.name,
      email: row.profiles.email,
      avatarUrl: await resolveAvatarUrl(supabase, row.profiles.avatar_url),
      role: row.role,
      status: row.status,
      createdAt: row.created_at,
    }))
  );
}

/**
 * Paginated, searchable member list for the Members page — calls the
 * search_workspace_members RPC (migration 0009, backend-level
 * ILIKE + LIMIT/OFFSET + window-function count, re-checks
 * is_workspace_admin() itself). Falls back to the plain, pre-existing
 * getWorkspaceMembers() + in-process search/slice ONLY when that RPC
 * doesn't exist yet (migration not applied) — `backendPaginated: false`
 * tells the caller this happened, so the UI can disclose it rather than
 * silently claim real backend pagination that didn't actually run.
 * Still only ever ships ONE PAGE to the browser either way.
 */
export async function searchWorkspaceMembers(
  workspaceId: string,
  options: { search?: string; page?: number; pageSize?: number } = {}
): Promise<PaginatedResult<MemberWithProfile>> {
  const supabase = await createClient();
  const page = Math.max(1, options.page ?? 1);
  const pageSize = options.pageSize ?? MEMBERS_PAGE_SIZE;
  const search = (options.search ?? "").trim();

  const { data, error } = await supabase.rpc("search_workspace_members", {
    p_workspace_id: workspaceId,
    p_search: search,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });

  if (!error) {
    const rows = data ?? [];
    const total = rows[0]?.total_count ?? 0;
    const items = await Promise.all(
      rows.map(async (row) => ({
        membershipId: row.membership_id,
        userId: row.user_id,
        name: row.name,
        email: row.email,
        avatarUrl: await resolveAvatarUrl(supabase, row.avatar_url),
        role: row.role,
        status: row.status,
        createdAt: row.created_at,
      }))
    );
    return { items, total, page, pageSize, backendPaginated: true };
  }

  if (error.code !== UNDEFINED_FUNCTION) {
    console.error("[searchWorkspaceMembers]", error);
    return { items: [], total: 0, page, pageSize, backendPaginated: false };
  }

  // Fallback: migration 0009 not applied yet. Reuse the already-working
  // getWorkspaceMembers() (full RLS-scoped fetch), then search + paginate
  // server-side before returning — the browser still only ever receives
  // one page's worth of rows.
  const all = await getWorkspaceMembers(workspaceId);
  const q = search.toLowerCase();
  const filtered = q ? all.filter((m) => (m.name ?? "").toLowerCase().includes(q) || m.email.toLowerCase().includes(q)) : all;
  const start = (page - 1) * pageSize;
  return { items: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize, backendPaginated: false };
}

/**
 * Signed-up accounts with no membership row in this workspace yet —
 * "mới đăng ký, chưa thuộc workspace". Entirely dependent on the
 * search_unassigned_users RPC (migration 0009): there is no pre-existing
 * query to fall back to (profiles RLS never allowed browsing accounts
 * outside the caller's own workspaces — see migration 0001), so when the
 * RPC is missing this returns an empty, `backendPaginated: false` result
 * and the UI discloses that the feature needs the migration, rather than
 * claiming "no newly-registered users" when the truth is "can't check yet".
 */
export async function searchUnassignedUsers(
  workspaceId: string,
  options: { search?: string; page?: number; pageSize?: number } = {}
): Promise<PaginatedResult<UnassignedUser>> {
  const supabase = await createClient();
  const page = Math.max(1, options.page ?? 1);
  const pageSize = options.pageSize ?? MEMBERS_PAGE_SIZE;
  const search = (options.search ?? "").trim();

  const { data, error } = await supabase.rpc("search_unassigned_users", {
    p_workspace_id: workspaceId,
    p_search: search,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });

  if (error) {
    if (error.code !== UNDEFINED_FUNCTION) console.error("[searchUnassignedUsers]", error);
    return { items: [], total: 0, page, pageSize, backendPaginated: false };
  }

  const rows = data ?? [];
  const total = rows[0]?.total_count ?? 0;
  const items = await Promise.all(
    rows.map(async (row) => ({
      userId: row.user_id,
      name: row.name,
      email: row.email,
      avatarUrl: await resolveAvatarUrl(supabase, row.avatar_url),
      createdAt: row.created_at,
    }))
  );
  return { items, total, page, pageSize, backendPaginated: true };
}
