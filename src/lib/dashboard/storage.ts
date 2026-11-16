import type { createClient } from "@/lib/supabase/server";

// Reuses the existing "creative-assets" bucket (lib/generation/storage.ts)
// rather than standing up a new bucket — its Storage RLS only checks the
// first path segment (workspace_id), so a dedicated "_dashboard-banners"
// subfolder (same convention as _reference / _character-faces) passes the
// existing policy unchanged, no Storage migration needed.
const BUCKET = "creative-assets";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour, same convention as brand-assets/creative-assets

export const DASHBOARD_BANNER_MAX_BYTES = 5 * 1024 * 1024;
export const DASHBOARD_BANNER_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function buildDashboardBannerPath(workspaceId: string, filename: string): string {
  const ext = filename.includes(".") ? filename.split(".").pop() : "bin";
  return `${workspaceId}/_dashboard-banners/${crypto.randomUUID()}.${ext}`;
}

/** Same bucket/upload/delete/resolve helpers below as the big banner —
 * only the subfolder differs, purely for tidy browsing in the Storage
 * console, since RLS only checks the workspace_id segment either way. */
export function buildDashboardFeatureCardPath(workspaceId: string, filename: string): string {
  const ext = filename.includes(".") ? filename.split(".").pop() : "bin";
  return `${workspaceId}/_dashboard-feature-cards/${crypto.randomUUID()}.${ext}`;
}

/** Fails closed (null) rather than guessing — a missing/expired banner
 * image renders as missing, never as a broken guess. Same reasoning as
 * lib/brand/storage.ts's resolveSignedUrl. */
export async function resolveDashboardBannerUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string | null
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    if (error) console.error("[resolveDashboardBannerUrl]", error);
    return null;
  }
  return data.signedUrl;
}

export async function uploadDashboardBannerAsset(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string,
  file: File
) {
  return supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
}

export async function deleteDashboardBannerAsset(supabase: Awaited<ReturnType<typeof createClient>>, path: string) {
  return supabase.storage.from(BUCKET).remove([path]);
}
