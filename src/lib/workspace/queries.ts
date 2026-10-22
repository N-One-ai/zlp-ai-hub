import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { CurrentUser, WorkspaceMembership, MemberWithProfile } from "@/types/workspace";

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

  return { id: data.id, name: data.name, email: data.email, avatarUrl: data.avatar_url };
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

  return (data ?? [])
    .filter((row): row is typeof row & { profiles: { name: string | null; email: string; avatar_url: string | null } } => row.profiles !== null)
    .map((row) => ({
      membershipId: row.id,
      userId: row.user_id,
      name: row.profiles.name,
      email: row.profiles.email,
      avatarUrl: row.profiles.avatar_url,
      role: row.role,
      status: row.status,
      createdAt: row.created_at,
    }));
}
