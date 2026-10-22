"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ok, err, type ActionResult } from "@/lib/action-result";
import {
  brandInputSchema,
  guidelineInputSchema,
  sizePresetInputSchema,
  templateInputSchema,
  type GuidelineInput,
} from "./schema";
import {
  buildBrandAssetPath,
  uploadBrandAsset,
  deleteBrandAsset,
  resolveSignedUrl,
  BRAND_LOGO_MAX_BYTES,
  BRAND_LOGO_ALLOWED_TYPES,
} from "./storage";
import type { Brand } from "@/types/brand";

const GENERIC_ERROR = "Đã có lỗi xảy ra. Vui lòng thử lại.";

/** Admin-only, re-enforced by RLS ("admin manages brands") independently
 * of anything the UI hides — a Creator calling this directly would simply
 * get rejected by the database, not just the button being absent. */
export async function createBrand(workspaceId: string, rawInput: unknown): Promise<ActionResult<Brand>> {
  const parsed = brandInputSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? GENERIC_ERROR);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Bạn cần đăng nhập");

  const { data, error } = await supabase
    .from("brands")
    .insert({
      workspace_id: workspaceId,
      name: parsed.data.name,
      description: parsed.data.description,
      created_by: user.id,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[createBrand]", error);
    return err("DB_ERROR", "Không thể tạo thương hiệu.");
  }

  revalidatePath("/brands");
  return ok({
    id: data.id,
    workspaceId: data.workspace_id,
    name: data.name,
    description: data.description,
    status: data.status,
    avatarUrl: null, // brand-new brand — no avatar uploaded yet
    currentGuidelineVersionId: data.current_guideline_version_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });
}

export async function updateBrand(brandId: string, rawInput: unknown): Promise<ActionResult<null>> {
  const parsed = brandInputSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? GENERIC_ERROR);

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("brands")
    .update({ name: parsed.data.name, description: parsed.data.description }, { count: "exact" })
    .eq("id", brandId);

  if (error) {
    console.error("[updateBrand]", error);
    return err("DB_ERROR", GENERIC_ERROR);
  }
  if (!count) return err("FORBIDDEN", "Bạn không có quyền chỉnh sửa thương hiệu này.");

  revalidatePath("/brands");
  revalidatePath(`/brands/${brandId}`);
  return ok(null);
}

export async function archiveBrand(brandId: string): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("brands")
    .update({ status: "archived" }, { count: "exact" })
    .eq("id", brandId);

  if (error) {
    console.error("[archiveBrand]", error);
    return err("DB_ERROR", GENERIC_ERROR);
  }
  if (!count) return err("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");

  revalidatePath("/brands");
  return ok(null);
}

export type LogoVariant = "primary" | "secondary" | "light" | "dark";

/** Uploads one logo variant, returns a short-lived signed URL for
 * immediate preview — the actual guideline row isn't written until
 * saveGuideline() below (this only stores the file and hands back its
 * path + a preview URL for the form to hold in local state). */
export async function uploadBrandLogo(
  workspaceId: string,
  brandId: string,
  variant: LogoVariant,
  file: File
): Promise<ActionResult<{ path: string; previewUrl: string | null }>> {
  if (!BRAND_LOGO_ALLOWED_TYPES.includes(file.type)) {
    return err("VALIDATION_ERROR", "Định dạng không hỗ trợ. Dùng SVG, PNG, JPG hoặc WEBP.");
  }
  if (file.size > BRAND_LOGO_MAX_BYTES) {
    return err("VALIDATION_ERROR", "File quá lớn. Tối đa 5MB.");
  }

  const supabase = await createClient();
  const path = buildBrandAssetPath(workspaceId, brandId, file.name || `logo-${variant}`);
  const { error } = await uploadBrandAsset(supabase, path, file);

  if (error) {
    console.error("[uploadBrandLogo]", error);
    return err("UPLOAD_ERROR", "Không thể tải lên. Bạn có quyền Admin trong workspace này không?");
  }

  const previewUrl = await resolveSignedUrl(supabase, path);
  return ok({ path, previewUrl });
}

/** Brand avatar — unlike guideline logos, this is a direct property of
 * the brand row, not part of a versioned guideline, so it's updated
 * immediately rather than staged until a "save guideline" step. */
export async function uploadBrandAvatar(
  workspaceId: string,
  brandId: string,
  file: File
): Promise<ActionResult<{ previewUrl: string | null }>> {
  if (!BRAND_LOGO_ALLOWED_TYPES.includes(file.type)) {
    return err("VALIDATION_ERROR", "Định dạng không hỗ trợ. Dùng SVG, PNG, JPG hoặc WEBP.");
  }
  if (file.size > BRAND_LOGO_MAX_BYTES) {
    return err("VALIDATION_ERROR", "File quá lớn. Tối đa 5MB.");
  }

  const supabase = await createClient();
  const previousPath = await getBrandAvatarPath(supabase, brandId);
  const path = buildBrandAssetPath(workspaceId, brandId, file.name || "avatar");
  const { error: uploadError } = await uploadBrandAsset(supabase, path, file);
  if (uploadError) {
    console.error("[uploadBrandAvatar] upload", uploadError);
    return err("UPLOAD_ERROR", "Không thể tải lên. Bạn có quyền Admin trong workspace này không?");
  }

  const { error: updateError, count } = await supabase
    .from("brands")
    .update({ avatar_url: path }, { count: "exact" })
    .eq("id", brandId);

  if (updateError || !count) {
    console.error("[uploadBrandAvatar] update", updateError);
    await deleteBrandAsset(supabase, path);
    return err("DB_ERROR", "Không thể cập nhật ảnh đại diện.");
  }

  if (previousPath) {
    await deleteBrandAsset(supabase, previousPath);
  }

  const previewUrl = await resolveSignedUrl(supabase, path);
  revalidatePath("/brands");
  revalidatePath(`/brands/${brandId}`);
  return ok({ previewUrl });
}

async function getBrandAvatarPath(
  supabase: Awaited<ReturnType<typeof createClient>>,
  brandId: string
): Promise<string | null> {
  const { data } = await supabase.from("brands").select("avatar_url").eq("id", brandId).maybeSingle();
  return data?.avatar_url ?? null;
}

/** Removes a just-uploaded-but-not-yet-saved file — used when the admin
 * replaces a logo before saving the guideline, so orphaned uploads don't
 * accumulate in Storage. */
export async function discardBrandAsset(path: string): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { error } = await deleteBrandAsset(supabase, path);
  if (error) {
    console.error("[discardBrandAsset]", error);
    return err("DB_ERROR", GENERIC_ERROR);
  }
  return ok(null);
}

export interface SaveGuidelineInput extends GuidelineInput {
  logoPrimaryPath: string | null;
  logoSecondaryPath: string | null;
  logoLightPath: string | null;
  logoDarkPath: string | null;
}

/** Writes a NEW guideline version (never edits one in place — PRD
 * principle #5) via create_guideline_version() (migration 0002), which
 * independently re-checks the caller is an active admin of the brand's
 * workspace. */
export async function saveGuideline(brandId: string, rawInput: SaveGuidelineInput): Promise<ActionResult<null>> {
  const parsed = guidelineInputSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? GENERIC_ERROR);

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_guideline_version", {
    p_brand_id: brandId,
    p_logo_primary_path: rawInput.logoPrimaryPath,
    p_logo_secondary_path: rawInput.logoSecondaryPath,
    p_logo_light_path: rawInput.logoLightPath,
    p_logo_dark_path: rawInput.logoDarkPath,
    p_colors: parsed.data.colors,
    p_fonts: parsed.data.fonts,
    p_safe_zone: parsed.data.safeZone,
    p_logo_rules: parsed.data.logoRules,
    p_layout_notes: parsed.data.layoutNotes,
  });

  if (error) {
    console.error("[saveGuideline]", error);
    if (error.message.includes("not authorized")) {
      return err("FORBIDDEN", "Bạn không có quyền chỉnh sửa guideline của thương hiệu này.");
    }
    return err("DB_ERROR", GENERIC_ERROR);
  }

  revalidatePath(`/brands/${brandId}`);
  return ok(null);
}

export async function createSizePreset(workspaceId: string, rawInput: unknown): Promise<ActionResult<null>> {
  const parsed = sizePresetInputSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? GENERIC_ERROR);

  const supabase = await createClient();
  const { error } = await supabase.from("size_presets").insert({
    workspace_id: workspaceId,
    name: parsed.data.name,
    channel: parsed.data.channel,
    width: parsed.data.width,
    height: parsed.data.height,
    export_format: parsed.data.exportFormat,
  });

  if (error) {
    console.error("[createSizePreset]", error);
    return err("DB_ERROR", "Không thể tạo preset.");
  }

  revalidatePath("/brands");
  return ok(null);
}

export async function deleteSizePreset(presetId: string): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { error, count } = await supabase.from("size_presets").delete({ count: "exact" }).eq("id", presetId);

  if (error) {
    console.error("[deleteSizePreset]", error);
    return err("DB_ERROR", GENERIC_ERROR);
  }
  if (!count) return err("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");

  revalidatePath("/brands");
  return ok(null);
}

export async function createTemplate(brandId: string, rawInput: unknown): Promise<ActionResult<null>> {
  const parsed = templateInputSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? GENERIC_ERROR);

  const supabase = await createClient();
  const { error } = await supabase.from("templates").insert({
    brand_id: brandId,
    name: parsed.data.name,
    size_preset_id: parsed.data.sizePresetId,
    layout: parsed.data.layout,
  });

  if (error) {
    console.error("[createTemplate]", error);
    return err("DB_ERROR", "Không thể tạo mẫu.");
  }

  revalidatePath(`/brands/${brandId}`);
  return ok(null);
}

export async function archiveTemplate(templateId: string): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("templates")
    .update({ status: "archived" }, { count: "exact" })
    .eq("id", templateId);

  if (error) {
    console.error("[archiveTemplate]", error);
    return err("DB_ERROR", GENERIC_ERROR);
  }
  if (!count) return err("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");

  revalidatePath("/brands");
  return ok(null);
}
