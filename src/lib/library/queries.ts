import { createClient } from "@/lib/supabase/server";
import { resolveSignedAssetUrl } from "@/lib/generation/storage";
import { LIBRARY_PAGE_SIZE, type LibraryAssetListItem, type LibraryAssetDetail, type LibraryFilters } from "@/types/library";

/** Strips/escapes characters with special meaning in a PostgREST .or()
 * filter string, same convention used throughout this app's other search
 * boxes — a search term is always treated as a literal substring, never
 * parsed as extra filter clauses. */
function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[,()]/g, "").replace(/[%_]/g, (c) => `\\${c}`);
}

export interface LibraryPage {
  assets: LibraryAssetListItem[];
  total: number;
  page: number;
  pageSize: number;
  /** True only on a genuine query failure — lets the page show "thử lại"
   * instead of silently rendering an empty-state as if there's really
   * nothing there. */
  error: boolean;
}

export async function getLibraryAssets(workspaceId: string, filters: LibraryFilters): Promise<LibraryPage> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = LIBRARY_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("creative_assets")
    .select("id, type, name, brand_id, campaign, status, owner_id, storage_path, created_at, brands(name), profiles(name, email)", {
      count: "exact",
    })
    .eq("workspace_id", workspaceId);

  if (filters.type) query = query.eq("type", filters.type);
  if (filters.brandId) query = query.eq("brand_id", filters.brandId);
  if (filters.ownerId) query = query.eq("owner_id", filters.ownerId);
  if (filters.status) query = query.eq("status", filters.status);

  const search = filters.search?.trim();
  if (search) {
    const pattern = `%${sanitizeSearchTerm(search)}%`;
    query = query.or(`name.ilike.${pattern},prompt.ilike.${pattern},campaign.ilike.${pattern}`);
  }

  query = query.order("created_at", { ascending: filters.sort === "oldest" }).range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.error("[getLibraryAssets]", error);
    return { assets: [], total: 0, page, pageSize, error: true };
  }

  const rows = (data ?? []) as unknown as {
    id: string;
    type: LibraryAssetListItem["type"];
    name: string;
    brand_id: string;
    campaign: string;
    status: LibraryAssetListItem["status"];
    owner_id: string | null;
    storage_path: string | null;
    created_at: string;
    brands: { name: string } | null;
    profiles: { name: string | null; email: string } | null;
  }[];

  const assets = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      brandId: row.brand_id,
      brandName: row.brands?.name ?? "—",
      campaign: row.campaign,
      status: row.status,
      ownerId: row.owner_id,
      ownerName: row.profiles?.name || row.profiles?.email || "—",
      thumbnailUrl: await resolveSignedAssetUrl(supabase, row.storage_path),
      createdAt: row.created_at,
    }))
  );

  return { assets, total: count ?? 0, page, pageSize, error: false };
}

/** Dashboard's "tài sản gần đây" — same shape as a library page, just the
 * newest few, no filters. */
export async function getRecentAssets(workspaceId: string, limit = 6): Promise<LibraryAssetListItem[]> {
  const page = await getLibraryAssets(workspaceId, { page: 1, sort: "newest" });
  return page.assets.slice(0, limit);
}

export async function getAssetDetail(assetId: string): Promise<LibraryAssetDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("creative_assets")
    .select(
      "id, type, name, brand_id, campaign, status, owner_id, storage_path, width, height, prompt, tags, created_at, brands(name), profiles(name, email)"
    )
    .eq("id", assetId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[getAssetDetail]", error);
    return null;
  }

  const row = data as unknown as {
    id: string;
    type: LibraryAssetDetail["type"];
    name: string;
    brand_id: string;
    campaign: string;
    status: LibraryAssetDetail["status"];
    owner_id: string | null;
    storage_path: string | null;
    width: number | null;
    height: number | null;
    prompt: string | null;
    tags: string[];
    created_at: string;
    brands: { name: string } | null;
    profiles: { name: string | null; email: string } | null;
  };

  let versions: LibraryAssetDetail["versions"] = [];
  if (row.type === "banner") {
    const { data: docs } = await supabase
      .from("design_documents")
      .select("id, version, created_at")
      .eq("asset_id", assetId)
      .order("version", { ascending: false });
    versions = (docs ?? []).map((d) => ({ id: d.id, version: d.version, createdAt: d.created_at }));
  }

  return {
    id: row.id,
    type: row.type,
    name: row.name,
    brandId: row.brand_id,
    brandName: row.brands?.name ?? "—",
    campaign: row.campaign,
    status: row.status,
    ownerId: row.owner_id,
    ownerName: row.profiles?.name || row.profiles?.email || "—",
    thumbnailUrl: await resolveSignedAssetUrl(supabase, row.storage_path),
    fileUrl: await resolveSignedAssetUrl(supabase, row.storage_path),
    prompt: row.prompt,
    width: row.width,
    height: row.height,
    tags: row.tags,
    createdAt: row.created_at,
    versions,
  };
}
