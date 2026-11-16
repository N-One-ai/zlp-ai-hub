"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ok, err, type ActionResult } from "@/lib/action-result";
import {
  dashboardBannerInputSchema,
  dashboardFeatureCardInputSchema,
  dashboardFeatureCardSlotSchema,
  reorderDashboardBannersSchema,
  type DashboardBannerInput,
  type DashboardFeatureCardInput,
} from "./schema";
import {
  buildDashboardBannerPath,
  buildDashboardFeatureCardPath,
  uploadDashboardBannerAsset,
  deleteDashboardBannerAsset,
  resolveDashboardBannerUrl,
  DASHBOARD_BANNER_MAX_BYTES,
  DASHBOARD_BANNER_ALLOWED_TYPES,
} from "./storage";
import { DASHBOARD_FEATURE_CARD_DEFAULTS } from "./feature-card-defaults";

const GENERIC_ERROR = "Đã có lỗi xảy ra. Vui lòng thử lại.";

function revalidateDashboard() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard-banners");
}

function toBannerContentRow(parsed: DashboardBannerInput) {
  return {
    title: parsed.title,
    description: parsed.description,
    cta_label: parsed.ctaLabel,
    cta_url: parsed.ctaUrl,
    image_path: parsed.imagePath,
    image_width: parsed.imageWidth,
    image_height: parsed.imageHeight,
    focal_x: parsed.focalX,
    focal_y: parsed.focalY,
    mobile_image_path: parsed.mobileImagePath,
    mobile_image_width: parsed.mobileImageWidth,
    mobile_image_height: parsed.mobileImageHeight,
    mobile_focal_x: parsed.mobileFocalX,
    mobile_focal_y: parsed.mobileFocalY,
    is_active: parsed.isActive,
  };
}

/** Deletes a Storage object only if no OTHER banner row (e.g. a duplicate
 * created by duplicateDashboardBanner below) still references it as either
 * its desktop or mobile image — reusing a Storage file across banners
 * (instead of re-uploading a copy) means cleanup must check for sharing
 * first, or deleting one banner would break its sibling's image. */
async function deleteImageIfOrphaned(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string | null,
  excludeBannerId: string | null
) {
  if (!path) return;
  let query = supabase
    .from("dashboard_banners")
    .select("id", { count: "exact", head: true })
    .or(`image_path.eq.${path},mobile_image_path.eq.${path}`);
  if (excludeBannerId) query = query.neq("id", excludeBannerId);
  const { count } = await query;
  if (!count) {
    await deleteDashboardBannerAsset(supabase, path);
  }
}

/** Uploads one banner image, returns a short-lived signed URL for
 * immediate preview — the row isn't written until createDashboardBanner/
 * updateDashboardBanner below, same two-step pattern as uploadBrandLogo. */
export async function uploadDashboardBannerImage(
  workspaceId: string,
  file: File
): Promise<ActionResult<{ path: string; previewUrl: string | null }>> {
  if (!DASHBOARD_BANNER_ALLOWED_TYPES.includes(file.type)) {
    return err("VALIDATION_ERROR", "Định dạng không hỗ trợ. Dùng PNG, JPG hoặc WEBP.");
  }
  if (file.size > DASHBOARD_BANNER_MAX_BYTES) {
    return err("VALIDATION_ERROR", "File quá lớn. Tối đa 5MB.");
  }

  const supabase = await createClient();
  const path = buildDashboardBannerPath(workspaceId, file.name || "banner");
  const { error } = await uploadDashboardBannerAsset(supabase, path, file);

  if (error) {
    console.error("[uploadDashboardBannerImage]", error);
    return err("UPLOAD_ERROR", "Không thể tải lên. Bạn có quyền Admin trong workspace này không?");
  }

  const previewUrl = await resolveDashboardBannerUrl(supabase, path);
  return ok({ path, previewUrl });
}

/** Removes a just-uploaded-but-not-yet-saved file — mirrors
 * discardBrandAsset, used when the admin replaces an image before saving. */
export async function discardDashboardBannerImage(path: string): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { error } = await deleteDashboardBannerAsset(supabase, path);
  if (error) {
    console.error("[discardDashboardBannerImage]", error);
    return err("DB_ERROR", GENERIC_ERROR);
  }
  return ok(null);
}

/** Admin-only, re-enforced by RLS ("admin manages dashboard banners")
 * independently of anything the UI hides, same convention as createBrand.
 * Returns the new id so the form can reposition it if the admin picked a
 * display position other than "cuối danh sách" (the default append). */
export async function createDashboardBanner(
  workspaceId: string,
  rawInput: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = dashboardBannerInputSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? GENERIC_ERROR);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Bạn cần đăng nhập");

  const { count: existingCount } = await supabase
    .from("dashboard_banners")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  const { data, error } = await supabase
    .from("dashboard_banners")
    .insert({
      workspace_id: workspaceId,
      ...toBannerContentRow(parsed.data),
      sort_order: existingCount ?? 0,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[createDashboardBanner]", error);
    return err("DB_ERROR", "Không thể tạo banner.");
  }

  revalidateDashboard();
  return ok({ id: data.id });
}

/** `previousImagePath`/`previousMobileImagePath` are only passed (and only
 * deleted-if-unreferenced) when the admin replaced that image in this edit
 * — an unchanged image is never touched. */
export async function updateDashboardBanner(
  bannerId: string,
  rawInput: unknown,
  previousImagePath?: string | null,
  previousMobileImagePath?: string | null
): Promise<ActionResult<null>> {
  const parsed = dashboardBannerInputSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? GENERIC_ERROR);

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("dashboard_banners")
    .update(toBannerContentRow(parsed.data), { count: "exact" })
    .eq("id", bannerId);

  if (error) {
    console.error("[updateDashboardBanner]", error);
    return err("DB_ERROR", GENERIC_ERROR);
  }
  if (!count) return err("FORBIDDEN", "Bạn không có quyền chỉnh sửa banner này.");

  if (previousImagePath && previousImagePath !== parsed.data.imagePath) {
    await deleteImageIfOrphaned(supabase, previousImagePath, bannerId);
  }
  if (previousMobileImagePath && previousMobileImagePath !== parsed.data.mobileImagePath) {
    await deleteImageIfOrphaned(supabase, previousMobileImagePath, bannerId);
  }

  revalidateDashboard();
  return ok(null);
}

/** Copies a banner's full content — including its focal points and
 * desktop/mobile images — into a new row appended at the end of the list.
 * Reuses the SAME Storage paths rather than re-uploading copies (never
 * duplicating files); deleteDashboardBanner/updateDashboardBanner check
 * for sharing before removing a Storage object, so deleting the original
 * later never breaks the duplicate (or vice versa). */
export async function duplicateDashboardBanner(bannerId: string): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Bạn cần đăng nhập");

  const { data: source, error: fetchError } = await supabase
    .from("dashboard_banners")
    .select("*")
    .eq("id", bannerId)
    .maybeSingle();
  if (fetchError || !source) {
    console.error("[duplicateDashboardBanner] fetch", fetchError);
    return err("NOT_FOUND", "Không tìm thấy banner.");
  }

  const { count: existingCount } = await supabase
    .from("dashboard_banners")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", source.workspace_id);

  const { data, error } = await supabase
    .from("dashboard_banners")
    .insert({
      workspace_id: source.workspace_id,
      title: `${source.title} (bản sao)`,
      description: source.description,
      cta_label: source.cta_label,
      cta_url: source.cta_url,
      image_path: source.image_path,
      image_width: source.image_width,
      image_height: source.image_height,
      focal_x: source.focal_x,
      focal_y: source.focal_y,
      mobile_image_path: source.mobile_image_path,
      mobile_image_width: source.mobile_image_width,
      mobile_image_height: source.mobile_image_height,
      mobile_focal_x: source.mobile_focal_x,
      mobile_focal_y: source.mobile_focal_y,
      is_active: false, // never silently double the active banners shown on Dashboard
      sort_order: existingCount ?? 0,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[duplicateDashboardBanner] insert", error);
    return err("DB_ERROR", "Không thể nhân bản banner.");
  }

  revalidateDashboard();
  return ok({ id: data.id });
}

export async function toggleDashboardBannerActive(bannerId: string, isActive: boolean): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("dashboard_banners")
    .update({ is_active: isActive }, { count: "exact" })
    .eq("id", bannerId);

  if (error) {
    console.error("[toggleDashboardBannerActive]", error);
    return err("DB_ERROR", GENERIC_ERROR);
  }
  if (!count) return err("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");

  revalidateDashboard();
  return ok(null);
}

export async function deleteDashboardBanner(
  bannerId: string,
  imagePath: string | null,
  mobileImagePath: string | null
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { error, count } = await supabase.from("dashboard_banners").delete({ count: "exact" }).eq("id", bannerId);

  if (error) {
    console.error("[deleteDashboardBanner]", error);
    return err("DB_ERROR", GENERIC_ERROR);
  }
  if (!count) return err("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");

  await deleteImageIfOrphaned(supabase, imagePath, null);
  if (mobileImagePath && mobileImagePath !== imagePath) {
    await deleteImageIfOrphaned(supabase, mobileImagePath, null);
  }

  revalidateDashboard();
  return ok(null);
}

/** Reassigns sort_order to match the given order — `orderedIds` must be
 * every banner id for the caller's own workspace, in the desired display
 * order (the manager UI always passes its full current list). A banner
 * RLS rejects (not the caller's workspace) surfaces as FORBIDDEN; some
 * earlier updates in the batch may already have applied, which is safe
 * since reordering is idempotent and the UI simply re-fetches on refresh. */
export async function reorderDashboardBanners(orderedIds: string[]): Promise<ActionResult<null>> {
  const parsed = reorderDashboardBannersSchema.safeParse(orderedIds);
  if (!parsed.success) return err("VALIDATION_ERROR", GENERIC_ERROR);

  const supabase = await createClient();
  const results = await Promise.all(
    parsed.data.map((id, index) =>
      supabase.from("dashboard_banners").update({ sort_order: index }, { count: "exact" }).eq("id", id)
    )
  );

  const failed = results.find((r) => r.error);
  if (failed) {
    console.error("[reorderDashboardBanners]", failed.error);
    return err("DB_ERROR", GENERIC_ERROR);
  }
  if (results.some((r) => !r.count)) return err("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");

  revalidateDashboard();
  return ok(null);
}

// ------------------------------------------------------------------ //
// Dashboard feature cards ("Tạo ảnh" / "Tạo banner")                    //
// ------------------------------------------------------------------ //

function toFeatureCardContentRow(parsed: DashboardFeatureCardInput) {
  return {
    title: parsed.title,
    description: parsed.description,
    cta_label: parsed.ctaLabel,
    cta_url: parsed.ctaUrl,
    image_path: parsed.imagePath,
    image_width: parsed.imageWidth,
    image_height: parsed.imageHeight,
    focal_x: parsed.focalX,
    focal_y: parsed.focalY,
    background_style: parsed.backgroundStyle,
    is_active: parsed.isActive,
  };
}

/** Reuses the SAME upload path/bucket machinery as the big banner — only
 * the subfolder differs (buildDashboardFeatureCardPath) — and the SAME
 * two-step "upload now, write the row on save" flow
 * (discardDashboardBannerImage below already works for this slot's
 * not-yet-saved upload too, since it just deletes by path). */
export async function uploadDashboardFeatureCardImage(
  workspaceId: string,
  file: File
): Promise<ActionResult<{ path: string; previewUrl: string | null }>> {
  if (!DASHBOARD_BANNER_ALLOWED_TYPES.includes(file.type)) {
    return err("VALIDATION_ERROR", "Định dạng không hỗ trợ. Dùng PNG, JPG hoặc WEBP.");
  }
  if (file.size > DASHBOARD_BANNER_MAX_BYTES) {
    return err("VALIDATION_ERROR", "File quá lớn. Tối đa 5MB.");
  }

  const supabase = await createClient();
  const path = buildDashboardFeatureCardPath(workspaceId, file.name || "feature-card");
  const { error } = await uploadDashboardBannerAsset(supabase, path, file);

  if (error) {
    console.error("[uploadDashboardFeatureCardImage]", error);
    return err("UPLOAD_ERROR", "Không thể tải lên. Bạn có quyền Admin trong workspace này không?");
  }

  const previewUrl = await resolveDashboardBannerUrl(supabase, path);
  return ok({ path, previewUrl });
}

/** Admin-only (RLS), upserts the one row for this (workspace, slot) —
 * there is never more than one, so this is both "create the first
 * customization" and "edit it" depending on whether a row already
 * exists. `previousImagePath` is only deleted when the admin actually
 * replaced or removed the image in this edit; a feature-card image is
 * never shared between rows (no "duplicate" action for these cards), so
 * no orphan-check is needed before deleting it, unlike the big banner. */
export async function updateDashboardFeatureCard(
  workspaceId: string,
  rawInput: unknown,
  previousImagePath?: string | null
): Promise<ActionResult<null>> {
  const parsed = dashboardFeatureCardInputSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? GENERIC_ERROR);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Bạn cần đăng nhập");

  const { error } = await supabase.from("dashboard_feature_cards").upsert(
    {
      workspace_id: workspaceId,
      slot: parsed.data.slot,
      ...toFeatureCardContentRow(parsed.data),
      created_by: user.id,
    },
    { onConflict: "workspace_id,slot" }
  );

  if (error) {
    console.error("[updateDashboardFeatureCard]", error);
    return err("DB_ERROR", "Không thể lưu thẻ chức năng. Bạn có quyền Admin trong workspace này không?");
  }

  if (previousImagePath && previousImagePath !== parsed.data.imagePath) {
    await deleteDashboardBannerAsset(supabase, previousImagePath);
  }

  revalidateDashboard();
  return ok(null);
}

/** Flips just `is_active`, preserving whatever content the slot already
 * has — if it's never been customized yet, that means writing a row for
 * the FIRST time using the built-in defaults (so an admin can hide a
 * still-default card without being forced through the edit form first). */
export async function toggleDashboardFeatureCardActive(
  workspaceId: string,
  rawSlot: unknown,
  isActive: boolean
): Promise<ActionResult<null>> {
  const parsedSlot = dashboardFeatureCardSlotSchema.safeParse(rawSlot);
  if (!parsedSlot.success) return err("VALIDATION_ERROR", GENERIC_ERROR);
  const slot = parsedSlot.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Bạn cần đăng nhập");

  const { data: existing } = await supabase
    .from("dashboard_feature_cards")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("slot", slot)
    .maybeSingle();

  const defaults = DASHBOARD_FEATURE_CARD_DEFAULTS[slot];
  const { error } = await supabase.from("dashboard_feature_cards").upsert(
    {
      workspace_id: workspaceId,
      slot,
      title: existing?.title ?? defaults.title,
      description: existing?.description ?? defaults.description,
      cta_label: existing?.cta_label ?? defaults.ctaLabel,
      cta_url: existing?.cta_url ?? defaults.ctaUrl,
      image_path: existing?.image_path ?? null,
      image_width: existing?.image_width ?? null,
      image_height: existing?.image_height ?? null,
      focal_x: existing?.focal_x ?? 50,
      focal_y: existing?.focal_y ?? 50,
      background_style: existing?.background_style ?? defaults.backgroundStyle,
      is_active: isActive,
      created_by: existing?.created_by ?? user.id,
    },
    { onConflict: "workspace_id,slot" }
  );

  if (error) {
    console.error("[toggleDashboardFeatureCardActive]", error);
    return err("DB_ERROR", "Bạn có quyền Admin trong workspace này không?");
  }

  revalidateDashboard();
  return ok(null);
}

/** "Khôi phục nội dung mặc định" — deletes the customization row
 * entirely (and its image, if any) so the slot goes back to the exact
 * built-in default, including re-activating it. */
export async function resetDashboardFeatureCard(workspaceId: string, rawSlot: unknown): Promise<ActionResult<null>> {
  const parsedSlot = dashboardFeatureCardSlotSchema.safeParse(rawSlot);
  if (!parsedSlot.success) return err("VALIDATION_ERROR", GENERIC_ERROR);
  const slot = parsedSlot.data;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("dashboard_feature_cards")
    .select("image_path")
    .eq("workspace_id", workspaceId)
    .eq("slot", slot)
    .maybeSingle();

  const { error } = await supabase
    .from("dashboard_feature_cards")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("slot", slot);

  if (error) {
    console.error("[resetDashboardFeatureCard]", error);
    return err("DB_ERROR", "Bạn có quyền Admin trong workspace này không?");
  }

  if (existing?.image_path) {
    await deleteDashboardBannerAsset(supabase, existing.image_path);
  }

  revalidateDashboard();
  return ok(null);
}
