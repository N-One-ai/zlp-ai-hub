import { createClient } from "@/lib/supabase/server";
import { resolveSignedAssetUrl } from "@/lib/generation/storage";
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
}

async function resolveLayers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  layers: DesignLayer[]
): Promise<ResolvedLayer[]> {
  return Promise.all(
    layers.map(async (layer) => ({
      ...layer,
      imageUrl: layer.imagePath ? await resolveSignedAssetUrl(supabase, layer.imagePath) : null,
    }))
  );
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
