import type { createClient } from "@/lib/supabase/server";

const BUCKET = "creative-assets";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour, same convention as brand-assets

export function buildCreativeAssetPath(workspaceId: string, brandId: string, extension: string): string {
  return `${workspaceId}/${brandId}/${crypto.randomUUID()}.${extension}`;
}

/** Same reasoning as lib/brand/storage.ts's resolveSignedUrl: fails
 * closed (null) rather than guessing, and relies on the caller's own
 * RLS-scoped client so a signed URL can never be minted for an object
 * outside the caller's workspace. */
export async function resolveSignedAssetUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string | null
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    if (error) console.error("[resolveSignedAssetUrl]", error);
    return null;
  }
  return data.signedUrl;
}

export async function uploadGeneratedImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string,
  bytes: Buffer,
  contentType: string
) {
  return supabase.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false });
}

export function extensionForContentType(contentType: string): string {
  switch (contentType) {
    case "image/svg+xml":
      return "svg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/jpeg":
    default:
      return "jpg";
  }
}
