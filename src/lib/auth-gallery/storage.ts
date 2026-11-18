import type { createClient } from "@/lib/supabase/server";

// Unlike every other bucket in this app ("creative-assets", "brand-assets",
// "avatars" — all private, signed-URL-only), this one is PUBLIC: /login and
// /register render for visitors with no session, so a signed URL (which
// needs an RLS-scoped authenticated client) isn't an option. See migration
// 0016_auth_gallery.sql for the full rationale.
const BUCKET = "auth-gallery";

export const AUTH_GALLERY_MAX_BYTES = 5 * 1024 * 1024;
export const AUTH_GALLERY_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function buildAuthGalleryPath(filename: string): string {
  const ext = filename.includes(".") ? filename.split(".").pop() : "bin";
  return `_tiles/${crypto.randomUUID()}.${ext}`;
}

/** A path starting with "/" is already a public, site-relative URL (the
 * seeded tile-NN.svg rows under public/auth/gallery/) — used as-is.
 * Everything else is a path inside the auth-gallery bucket, resolved via
 * getPublicUrl (synchronous, no network round-trip, no TTL to expire —
 * unlike resolveSignedAssetUrl elsewhere in this app). */
export function resolveAuthGalleryUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string
): string {
  if (path.startsWith("/")) return path;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function uploadAuthGalleryAsset(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string,
  file: File
) {
  return supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
}

export async function deleteAuthGalleryAsset(supabase: Awaited<ReturnType<typeof createClient>>, path: string) {
  return supabase.storage.from(BUCKET).remove([path]);
}

/** "Chọn ảnh từ thư viện hiện có" — copies an existing creative-assets
 * object (private, workspace-scoped) into the public auth-gallery bucket
 * under a fresh path, since the two buckets have incompatible RLS and the
 * gallery must stay readable with no session. The caller's own RLS-scoped
 * client is used for the download, so this can never pull a file from a
 * workspace the admin isn't a member of. */
export async function copyFromCreativeAssets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sourcePath: string
): Promise<{ path: string } | { error: string }> {
  const { data: blob, error: downloadError } = await supabase.storage.from("creative-assets").download(sourcePath);
  if (downloadError || !blob) {
    return { error: downloadError?.message ?? "Không tải được ảnh từ thư viện." };
  }

  const ext = sourcePath.includes(".") ? sourcePath.split(".").pop() : "bin";
  const path = `_tiles/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type || "image/png", upsert: false });
  if (uploadError) return { error: uploadError.message };

  return { path };
}
