"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { trackEvent } from "@/lib/analytics/track";

const GENERIC_ERROR = "Đã có lỗi xảy ra. Vui lòng thử lại.";

/** RLS ("owner or admin deletes creative assets", migration 0004)
 * independently re-checks the caller owns the asset or admins its
 * workspace — this Server Action is not the authorization boundary, only
 * the entry point; a crafted request calling this directly for someone
 * else's asset is rejected at the database. */
export async function deleteAsset(assetId: string): Promise<ActionResult<null>> {
  const supabase = await createClient();

  // Read the storage path first (under the caller's own RLS-scoped read)
  // so the file can be cleaned up alongside the row — otherwise a deleted
  // asset would leave an orphaned file behind in Storage forever.
  const { data: asset } = await supabase.from("creative_assets").select("storage_path, type").eq("id", assetId).maybeSingle();

  const { error, count } = await supabase.from("creative_assets").delete({ count: "exact" }).eq("id", assetId);

  if (error) {
    console.error("[deleteAsset]", error);
    return err("DB_ERROR", GENERIC_ERROR);
  }
  if (!count) return err("FORBIDDEN", "Bạn không có quyền xoá tài sản này.");

  if (asset?.storage_path) {
    await supabase.storage.from("creative-assets").remove([asset.storage_path]);
  }

  await trackEvent({ name: "asset_deleted", assetId, assetType: asset?.type ?? "image" });

  revalidatePath("/library");
  return ok(null);
}
