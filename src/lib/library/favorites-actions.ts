"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ok, err, type ActionResult } from "@/lib/action-result";

const GENERIC_ERROR = "Đã có lỗi xảy ra. Vui lòng thử lại.";

/** Toggles the current user's own favorite bookmark on an asset (see
 * migration 0017_asset_favorites.sql) — a personal flag, not a
 * workspace-wide one, so no admin/ownership check beyond "is logged
 * in" is needed: RLS already restricts every read/write here to the
 * caller's own user_id regardless of what this function passes. */
export async function toggleAssetFavorite(assetId: string, next: boolean): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("FORBIDDEN", "Bạn cần đăng nhập để dùng chức năng yêu thích.");

  if (next) {
    const { error } = await supabase
      .from("asset_favorites")
      .upsert({ user_id: user.id, asset_id: assetId }, { onConflict: "user_id,asset_id" });
    if (error) {
      console.error("[toggleAssetFavorite:add]", error);
      return err("UNKNOWN", GENERIC_ERROR);
    }
  } else {
    const { error } = await supabase.from("asset_favorites").delete().eq("user_id", user.id).eq("asset_id", assetId);
    if (error) {
      console.error("[toggleAssetFavorite:remove]", error);
      return err("UNKNOWN", GENERIC_ERROR);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/library");
  return ok(null);
}
