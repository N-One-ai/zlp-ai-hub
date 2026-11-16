"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ok, err, type ActionResult } from "@/lib/action-result";
import {
  createBannerInputSchema,
  changeBannerBrandSchema,
  saveDesignDocumentSchema,
  createBannerSizeVariantSchema,
  exportDesignSchema,
} from "./schema";
import { getActiveWorkspace } from "@/lib/workspace/queries";
import {
  buildCreativeAssetPath,
  uploadGeneratedImage,
  extensionForContentType,
  resolveSignedAssetUrl,
} from "@/lib/generation/storage";
import { downloadBrandAsset } from "@/lib/brand/storage";
import { readImageDimensions } from "@/lib/generation/image-dimensions";
import { getTemplates, getBrand, getCurrentGuideline } from "@/lib/brand/queries";
import { getBrandImageAssets, getBrandElementAssets, getBannerFamily, getCurrentDesignDocument } from "./queries";
import { getDefaultLogoBox } from "./logo-size";
import { scaleLayersToSize } from "./resize";
import { checkGuideline } from "./guideline-check";
import { trackEvent } from "@/lib/analytics/track";
import type { DesignLayer, SafeZone } from "@/types/database";
import type { GuidelineVersion } from "@/types/brand";
import type { GuidelineCheckResult } from "@/types/design";

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
export async function getBrandElementAssetsAction(brandId: string) {
  return getBrandElementAssets(brandId);
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
    safe_zone: SafeZone | null;
  }
  let guideline: GuidelineSummary | null = null;
  if (brand?.current_guideline_version_id) {
    const { data } = await supabase
      .from("brand_guideline_versions")
      .select("fonts, logo_primary_path, safe_zone")
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
    // Real natural aspect ratio of the logo file (read from its actual
    // bytes — PNG/JPEG/WebP headers or an SVG's width/height/viewBox, see
    // image-dimensions.ts) — width is always derived from this, never set
    // independently of height, so the logo can never come out stretched.
    // Falls back to a square aspect only when the real dimensions
    // genuinely can't be read (e.g. a corrupt file) — never silently
    // guesses a wrong ratio.
    const logoBytes = await downloadBrandAsset(supabase, guideline.logo_primary_path);
    const naturalSize = logoBytes ? readImageDimensions(logoBytes) : null;
    const aspect = naturalSize ? naturalSize.width / naturalSize.height : 1;

    // A template's own layout.logo gives an explicit x/y/widthPx — honor
    // that position/width exactly, but still derive height from the
    // real aspect ratio instead of reusing widthPx as height (which
    // would force the logo into a square whenever the template's width
    // isn't already square). With no template, the box comes from this
    // preset's own deterministic default (see getDefaultLogoBox) — sized
    // and placed relative to THIS preset's actual canvas + safe zone,
    // not a flat pixel constant shared by every size.
    const templateLogo = template?.layout.logo;
    const logoBox = templateLogo
      ? { x: templateLogo.x, y: templateLogo.y, width: templateLogo.widthPx, height: Math.round(templateLogo.widthPx / aspect) }
      : getDefaultLogoBox(preset.width, preset.height, aspect, guideline.safe_zone);

    layers.push({
      id: newLayerId(),
      type: "logo",
      x: logoBox.x,
      y: logoBox.y,
      width: logoBox.width,
      height: logoBox.height,
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
      fontFamily: guideline?.fonts.heading?.family ?? "Aeonik Pro",
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
      size_preset_id: input.sizePresetId,
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

/** Lets the editor switch which brand a banner belongs to without leaving
 * the page. Only ever updates creative_assets' own brand_id/
 * guideline_version_id columns — never touches the design_documents row
 * (layers), so a banner's saved logo/text/background placements are
 * never silently overwritten by this call. EditorShell decides, client-
 * side, whether to also place a default logo (only when the banner has
 * no logo layer yet at all — see its handleChangeBrand). */
export async function changeBannerBrand(
  rawInput: unknown
): Promise<ActionResult<{ brandName: string; guideline: GuidelineVersion | null }>> {
  const parsed = changeBannerBrandSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const { assetId, brandId } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Bạn cần đăng nhập");

  const workspace = await getActiveWorkspace();
  if (!workspace) return err("FORBIDDEN", "Không tìm thấy workspace.");

  const { data: asset } = await supabase.from("creative_assets").select("workspace_id").eq("id", assetId).maybeSingle();
  if (!asset || asset.workspace_id !== workspace.workspaceId) return err("FORBIDDEN", "Không tìm thấy banner.");

  const brand = await getBrand(brandId);
  if (!brand || brand.workspaceId !== workspace.workspaceId || brand.status !== "active") {
    return err("VALIDATION_ERROR", "Thương hiệu không hợp lệ.");
  }

  const { error: updateError } = await supabase
    .from("creative_assets")
    .update({ brand_id: brandId, guideline_version_id: brand.currentGuidelineVersionId })
    .eq("id", assetId);
  if (updateError) {
    console.error("[changeBannerBrand]", updateError);
    return err("DB_ERROR", "Không thể đổi thương hiệu cho banner này.");
  }

  const guideline = await getCurrentGuideline(brandId);
  revalidatePath(`/create/banner/${assetId}`);
  return ok({ brandName: brand.name, guideline });
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
    .select("workspace_id, brand_id, guideline_version_id, current_design_document_id, name")
    .eq("id", assetId)
    .maybeSingle();
  if (!original) return err("NOT_FOUND", "Không tìm thấy banner.");

  const { data: sourceDoc } = original.current_design_document_id
    ? await supabase.from("design_documents").select("*").eq("id", original.current_design_document_id).maybeSingle()
    : { data: null };
  if (!sourceDoc) return err("NOT_FOUND", "Không tìm thấy bản thiết kế nguồn.");

  // Keeps the original's name (PRD ask: "giữ tên... khi nhân bản") — never
  // silently reset back to unnamed. A " (bản sao)" suffix makes the two
  // distinguishable in the Library instead of showing two identical names.
  const duplicateName = original.name ? `${original.name} (bản sao)` : "";

  const { data: newAsset, error: assetError } = await supabase
    .from("creative_assets")
    .insert({
      workspace_id: original.workspace_id,
      brand_id: original.brand_id,
      owner_id: user.id,
      type: "banner",
      name: duplicateName,
      status: "draft",
      width: sourceDoc.width,
      height: sourceDoc.height,
      guideline_version_id: original.guideline_version_id,
      size_preset_id: sourceDoc.size_preset_id,
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
    ? await supabase.from("design_documents").select("version").eq("id", asset.current_design_document_id).maybeSingle()
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
      size_preset_id: input.sizePresetId,
      width: input.width,
      height: input.height,
      document: { layers: input.layers, sizeVariants: input.sizeVariants },
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
    .update({ current_design_document_id: doc.id, size_preset_id: input.sizePresetId }, { count: "exact" })
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

export async function getBannerFamilyAction(assetId: string) {
  return getBannerFamily(assetId);
}

/** Thin wrapper so a Client Component can read another asset's CURRENT
 * layers (e.g. the size-variants panel exporting a variant without
 * opening its editor) without a direct Supabase query. */
export async function getCurrentDesignDocumentAction(assetId: string) {
  return getCurrentDesignDocument(assetId);
}

/**
 * "Tạo phiên bản kích thước khác" — the whole feature reuses the SAME
 * tables/history every other banner already has (see migration
 * 0011_banner_size_variants.sql's own doc comment): a size variant is
 * just another ordinary creative_assets row (type 'banner'), linked back
 * to the root via `source_banner_id`. Re-running this for a (root,
 * preset) pair that already has a variant UPDATES that variant with a
 * NEW design_documents version (never overwritten in place, same
 * principle as saveDesignDocument) instead of creating a duplicate asset
 * — this is also exactly what "Tạo lại" a single variant calls.
 *
 * NEVER calls any AI generation provider — the new layout is derived
 * purely by scaleLayersToSize() (pure geometry) from the SOURCE asset's
 * own CURRENT layers, which already include whatever AI-generated image
 * the user placed. The caller gets the scaled layers back so it can
 * render + upload a thumbnail itself (see OffscreenBannerStage) without
 * a second round trip to re-read them.
 */
export async function createBannerSizeVariantAction(rawInput: unknown): Promise<
  ActionResult<{
    assetId: string;
    layers: DesignLayer[];
    width: number;
    height: number;
    isNew: boolean;
    warnings: GuidelineCheckResult[];
  }>
> {
  const parsed = createBannerSizeVariantSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const { sourceAssetId, sizePresetId } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Bạn cần đăng nhập");

  const { data: sourceAsset } = await supabase
    .from("creative_assets")
    .select("workspace_id, brand_id, guideline_version_id, current_design_document_id, source_banner_id, name")
    .eq("id", sourceAssetId)
    .maybeSingle();
  if (!sourceAsset) return err("NOT_FOUND", "Không tìm thấy banner.");

  const rootId: string = sourceAsset.source_banner_id ?? sourceAssetId;
  const rootAsset =
    rootId === sourceAssetId
      ? sourceAsset
      : (
          await supabase
            .from("creative_assets")
            .select("workspace_id, brand_id, guideline_version_id, current_design_document_id, source_banner_id, name")
            .eq("id", rootId)
            .maybeSingle()
        ).data;
  if (!rootAsset) return err("NOT_FOUND", "Không tìm thấy banner gốc.");

  const [{ data: targetPreset }, { data: sourceDoc }, guideline] = await Promise.all([
    supabase.from("size_presets").select("width, height, name").eq("id", sizePresetId).maybeSingle(),
    sourceAsset.current_design_document_id
      ? supabase
          .from("design_documents")
          .select("document, width, height, size_preset_id")
          .eq("id", sourceAsset.current_design_document_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    getCurrentGuideline(rootAsset.brand_id),
  ]);
  if (!targetPreset) return err("VALIDATION_ERROR", "Preset kích thước không hợp lệ.");
  if (!sourceDoc) return err("NOT_FOUND", "Không tìm thấy bản thiết kế nguồn.");

  // Already exactly this preset (the root itself, or the source being
  // re-adapted to its own current size) — nothing to create, hand the
  // caller the source's own id/layers back as-is.
  if (sourceDoc.size_preset_id === sizePresetId) {
    return ok({
      assetId: sourceAssetId,
      layers: sourceDoc.document.layers,
      width: sourceDoc.width,
      height: sourceDoc.height,
      isNew: false,
      warnings: [],
    });
  }

  const scaledLayers = scaleLayersToSize(
    sourceDoc.document.layers,
    sourceDoc.width,
    sourceDoc.height,
    targetPreset.width,
    targetPreset.height,
    guideline?.safeZone
  );
  const warnings = checkGuideline(
    scaledLayers,
    targetPreset.width,
    targetPreset.height,
    targetPreset.width,
    targetPreset.height,
    guideline
  ).filter((r) => r.severity !== "pass");

  // A variant for this exact (root, preset) pair may already exist —
  // from an earlier "Tạo phiên bản" run, or because the caller is re-
  // adapting (the brief's own "Tạo lại một phiên bản đích") — in which
  // case this UPDATES it with a new version rather than creating a
  // second asset for the same preset.
  const { data: existingVariant } = await supabase
    .from("creative_assets")
    .select("id, current_design_document_id")
    .eq("source_banner_id", rootId)
    .eq("size_preset_id", sizePresetId)
    .maybeSingle();

  let targetAssetId: string;
  let isNew: boolean;
  let prevVersion = 0;

  if (existingVariant) {
    targetAssetId = existingVariant.id;
    isNew = false;
    const { data: prevDoc } = existingVariant.current_design_document_id
      ? await supabase.from("design_documents").select("version").eq("id", existingVariant.current_design_document_id).maybeSingle()
      : { data: null };
    prevVersion = prevDoc?.version ?? 0;
  } else {
    isNew = true;
    const variantName = `${rootAsset.name || "Banner chưa đặt tên"} — ${targetPreset.name}`;
    const { data: newAsset, error: assetError } = await supabase
      .from("creative_assets")
      .insert({
        workspace_id: rootAsset.workspace_id,
        brand_id: rootAsset.brand_id,
        owner_id: user.id,
        type: "banner",
        name: variantName,
        status: "draft",
        width: targetPreset.width,
        height: targetPreset.height,
        guideline_version_id: rootAsset.guideline_version_id,
        source_banner_id: rootId,
        size_preset_id: sizePresetId,
      })
      .select("id")
      .single();
    if (assetError || !newAsset) {
      console.error("[createBannerSizeVariantAction] asset", assetError);
      return err("DB_ERROR", "Không thể tạo phiên bản.");
    }
    targetAssetId = newAsset.id;
  }

  const { data: newDoc, error: docError } = await supabase
    .from("design_documents")
    .insert({
      asset_id: targetAssetId,
      version: prevVersion + 1,
      size_preset_id: sizePresetId,
      width: targetPreset.width,
      height: targetPreset.height,
      document: { layers: scaledLayers },
      guideline_version_id: rootAsset.guideline_version_id,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (docError || !newDoc) {
    console.error("[createBannerSizeVariantAction] document", docError);
    if (isNew) await supabase.from("creative_assets").delete().eq("id", targetAssetId);
    return err("DB_ERROR", "Không thể tạo bản thiết kế cho phiên bản.");
  }

  await supabase
    .from("creative_assets")
    .update({ current_design_document_id: newDoc.id, size_preset_id: sizePresetId })
    .eq("id", targetAssetId);

  revalidatePath("/library");
  revalidatePath(`/create/banner/${rootId}`);
  revalidatePath(`/create/banner/${targetAssetId}`);
  return ok({ assetId: targetAssetId, layers: scaledLayers, width: targetPreset.width, height: targetPreset.height, isNew, warnings });
}

/** Uploads a small representative render of a banner's CURRENT layout for
 * the size-variants list's thumbnails — rendered client-side via the
 * SAME Konva Stage.toDataURL() the real Export button already uses (see
 * OffscreenBannerStage), never a server-side render, never an extra AI
 * call. Purely cosmetic (list display only); never read by export or by
 * guideline checks. */
export async function setBannerThumbnailAction(assetId: string, file: File): Promise<ActionResult<{ path: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Bạn cần đăng nhập");

  const { data: asset } = await supabase.from("creative_assets").select("workspace_id, brand_id, thumbnail_path").eq("id", assetId).maybeSingle();
  if (!asset) return err("NOT_FOUND", "Không tìm thấy banner.");

  const path = buildCreativeAssetPath(asset.workspace_id, asset.brand_id, extensionForContentType(file.type));
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await uploadGeneratedImage(supabase, path, bytes, file.type);
  if (uploadError) {
    console.error("[setBannerThumbnailAction] upload", uploadError);
    return err("UPLOAD_ERROR", "Không thể lưu ảnh xem trước.");
  }

  const previousPath = asset.thumbnail_path;
  const { error: updateError, count } = await supabase
    .from("creative_assets")
    .update({ thumbnail_path: path }, { count: "exact" })
    .eq("id", assetId);
  if (updateError || !count) {
    await supabase.storage.from("creative-assets").remove([path]);
    return err("FORBIDDEN", "Bạn không có quyền cập nhật banner này.");
  }
  if (previousPath) await supabase.storage.from("creative-assets").remove([previousPath]);

  return ok({ path });
}
