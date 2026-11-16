import { createClient } from "@/lib/supabase/server";
import { resolveSignedAssetUrl } from "@/lib/generation/storage";
import { getCurrentGuideline } from "@/lib/brand/queries";
import { checkGuideline } from "./guideline-check";
import type { DesignLayer } from "@/types/database";
import type { ResolvedLayer } from "@/types/design";

export interface BannerAsset {
  id: string;
  brandId: string;
  workspaceId: string;
  name: string;
  status: "draft" | "ready" | "archived";
  ownerId: string | null;
}

export interface LoadedDesignDocument {
  id: string;
  version: number;
  width: number;
  height: number;
  sizePresetId: string | null;
  layers: ResolvedLayer[];
  /** Other size presets the user has already visited for this asset —
   * see DesignDocumentContent.sizeVariants. A preset not present here
   * simply hasn't been visited yet. */
  sizeVariants: Record<string, ResolvedLayer[]>;
}

async function resolveLayers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  layers: DesignLayer[]
): Promise<ResolvedLayer[]> {
  return Promise.all(
    layers.map(async (layer) => ({
      ...layer,
      imageUrl: layer.imagePath ? await resolveSignedAssetUrl(supabase, layer.imagePath) : null,
      aiReferenceImageUrls: layer.aiReferenceImagePaths
        ? await Promise.all(layer.aiReferenceImagePaths.map((p) => resolveSignedAssetUrl(supabase, p)))
        : undefined,
    }))
  );
}

async function resolveSizeVariants(
  supabase: Awaited<ReturnType<typeof createClient>>,
  variants: Record<string, DesignLayer[]> | undefined
): Promise<Record<string, ResolvedLayer[]>> {
  if (!variants) return {};
  const entries = await Promise.all(
    Object.entries(variants).map(async ([presetId, layers]) => [presetId, await resolveLayers(supabase, layers)] as const)
  );
  return Object.fromEntries(entries);
}

export async function getBannerAsset(assetId: string): Promise<BannerAsset | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creative_assets")
    .select("id, brand_id, workspace_id, name, status, owner_id, type")
    .eq("id", assetId)
    .maybeSingle();

  if (error || !data || data.type !== "banner") {
    if (error) console.error("[getBannerAsset]", error);
    return null;
  }

  return {
    id: data.id,
    brandId: data.brand_id,
    workspaceId: data.workspace_id,
    name: data.name,
    status: data.status,
    ownerId: data.owner_id,
  };
}

/** The asset's current design document, with every layer's imagePath
 * already resolved to a short-lived signed URL for canvas rendering. */
export async function getCurrentDesignDocument(assetId: string): Promise<LoadedDesignDocument | null> {
  const supabase = await createClient();

  const { data: asset, error: assetError } = await supabase
    .from("creative_assets")
    .select("current_design_document_id")
    .eq("id", assetId)
    .maybeSingle();

  if (assetError || !asset?.current_design_document_id) {
    if (assetError) console.error("[getCurrentDesignDocument] asset", assetError);
    return null;
  }

  const { data, error } = await supabase
    .from("design_documents")
    .select("*")
    .eq("id", asset.current_design_document_id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[getCurrentDesignDocument] document", error);
    return null;
  }

  return {
    id: data.id,
    version: data.version,
    width: data.width,
    height: data.height,
    sizePresetId: data.size_preset_id,
    layers: await resolveLayers(supabase, data.document.layers),
    sizeVariants: await resolveSizeVariants(supabase, data.document.sizeVariants),
  };
}

/** Existing saved images for a brand — the "chọn ảnh đã có trong thư
 * viện" option when picking a banner's background (PRD §7.3). */
export async function getBrandImageAssets(brandId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creative_assets")
    .select("id, name, storage_path, width, height")
    .eq("brand_id", brandId)
    .eq("type", "image")
    .eq("status", "ready")
    .not("storage_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("[getBrandImageAssets]", error);
    return [];
  }

  return Promise.all(
    (data ?? []).map(async (row) => ({
      id: row.id,
      name: row.name,
      path: row.storage_path as string,
      width: row.width,
      height: row.height,
      url: await resolveSignedAssetUrl(supabase, row.storage_path),
    }))
  );
}

/** Brand's "Elements" library for the banner editor — reuses the exact
 * SAME creative_assets table/upload pipeline as background images
 * (uploadImageAsset with tags:["element"]), never a separate asset
 * table/kho. Filtered by that tag so plain background uploads never show
 * up here and vice versa. */
export async function getBrandElementAssets(brandId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creative_assets")
    .select("id, name, storage_path, width, height")
    .eq("brand_id", brandId)
    .eq("type", "image")
    .eq("status", "ready")
    .contains("tags", ["element"])
    .not("storage_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) {
    console.error("[getBrandElementAssets]", error);
    return [];
  }

  return Promise.all(
    (data ?? []).map(async (row) => ({
      id: row.id,
      name: row.name,
      path: row.storage_path as string,
      width: row.width,
      height: row.height,
      url: await resolveSignedAssetUrl(supabase, row.storage_path),
    }))
  );
}

export interface BannerFamilyMember {
  id: string;
  name: string;
  width: number;
  height: number;
  sizePresetId: string | null;
  presetName: string | null;
  /** True for the root banner itself — every other member was adapted
   * FROM it (see "Tạo phiên bản kích thước khác" / createBannerSizeVariantAction). */
  isOriginal: boolean;
  thumbnailUrl: string | null;
  /** True when this member's OWN current layout fails or needs review
   * under checkGuideline at its OWN size — recomputed live every call,
   * never a stale stored flag, so it always reflects the member's actual
   * current (possibly hand-edited since adapting) layout. */
  needsReview: boolean;
  status: string;
}

/**
 * Resolves the whole size-variant family for a banner — works whether
 * `assetId` is the root itself or any one of its variants. Always lists
 * the root first, then every variant (oldest first). Never includes a
 * different family's banners.
 */
export async function getBannerFamily(assetId: string): Promise<{ rootId: string; members: BannerFamilyMember[] }> {
  const supabase = await createClient();
  const { data: asset } = await supabase
    .from("creative_assets")
    .select("source_banner_id, brand_id")
    .eq("id", assetId)
    .eq("type", "banner")
    .maybeSingle();
  if (!asset) return { rootId: assetId, members: [] };

  const rootId = asset.source_banner_id ?? assetId;

  const { data: rows, error } = await supabase
    .from("creative_assets")
    .select("id, name, width, height, size_preset_id, thumbnail_path, current_design_document_id, status, created_at")
    .eq("type", "banner")
    .or(`id.eq.${rootId},source_banner_id.eq.${rootId}`)
    .order("created_at", { ascending: true });

  if (error || !rows || rows.length === 0) {
    if (error) console.error("[getBannerFamily]", error);
    return { rootId, members: [] };
  }

  const presetIds = [...new Set(rows.map((r) => r.size_preset_id).filter((id): id is string => Boolean(id)))];
  const { data: presets } = presetIds.length
    ? await supabase.from("size_presets").select("id, name").in("id", presetIds)
    : { data: [] as { id: string; name: string }[] };
  const presetNameById = new Map((presets ?? []).map((p) => [p.id, p.name]));

  const guideline = await getCurrentGuideline(asset.brand_id);

  const members = await Promise.all(
    rows.map(async (row): Promise<BannerFamilyMember> => {
      let needsReview = false;
      if (row.current_design_document_id) {
        const { data: doc } = await supabase
          .from("design_documents")
          .select("document")
          .eq("id", row.current_design_document_id)
          .maybeSingle();
        if (doc) {
          const results = checkGuideline(doc.document.layers, row.width ?? 0, row.height ?? 0, row.width ?? 0, row.height ?? 0, guideline);
          needsReview = results.some((r) => r.severity !== "pass");
        }
      }
      return {
        id: row.id,
        name: row.name,
        width: row.width ?? 0,
        height: row.height ?? 0,
        sizePresetId: row.size_preset_id,
        presetName: row.size_preset_id ? (presetNameById.get(row.size_preset_id) ?? null) : null,
        isOriginal: row.id === rootId,
        thumbnailUrl: row.thumbnail_path ? await resolveSignedAssetUrl(supabase, row.thumbnail_path) : null,
        needsReview,
        status: row.status,
      };
    })
  );

  members.sort((a, b) => Number(b.isOriginal) - Number(a.isOriginal));
  return { rootId, members };
}
