import { createClient } from "@/lib/supabase/server";
import { resolveDashboardBannerUrl } from "./storage";
import { DASHBOARD_FEATURE_CARD_DEFAULTS } from "./feature-card-defaults";
import { DASHBOARD_MARQUEE_DEFAULT_TEXT, DASHBOARD_MARQUEE_DEFAULT_SPEED_SECONDS } from "./marquee-defaults";
import type { DashboardBanner, DashboardFeatureCard, DashboardFeatureCardSlot, DashboardMarquee } from "@/types/dashboard";
import type { Database } from "@/types/database";

type DashboardBannerRow = Database["public"]["Tables"]["dashboard_banners"]["Row"];
type DashboardFeatureCardRow = Database["public"]["Tables"]["dashboard_feature_cards"]["Row"];

const FEATURE_CARD_SLOTS: DashboardFeatureCardSlot[] = ["image", "banner"];

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

async function toDashboardFeatureCard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slot: DashboardFeatureCardSlot,
  row: DashboardFeatureCardRow | null
): Promise<DashboardFeatureCard> {
  const defaults = DASHBOARD_FEATURE_CARD_DEFAULTS[slot];
  if (!row) {
    return {
      slot,
      title: defaults.title,
      description: defaults.description,
      ctaLabel: defaults.ctaLabel,
      ctaUrl: defaults.ctaUrl,
      imagePath: null,
      imageUrl: null,
      imageWidth: null,
      imageHeight: null,
      focalX: 50,
      focalY: 50,
      backgroundStyle: defaults.backgroundStyle,
      isActive: true,
      isCustomized: false,
    };
  }
  return {
    slot,
    title: row.title,
    description: row.description,
    ctaLabel: row.cta_label,
    ctaUrl: row.cta_url,
    imagePath: row.image_path,
    imageUrl: await resolveDashboardBannerUrl(supabase, row.image_path),
    imageWidth: row.image_width,
    imageHeight: row.image_height,
    focalX: row.focal_x,
    focalY: row.focal_y,
    backgroundStyle: (row.background_style as DashboardFeatureCard["backgroundStyle"]) || "primary",
    isActive: row.is_active,
    isCustomized: true,
  };
}

/** Always returns both fixed slots, in order [image, banner], each
 * already merged with its built-in default when no row exists — the
 * caller never needs to know whether a given slot has been customized
 * (except via `isCustomized`, used only by the admin UI to decide
 * whether "Khôi phục mặc định" has anything to do). Fails closed to
 * defaults on any query error, same as every other query in this file. */
export async function getDashboardFeatureCards(workspaceId: string): Promise<DashboardFeatureCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("dashboard_feature_cards").select("*").eq("workspace_id", workspaceId);

  if (error) {
    console.error("[getDashboardFeatureCards]", error);
    return Promise.all(FEATURE_CARD_SLOTS.map((slot) => toDashboardFeatureCard(supabase, slot, null)));
  }

  const rowBySlot = new Map((data ?? []).map((row) => [row.slot, row]));
  return Promise.all(
    FEATURE_CARD_SLOTS.map((slot) => toDashboardFeatureCard(supabase, slot, rowBySlot.get(slot) ?? null))
  );
}

/** One row per workspace, or none — a missing row means "use the
 * built-in default text/speed", same no-row-means-default convention as
 * getDashboardFeatureCards. Used both by the real Dashboard (only when
 * `isActive`) and the admin settings form (always, to prefill it). */
export async function getDashboardMarquee(workspaceId: string): Promise<DashboardMarquee> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dashboard_marquee")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    console.error("[getDashboardMarquee]", error);
  }

  if (!data) {
    return {
      text: DASHBOARD_MARQUEE_DEFAULT_TEXT,
      speedSeconds: DASHBOARD_MARQUEE_DEFAULT_SPEED_SECONDS,
      isActive: true,
      isCustomized: false,
    };
  }

  return {
    text: data.text || DASHBOARD_MARQUEE_DEFAULT_TEXT,
    speedSeconds: data.speed_seconds,
    isActive: data.is_active,
    isCustomized: true,
  };
}
