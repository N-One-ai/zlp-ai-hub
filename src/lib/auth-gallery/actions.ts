"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ok, err, type ActionResult } from "@/lib/action-result";
import {
  addAuthGalleryImageFromUploadSchema,
  addAuthGalleryImageFromAssetSchema,
  reorderAuthGalleryImagesSchema,
} from "./schema";
import {
  buildAuthGalleryPath,
  uploadAuthGalleryAsset,
  deleteAuthGalleryAsset,
  resolveAuthGalleryUrl,
  copyFromCreativeAssets,
  AUTH_GALLERY_MAX_BYTES,
  AUTH_GALLERY_ALLOWED_TYPES,
} from "./storage";

const GENERIC_ERROR = "Đã có lỗi xảy ra. Vui lòng thử lại.";
const FORBIDDEN_MESSAGE = "Bạn không có quyền quản lý gallery này.";

function revalidateAuthGallery() {
  revalidatePath("/auth-gallery");
  revalidatePath("/login");
  revalidatePath("/register");
}

/** See migration 0016_auth_gallery.sql: management of this GLOBAL,
 * cross-workspace resource is granted to anyone who is `admin` of at
 * least one active workspace (there's no dedicated platform-admin role
 * in this schema yet). Checked here on top of RLS so a non-admin gets a
 * clean FORBIDDEN instead of a raw Postgres error. */
async function assertPlatformAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<ActionResult<never> | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("FORBIDDEN", FORBIDDEN_MESSAGE);

  const { count, error } = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("role", "admin")
    .eq("status", "active");

  if (error) {
    console.error("[assertPlatformAdmin]", error);
    return err("UNKNOWN", GENERIC_ERROR);
  }
  if (!count) return err("FORBIDDEN", FORBIDDEN_MESSAGE);
  return null;
}

export async function uploadAuthGalleryImage(
  file: File
): Promise<ActionResult<{ path: string; previewUrl: string }>> {
  const supabase = await createClient();
  const forbidden = await assertPlatformAdmin(supabase);
  if (forbidden) return forbidden;

  if (!AUTH_GALLERY_ALLOWED_TYPES.includes(file.type)) {
    return err("VALIDATION_ERROR", "Định dạng không hỗ trợ. Dùng PNG, JPG hoặc WEBP.");
  }
  if (file.size > AUTH_GALLERY_MAX_BYTES) {
    return err("VALIDATION_ERROR", "File quá lớn. Tối đa 5MB.");
  }

  const path = buildAuthGalleryPath(file.name);
  const { error } = await uploadAuthGalleryAsset(supabase, path, file);
  if (error) {
    console.error("[uploadAuthGalleryImage]", error);
    return err("UPLOAD_FAILED", "Tải ảnh lên thất bại. Vui lòng thử lại.");
  }

  return ok({ path, previewUrl: resolveAuthGalleryUrl(supabase, path) });
}

/** Discards an uploaded-but-not-yet-saved file (admin picked a different
 * image before confirming) — mirrors discardDashboardBannerImage. */
export async function discardAuthGalleryImage(path: string): Promise<void> {
  const supabase = await createClient();
  const forbidden = await assertPlatformAdmin(supabase);
  if (forbidden) return;
  await deleteAuthGalleryAsset(supabase, path);
}

export async function addAuthGalleryImageFromUpload(
  rawInput: unknown
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const forbidden = await assertPlatformAdmin(supabase);
  if (forbidden) return forbidden;

  const parsed = addAuthGalleryImageFromUploadSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION_ERROR", GENERIC_ERROR);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { count } = await supabase.from("auth_gallery_images").select("id", { count: "exact", head: true });
  const { data, error } = await supabase
    .from("auth_gallery_images")
    .insert({
      image_path: parsed.data.imagePath,
      image_width: parsed.data.imageWidth,
      image_height: parsed.data.imageHeight,
      sort_order: count ?? 0,
      is_active: true,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[addAuthGalleryImageFromUpload]", error);
    return err("UNKNOWN", GENERIC_ERROR);
  }

  revalidateAuthGallery();
  return ok({ id: data.id });
}

/** "Chọn ảnh từ thư viện hiện có" — copies the asset's bytes from the
 * private creative-assets bucket into the public auth-gallery bucket
 * (see copyFromCreativeAssets) and inserts a new row for it. */
export async function addAuthGalleryImageFromAsset(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const forbidden = await assertPlatformAdmin(supabase);
  if (forbidden) return forbidden;

  const parsed = addAuthGalleryImageFromAssetSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION_ERROR", GENERIC_ERROR);

  const { data: asset, error: assetError } = await supabase
    .from("creative_assets")
    .select("storage_path, type")
    .eq("id", parsed.data.assetId)
    .maybeSingle();

  if (assetError || !asset || !asset.storage_path) {
    return err("NOT_FOUND", "Không tìm thấy ảnh trong thư viện.");
  }
  if (asset.type !== "image" && asset.type !== "banner") {
    return err("VALIDATION_ERROR", "Chỉ có thể chọn ảnh từ thư viện.");
  }

  const copyResult = await copyFromCreativeAssets(supabase, asset.storage_path);
  if ("error" in copyResult) {
    return err("UPLOAD_FAILED", copyResult.error || "Không sao chép được ảnh từ thư viện.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { count } = await supabase.from("auth_gallery_images").select("id", { count: "exact", head: true });
  const { data, error } = await supabase
    .from("auth_gallery_images")
    .insert({
      image_path: copyResult.path,
      image_width: null,
      image_height: null,
      sort_order: count ?? 0,
      is_active: true,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[addAuthGalleryImageFromAsset]", error);
    return err("UNKNOWN", GENERIC_ERROR);
  }

  revalidateAuthGallery();
  return ok({ id: data.id });
}

export async function toggleAuthGalleryImageActive(id: string, next: boolean): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const forbidden = await assertPlatformAdmin(supabase);
  if (forbidden) return forbidden;

  const { error, count } = await supabase
    .from("auth_gallery_images")
    .update({ is_active: next }, { count: "exact" })
    .eq("id", id);

  if (error) {
    console.error("[toggleAuthGalleryImageActive]", error);
    return err("UNKNOWN", GENERIC_ERROR);
  }
  if (!count) return err("FORBIDDEN", FORBIDDEN_MESSAGE);

  revalidateAuthGallery();
  return ok(null);
}

export async function reorderAuthGalleryImages(orderedIds: string[]): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const forbidden = await assertPlatformAdmin(supabase);
  if (forbidden) return forbidden;

  const parsed = reorderAuthGalleryImagesSchema.safeParse(orderedIds);
  if (!parsed.success) return err("VALIDATION_ERROR", GENERIC_ERROR);

  const results = await Promise.all(
    parsed.data.map((id, index) =>
      supabase.from("auth_gallery_images").update({ sort_order: index }, { count: "exact" }).eq("id", id)
    )
  );

  const failed = results.find((r) => r.error);
  if (failed) {
    console.error("[reorderAuthGalleryImages]", failed.error);
    return err("UNKNOWN", GENERIC_ERROR);
  }

  revalidateAuthGallery();
  return ok(null);
}

/** Deletes the row, then best-effort removes the Storage object — unlike
 * dashboard banners, no two rows ever share a path here (each upload/copy
 * mints a fresh uuid path), so there's no "is another row still using
 * this file" check needed before cleanup. Seeded rows (image_path starts
 * with "/") have no Storage object to remove — skipped, not an error. */
export async function deleteAuthGalleryImage(id: string, imagePath: string): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const forbidden = await assertPlatformAdmin(supabase);
  if (forbidden) return forbidden;

  const { error, count } = await supabase.from("auth_gallery_images").delete({ count: "exact" }).eq("id", id);
  if (error) {
    console.error("[deleteAuthGalleryImage]", error);
    return err("UNKNOWN", GENERIC_ERROR);
  }
  if (!count) return err("FORBIDDEN", FORBIDDEN_MESSAGE);

  if (!imagePath.startsWith("/")) {
    await deleteAuthGalleryAsset(supabase, imagePath);
  }

  revalidateAuthGallery();
  return ok(null);
}

export async function setAuthGalleryEnabled(next: boolean): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const forbidden = await assertPlatformAdmin(supabase);
  if (forbidden) return forbidden;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("auth_gallery_settings")
    .update({ is_enabled: next, updated_by: user?.id ?? null })
    .eq("id", 1);

  if (error) {
    console.error("[setAuthGalleryEnabled]", error);
    return err("UNKNOWN", GENERIC_ERROR);
  }

  revalidateAuthGallery();
  return ok(null);
}
