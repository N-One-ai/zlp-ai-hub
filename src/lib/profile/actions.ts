"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { buildAvatarPath, resolveAvatarUrl, uploadAvatarFile, deleteAvatarFile, AVATAR_MAX_BYTES, AVATAR_ALLOWED_TYPES } from "./storage";

const GENERIC_ERROR = "Đã có lỗi xảy ra. Vui lòng thử lại.";

/** Replaces the current user's avatar: uploads the new file first, only
 * then updates profiles.avatar_url, and only THEN deletes the old
 * Storage object — in that order, so a failure partway through never
 * leaves the profile pointing at a file that no longer exists. Every
 * page that shows an avatar (Settings, sidebar/header UserMenu,
 * members-table) reads it fresh from profiles.avatar_url on next render;
 * this action revalidates every route that does. */
export async function uploadAvatar(rawFile: unknown): Promise<ActionResult<{ avatarUrl: string }>> {
  if (!(rawFile instanceof File)) return err("VALIDATION_ERROR", "File không hợp lệ.");
  const file = rawFile;

  if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
    return err("VALIDATION_ERROR", "Định dạng không hỗ trợ. Dùng JPG, PNG hoặc WEBP.");
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return err("VALIDATION_ERROR", "File quá lớn. Tối đa 5MB.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Bạn cần đăng nhập");

  const { data: profile } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle();
  const previousPath = profile?.avatar_url ?? null;

  const path = buildAvatarPath(user.id, file.name);
  const { error: uploadError } = await uploadAvatarFile(supabase, path, file);
  if (uploadError) {
    console.error("[uploadAvatar] upload", uploadError);
    return err("UPLOAD_ERROR", "Không thể tải ảnh lên. Thử lại sau.");
  }

  const { error: updateError } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
  if (updateError) {
    console.error("[uploadAvatar] update", updateError);
    await deleteAvatarFile(supabase, path); // roll back the just-uploaded file — the DB never pointed at it
    return err("DB_ERROR", "Không thể lưu ảnh đại diện.");
  }

  // Best-effort cleanup — the profile already points at the NEW file at
  // this point, so a failure here just leaves one orphaned old object
  // instead of breaking anything the user can see.
  if (previousPath) {
    const { error: deleteError } = await deleteAvatarFile(supabase, previousPath);
    if (deleteError) console.error("[uploadAvatar] cleanup old avatar", deleteError);
  }

  const avatarUrl = await resolveAvatarUrl(supabase, path);
  if (!avatarUrl) return err("STORAGE_ERROR", "Đã lưu ảnh nhưng không tạo được URL hiển thị.");

  revalidatePath("/settings");
  revalidatePath("/members");
  revalidatePath("/", "layout");
  return ok({ avatarUrl });
}

/** Clears the user's avatar back to the initial-letter fallback — same
 * ordering safety as uploadAvatar (DB update before the file is deleted). */
export async function removeAvatar(): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Bạn cần đăng nhập");

  const { data: profile } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle();
  const previousPath = profile?.avatar_url ?? null;
  if (!previousPath) return ok(null); // nothing to remove

  const { error: updateError } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
  if (updateError) {
    console.error("[removeAvatar] update", updateError);
    return err("DB_ERROR", GENERIC_ERROR);
  }

  const { error: deleteError } = await deleteAvatarFile(supabase, previousPath);
  if (deleteError) console.error("[removeAvatar] delete", deleteError);

  revalidatePath("/settings");
  revalidatePath("/members");
  revalidatePath("/", "layout");
  return ok(null);
}
