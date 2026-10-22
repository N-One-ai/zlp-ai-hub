"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { ACTIVE_WORKSPACE_COOKIE, getMyWorkspaces } from "./queries";
import type { MembershipRole } from "@/types/database";

const GENERIC_ERROR = "Đã có lỗi xảy ra. Vui lòng thử lại.";

/** Switches the remembered active workspace — only to one the user is
 * actually an active member of (re-checked here, never trusts the client
 * to only ever send a valid id). */
export async function setActiveWorkspace(workspaceId: string): Promise<ActionResult<null>> {
  const workspaces = await getMyWorkspaces();
  if (!workspaces.some((w) => w.workspaceId === workspaceId)) {
    return err("FORBIDDEN", "Bạn không có quyền truy cập workspace này.");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
  return ok(null);
}

/** Invites an existing account (by email) into a workspace. The database
 * function (invite_member, migration 0001) independently re-verifies the
 * caller is an active admin of that workspace — this Server Action is not
 * the authorization boundary, it only forwards the call and translates
 * the error. */
export async function inviteMember(
  workspaceId: string,
  email: string,
  role: MembershipRole
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("invite_member", {
    p_workspace_id: workspaceId,
    p_email: email.trim().toLowerCase(),
    p_role: role,
  });

  if (error) {
    console.error("[inviteMember]", error);
    if (error.message.includes("no account found")) {
      return err("NOT_FOUND", "Không tìm thấy tài khoản với email này — họ cần đăng ký trước.");
    }
    if (error.message.includes("not authorized")) {
      return err("FORBIDDEN", "Bạn không có quyền mời thành viên vào workspace này.");
    }
    return err("DB_ERROR", GENERIC_ERROR);
  }

  revalidatePath("/members");
  return ok(null);
}

/** Changes a member's role. RLS ("admin can update memberships") is the
 * actual enforcement — this just surfaces a clean error if it's denied. */
export async function updateMemberRole(membershipId: string, role: MembershipRole): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("memberships")
    .update({ role }, { count: "exact" })
    .eq("id", membershipId);

  if (error) {
    console.error("[updateMemberRole]", error);
    return err("DB_ERROR", GENERIC_ERROR);
  }
  if (!count) return err("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");

  revalidatePath("/members");
  return ok(null);
}

/** Revokes access — an UPDATE (status -> 'revoked'), never a DELETE, so
 * there's always a visible record of who was once a member. */
export async function revokeMember(membershipId: string): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("memberships")
    .update({ status: "revoked" }, { count: "exact" })
    .eq("id", membershipId);

  if (error) {
    console.error("[revokeMember]", error);
    return err("DB_ERROR", GENERIC_ERROR);
  }
  if (!count) return err("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");

  revalidatePath("/members");
  return ok(null);
}
