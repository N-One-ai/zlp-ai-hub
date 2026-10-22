"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { createBannerInputSchema, saveDesignDocumentSchema, exportDesignSchema } from "./schema";
import { getActiveWorkspace } from "@/lib/workspace/queries";
import { buildCreativeAssetPath, uploadGeneratedImage, extensionForContentType, resolveSignedAssetUrl } from "@/lib/generation/storage";
import { getTemplates } from "@/lib/brand/queries";
import { getBrandImageAssets } from "./queries";
import { trackEvent } from "@/lib/analytics/track";
import type { DesignLayer } from "@/types/database";

const GENERIC_ERROR = "Đã có lỗi xảy ra. Vui lòng thử lại.";
let layerSeq = 0;
function newLayerId(): string {
  layerSeq += 1;
  return `layer-${Date.now()}-${layerSeq}`;
}

/** Thin "use server" wrappers so the Step 1 setup form (a Client
 * Component, since the brand selection is interactive) can re-fetch
 * per-brand data without querying Supabase directly. */
export async function getBrandTemplatesAction(brandId: string) {
  return getTemplates(brandId);
}
export async function getBrandImageAssetsAction(brandId: string) {
  return getBrandImageAssets(brandId);
}

/**
 * Step 1 of the banner flow (PRD §7.3): creates the creative_assets row
 * (type 'banner', status 'draft') and its first design_documents version,
 * seeded from the chosen background image and — if given — a template's
 * logo/text placeholder positions, pulling the logo path and fonts from
 * the brand's CURRENT guideline. Returns the new asset id; the actual
 * editor lives at /create/banner/[assetId].
 */
export async function createBannerAsset(rawInput: unknown): Promise<ActionResult<{ assetId: string }>> {
  const parsed = createBannerInputSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const input = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Bạn cần đăng nhập");

  const workspace = await getActiveWorkspace();
  if (!workspace) return err("FORBIDDEN", "Không tìm thấy workspace.");

  const [{ data: preset }, { data: brand }] = await Promise.all([
    supabase.from("size_presets").select("width, height").eq("id", input.sizePresetId).maybeSingle(),
    supabase.from("brands").select("current_guideline_version_id").eq("id", input.brandId).maybeSingle(),
  ]);
  if (!preset) return err("VALIDATION_ERROR", "Preset kích thước không hợp lệ.");

  interface GuidelineSummary {
    fonts: { heading?: { family: string; fallback: string }; body?: { family: string; fallback: string } };
    logo_primary_path: string | null;
  }
  let guideline: GuidelineSummary | null = null;
  if (brand?.current_guideline_version_id) {
    const { data } = await supabase
      .from("brand_guideline_versions")
      .select("fonts, logo_primary_path")
      .eq("id", brand.current_guideline_version_id)
      .maybeSingle();
    if (data) guideline = data;
  }

  let backgroundPath: string | null = null;
  if (input.backgroundAssetId) {
    const { data: bg } = await supabase
      .from("creative_assets")
      .select("storage_path")
      .eq("id", input.backgroundAssetId)
      .maybeSingle();
    backgroundPath = bg?.storage_path ?? null;
  }

  let template: { layout: { logo?: { x: number; y: number; widthPx: number }; textFields?: { id: string; label: string; x: number; y: number; maxWidthPx: number }[] } } | null = null;
  if (input.templateId) {
    const { data } = await supabase.from("templates").select("layout").eq("id", input.templateId).maybeSingle();
    template = data;
  }

  const layers: DesignLayer[] = [];
  layers.push({
    id: newLayerId(),
    type: "background",
    x: 0,
    y: 0,
    width: preset.width,
    height: preset.height,
    rotation: 0,
    zIndex: 0,
    imagePath: backgroundPath ?? undefined,
  });

  if (guideline?.logo_primary_path) {
    const logoPos = template?.layout.logo ?? { x: 24, y: 24, widthPx: Math.round(preset.width * 0.15) };
    layers.push({
      id: newLayerId(),
      type: "logo",
      x: logoPos.x,
      y: logoPos.y,
      width: logoPos.widthPx,
      height: logoPos.widthPx,
      rotation: 0,
      zIndex: 10,
      imagePath: guideline.logo_primary_path,
      // Locked by default — PRD §8.4: "khóa logo nếu mẫu yêu cầu". The
      // layer panel still lets the user explicitly unlock it; this is a
      // guardrail against accidentally dragging the brand logo, not a
      // hard permanent restriction.
      locked: true,
    });
  }

  for (const field of template?.layout.textFields ?? []) {
    layers.push({
      id: newLayerId(),
      type: "text",
      x: field.x,
      y: field.y,
      width: field.maxWidthPx,
      height: 60,
      rotation: 0,
      zIndex: 20,
      text: field.label,
      fontFamily: guideline?.fonts.heading?.family ?? "Inter",
      fontFallback: guideline?.fonts.heading?.fallback ?? "sans-serif",
      fontSize: 32,
      fontWeight: 700,
      color: "#1c1917",
      align: "left",
      lineHeight: 1.2,
      letterSpacing: 0,
    });
  }

  const { data: asset, error: assetError } = await supabase
    .from("creative_assets")
    .insert({
      workspace_id: workspace.workspaceId,
      brand_id: input.brandId,
      owner_id: user.id,
      type: "banner",
      status: "draft",
      width: preset.width,
      height: preset.height,
      guideline_version_id: brand?.current_guideline_version_id ?? null,
    })
    .select("id")
    .single();

  if (assetError || !asset) {
    console.error("[createBannerAsset] asset", assetError);
    return err("DB_ERROR", "Không thể tạo banner.");
  }

  const { data: doc, error: docError } = await supabase
    .from("design_documents")
    .insert({
      asset_id: asset.id,
      version: 1,
      size_preset_id: input.sizePresetId,
      width: preset.width,
      height: preset.height,
      document: { layers },
      guideline_version_id: brand?.current_guideline_version_id ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (docError || !doc) {
    console.error("[createBannerAsset] document", docError);
    await supabase.from("creative_assets").delete().eq("id", asset.id);
    return err("DB_ERROR", "Không thể khởi tạo bản thiết kế.");
  }

  await supabase.from("creative_assets").update({ current_design_document_id: doc.id }).eq("id", asset.id);

  return ok({ assetId: asset.id });
}

/** Task 4.8 — "tạo bản sao/biến thể": copies the asset's CURRENT design
 * document into a brand new creative_assets row (status 'draft'), so
 * editing the duplicate never touches the original's version history. */
export async function duplicateBannerAsset(assetId: string): Promise<ActionResult<{ assetId: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Bạn cần đăng nhập");

  const { data: original } = await supabase
    .from("creative_assets")
    .select("workspace_id, brand_id, guideline_version_id, current_design_document_id")
    .eq("id", assetId)
    .maybeSingle();
  if (!original) return err("NOT_FOUND", "Không tìm thấy banner.");

  const { data: sourceDoc } = original.current_design_document_id
    ? await supabase.from("design_documents").select("*").eq("id", original.current_design_document_id).maybeSingle()
    : { data: null };
  if (!sourceDoc) return err("NOT_FOUND", "Không tìm thấy bản thiết kế nguồn.");

  const { data: newAsset, error: assetError } = await supabase
    .from("creative_assets")
    .insert({
      workspace_id: original.workspace_id,
      brand_id: original.brand_id,
      owner_id: user.id,
      type: "banner",
      status: "draft",
      width: sourceDoc.width,
      height: sourceDoc.height,
      guideline_version_id: original.guideline_version_id,
    })
    .select("id")
    .single();
  if (assetError || !newAsset) {
    console.error("[duplicateBannerAsset] asset", assetError);
    return err("DB_ERROR", "Không thể tạo bản sao.");
  }

  const { data: newDoc, error: docError } = await supabase
    .from("design_documents")
    .insert({
      asset_id: newAsset.id,
      version: 1,
      size_preset_id: sourceDoc.size_preset_id,
      width: sourceDoc.width,
      height: sourceDoc.height,
      document: sourceDoc.document,
      guideline_version_id: sourceDoc.guideline_version_id,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (docError || !newDoc) {
    console.error("[duplicateBannerAsset] document", docError);
    await supabase.from("creative_assets").delete().eq("id", newAsset.id);
    return err("DB_ERROR", "Không thể sao chép bản thiết kế.");
  }

  await supabase.from("creative_assets").update({ current_design_document_id: newDoc.id }).eq("id", newAsset.id);

  revalidatePath("/library");
  return ok({ assetId: newAsset.id });
}

/** Always a NEW version — never an in-place edit (PRD principle #5, same
 * pattern as guideline versions). RLS ("owner or admin saves design
 * documents") independently re-checks the caller owns this asset or
 * admins its workspace. */
export async function saveDesignDocument(rawInput: unknown): Promise<ActionResult<{ documentId: string; version: number }>> {
  const parsed = saveDesignDocumentSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION_ERROR", GENERIC_ERROR);
  const input = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Bạn cần đăng nhập");

  const { data: asset } = await supabase
    .from("creative_assets")
    .select("brand_id, guideline_version_id, current_design_document_id")
    .eq("id", input.assetId)
    .maybeSingle();
  if (!asset) return err("NOT_FOUND", "Không tìm thấy banner.");

  const { data: currentDoc } = asset.current_design_document_id
    ? await supabase.from("design_documents").select("version, size_preset_id, width, height").eq("id", asset.current_design_document_id).maybeSingle()
    : { data: null };

  const { data: brand } = await supabase
    .from("brands")
    .select("current_guideline_version_id")
    .eq("id", asset.brand_id)
    .maybeSingle();

  const { data: doc, error: docError } = await supabase
    .from("design_documents")
    .insert({
      asset_id: input.assetId,
      version: (currentDoc?.version ?? 0) + 1,
      size_preset_id: currentDoc?.size_preset_id ?? null,
      width: currentDoc?.width ?? 0,
      height: currentDoc?.height ?? 0,
      document: { layers: input.layers },
      guideline_version_id: brand?.current_guideline_version_id ?? null,
      created_by: user.id,
    })
    .select("id, version")
    .single();

  if (docError || !doc) {
    console.error("[saveDesignDocument]", docError);
    if (docError?.message.includes("row-level security")) {
      return err("FORBIDDEN", "Bạn không có quyền lưu banner này.");
    }
    return err("DB_ERROR", "Không thể lưu bản thiết kế.");
  }

  const { error: updateError, count } = await supabase
    .from("creative_assets")
    .update({ current_design_document_id: doc.id }, { count: "exact" })
    .eq("id", input.assetId);

  if (updateError || !count) {
    return err("FORBIDDEN", "Bạn không có quyền lưu banner này.");
  }

  revalidatePath(`/create/banner/${input.assetId}`);
  return ok({ documentId: doc.id, version: doc.version });
}

/**
 * The client renders the final banner to a PNG/JPG via Konva's own
 * Stage.toDataURL() at native resolution (no server-side canvas/image
 * library — same zero-new-dependency approach as the Demo Provider) and
 * sends the resulting bytes here. This Action only uploads + records it —
 * it never trusts the client's claimed width/height for anything besides
 * display metadata (RLS still gates who may write at all).
 */
export async function exportDesign(
  rawInput: { assetId: string; designDocumentId: string; format: "png" | "jpg"; width: number; height: number },
  bytes: Uint8Array
): Promise<ActionResult<{ exportId: string; url: string | null }>> {
  const parsed = exportDesignSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION_ERROR", GENERIC_ERROR);
  const input = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Bạn cần đăng nhập");

  const { data: asset } = await supabase
    .from("creative_assets")
    .select("workspace_id, brand_id, name")
    .eq("id", input.assetId)
    .maybeSingle();
  if (!asset) return err("NOT_FOUND", "Không tìm thấy banner.");

  const contentType = input.format === "png" ? "image/png" : "image/jpeg";
  const path = buildCreativeAssetPath(asset.workspace_id, asset.brand_id, extensionForContentType(contentType));
  const { error: uploadError } = await uploadGeneratedImage(supabase, path, Buffer.from(bytes), contentType);
  if (uploadError) {
    console.error("[exportDesign] upload", uploadError);
    return err("UPLOAD_ERROR", "Không thể lưu file xuất. Bạn có quyền chỉnh sửa banner này không?");
  }

  const { data: exportRow, error: exportError } = await supabase
    .from("exports")
    .insert({
      asset_id: input.assetId,
      design_document_id: input.designDocumentId,
      format: input.format,
      width: input.width,
      height: input.height,
      storage_path: path,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (exportError || !exportRow) {
    console.error("[exportDesign] insert", exportError);
    await supabase.storage.from("creative-assets").remove([path]);
    return err("DB_ERROR", "Không thể ghi nhận file xuất.");
  }

  const { error: updateError, count } = await supabase
    .from("creative_assets")
    .update(
      { storage_path: path, width: input.width, height: input.height, status: "ready" },
      { count: "exact" }
    )
    .eq("id", input.assetId);

  if (updateError || !count) {
    return err("FORBIDDEN", "Bạn không có quyền xuất banner này.");
  }

  const url = await resolveSignedAssetUrl(supabase, path);
  await trackEvent({ name: "export_succeeded", assetId: input.assetId, format: input.format }, { userId: user.id });

  revalidatePath(`/create/banner/${input.assetId}`);
  revalidatePath("/library");
  return ok({ exportId: exportRow.id, url });
}
