import type { createClient } from "@/lib/supabase/server";

const BUCKET = "brand-assets";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour — long enough for a page view, short-lived by design.

export const BRAND_LOGO_MAX_BYTES = 5 * 1024 * 1024; // matches the bucket's file_size_limit (migration 0002)
export const BRAND_LOGO_ALLOWED_TYPES = ["image/svg+xml", "image/png", "image/jpeg", "image/webp"];

export function buildBrandAssetPath(workspaceId: string, brandId: string, filename: string): string {
  // Sanitize to avoid path traversal / unexpected folder nesting from a
  // crafted filename — keep only the extension, generate the rest.
  const ext = filename.includes(".") ? filename.split(".").pop() : "bin";
  const safeName = `${crypto.randomUUID()}.${ext}`;
  return `${workspaceId}/${brandId}/${safeName}`;
}

/** Resolves a stored object path to a short-lived signed URL. Uses the
 * caller's own RLS-scoped client (not service-role) — Supabase Storage
 * still enforces the bucket's SELECT policy for signed URL generation, so
 * this can never produce a URL for an object outside the caller's own
 * workspace. Returns null for a null/empty path or on any error (fails
 * closed — a missing logo renders as missing, never as a broken guess). */
export async function resolveSignedUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string | null
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    if (error) console.error("[resolveSignedUrl]", error);
    return null;
  }
  return data.signedUrl;
}

export async function uploadBrandAsset(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string,
  file: File
) {
  return supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
}

export async function deleteBrandAsset(supabase: Awaited<ReturnType<typeof createClient>>, path: string) {
  return supabase.storage.from(BUCKET).remove([path]);
}
