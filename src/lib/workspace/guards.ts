import { redirect, notFound } from "next/navigation";
import { getActiveWorkspace } from "./queries";
import type { WorkspaceMembership } from "@/types/workspace";

/**
 * The actual authorization boundary for admin-only pages (Thương hiệu,
 * Thành viên) — call this at the top of each, not just at the layout
 * level, since Server Actions are directly callable regardless of which
 * page rendered them. A non-admin member gets a 404, not a redirect —
 * they shouldn't be able to tell an admin-only page exists for a
 * workspace they're a non-admin member of.
 */
export async function requireWorkspaceAdmin(): Promise<WorkspaceMembership> {
  const workspace = await getActiveWorkspace();
  if (!workspace) redirect("/login");
  if (workspace.role !== "admin") notFound();
  return workspace;
}

/** The boundary every other authed page can use to get the resolved
 * active workspace, redirecting to /login if somehow missing (defense in
 * depth on top of the (app) layout's own check). */
export async function requireActiveWorkspace(): Promise<WorkspaceMembership> {
  const workspace = await getActiveWorkspace();
  if (!workspace) redirect("/login");
  return workspace;
}
