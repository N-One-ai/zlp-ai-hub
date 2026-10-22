import { createClient } from "@/lib/supabase/server";
import { resolveSignedUrl } from "./storage";
import type { Brand, GuidelineVersion, SizePreset, Template, BrandReadiness } from "@/types/brand";
import type { Database } from "@/types/database";

type BrandRow = Database["public"]["Tables"]["brands"]["Row"];
type GuidelineRow = Database["public"]["Tables"]["brand_guideline_versions"]["Row"];
type SizePresetRow = Database["public"]["Tables"]["size_presets"]["Row"];
type TemplateRow = Database["public"]["Tables"]["templates"]["Row"];

/** Plain reads for Server Components — not Server Actions. RLS alone is
 * the authorization boundary: every query here runs through the normal
 * session-scoped client, never the service-role client. */

/** brands.avatar_url actually stores a private Storage PATH (same
 * brand-assets bucket as logos), resolved here to a short-lived signed
 * URL — never a public URL, same reasoning as guideline logos. */
async function toBrand(supabase: Awaited<ReturnType<typeof createClient>>, row: BrandRow): Promise<Brand> {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description,
    status: row.status,
    avatarUrl: await resolveSignedUrl(supabase, row.avatar_url),
    currentGuidelineVersionId: row.current_guideline_version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getBrands(workspaceId: string): Promise<Brand[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getBrands]", error);
    return [];
  }
  return Promise.all((data ?? []).map((row) => toBrand(supabase, row)));
}

export async function getBrand(brandId: string): Promise<Brand | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("brands").select("*").eq("id", brandId).maybeSingle();

  if (error) {
    console.error("[getBrand]", error);
    return null;
  }
  return data ? toBrand(supabase, data) : null;
}

async function toGuidelineVersion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: GuidelineRow
): Promise<GuidelineVersion> {
  const [primaryUrl, secondaryUrl, lightUrl, darkUrl] = await Promise.all([
    resolveSignedUrl(supabase, row.logo_primary_path),
    resolveSignedUrl(supabase, row.logo_secondary_path),
    resolveSignedUrl(supabase, row.logo_light_path),
    resolveSignedUrl(supabase, row.logo_dark_path),
  ]);

  return {
    id: row.id,
    brandId: row.brand_id,
    version: row.version,
    logos: {
      primaryPath: row.logo_primary_path,
      primaryUrl,
      secondaryPath: row.logo_secondary_path,
      secondaryUrl,
      lightPath: row.logo_light_path,
      lightUrl,
      darkPath: row.logo_dark_path,
      darkUrl,
    },
    colors: row.colors,
    fonts: row.fonts,
    safeZone: row.safe_zone,
    logoRules: row.logo_rules,
    layoutNotes: row.layout_notes,
    createdAt: row.created_at,
  };
}

/** The brand's current guideline version, with logo paths already
 * resolved to signed URLs. Null if the brand has never had a guideline
 * saved yet (brand-new brand, nothing configured). */
export async function getCurrentGuideline(brandId: string): Promise<GuidelineVersion | null> {
  const supabase = await createClient();
  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("current_guideline_version_id")
    .eq("id", brandId)
    .maybeSingle();

  if (brandError || !brand?.current_guideline_version_id) {
    if (brandError) console.error("[getCurrentGuideline] brand", brandError);
    return null;
  }

  const { data, error } = await supabase
    .from("brand_guideline_versions")
    .select("*")
    .eq("id", brand.current_guideline_version_id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[getCurrentGuideline] version", error);
    return null;
  }

  return toGuidelineVersion(supabase, data);
}

/** What's missing before this brand is ready to generate with — purely
 * derived from real stored data (PRD §8.2: Admin must see what's missing
 * before using a brand). */
export function computeBrandReadiness(
  guideline: GuidelineVersion | null,
  sizePresetCount: number
): BrandReadiness {
  const hasLogo = !!guideline?.logos.primaryUrl;
  const hasColors = (guideline?.colors.length ?? 0) > 0;
  const hasFonts = !!(guideline?.fonts.heading || guideline?.fonts.body);
  const hasSizePreset = sizePresetCount > 0;
  return {
    hasLogo,
    hasColors,
    hasFonts,
    hasSizePreset,
    isReady: hasLogo && hasColors && hasFonts && hasSizePreset,
  };
}

function toSizePreset(row: SizePresetRow): SizePreset {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    channel: row.channel,
    width: row.width,
    height: row.height,
    exportFormat: row.export_format,
  };
}

export async function getSizePresets(workspaceId: string): Promise<SizePreset[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("size_presets")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  if (error) {
    console.error("[getSizePresets]", error);
    return [];
  }
  return (data ?? []).map(toSizePreset);
}

export async function getSizePreset(presetId: string): Promise<SizePreset | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("size_presets").select("*").eq("id", presetId).maybeSingle();

  if (error || !data) {
    if (error) console.error("[getSizePreset]", error);
    return null;
  }
  return toSizePreset(data);
}

function toTemplate(row: TemplateRow): Template {
  return {
    id: row.id,
    brandId: row.brand_id,
    name: row.name,
    sizePresetId: row.size_preset_id,
    layout: row.layout,
    status: row.status,
  };
}

export async function getTemplates(brandId: string): Promise<Template[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .eq("brand_id", brandId)
    .eq("status", "active")
    .order("name", { ascending: true });

  if (error) {
    console.error("[getTemplates]", error);
    return [];
  }
  return (data ?? []).map(toTemplate);
}
