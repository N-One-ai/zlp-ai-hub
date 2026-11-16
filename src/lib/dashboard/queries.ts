import { createClient } from "@/lib/supabase/server";
import { resolveDashboardBannerUrl } from "./storage";
import type { DashboardBanner } from "@/types/dashboard";
import type { Database } from "@/types/database";

type DashboardBannerRow = Database["public"]["Tables"]["dashboard_banners"]["Row"];

/** Plain reads for Server Components — RLS alone is the authorization
 * boundary, same convention as lib/brand/queries.ts. */
async function toDashboardBanner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: DashboardBannerRow
): Promise<DashboardBanner> {
  const [imageUrl, mobileImageUrl] = await Promise.all([
    resolveDashboardBannerUrl(supabase, row.image_path),
    resolveDashboardBannerUrl(supabase, row.mobile_image_path),
  ]);
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    description: row.description,
    ctaLabel: row.cta_label,
    ctaUrl: row.cta_url,
    imagePath: row.image_path,
    imageUrl,
    imageWidth: row.image_width,
    imageHeight: row.image_height,
    focalX: row.focal_x,
    focalY: row.focal_y,
    mobileImagePath: row.mobile_image_path,
    mobileImageUrl,
    mobileImageWidth: row.mobile_image_width,
    mobileImageHeight: row.mobile_image_height,
    mobileFocalX: row.mobile_focal_x,
    mobileFocalY: row.mobile_focal_y,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Every banner (active + inactive), ordered for the management list. */
export async function getDashboardBanners(workspaceId: string): Promise<DashboardBanner[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dashboard_banners")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[getDashboardBanners]", error);
    return [];
  }
  return Promise.all((data ?? []).map((row) => toDashboardBanner(supabase, row)));
}

/** Active-only, for the Dashboard's own carousel. */
export async function getActiveDashboardBanners(workspaceId: string): Promise<DashboardBanner[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dashboard_banners")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[getActiveDashboardBanners]", error);
    return [];
  }
  return Promise.all((data ?? []).map((row) => toDashboardBanner(supabase, row)));
}
