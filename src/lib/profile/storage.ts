import type { createClient } from "@/lib/supabase/server";

const BUCKET = "avatars";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour — same convention as brand-assets/creative-assets.

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // matches the bucket's file_size_limit (migration 0007)
export const AVATAR_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function buildAvatarPath(userId: string, filename: string): string {
  const ext = filename.includes(".") ? filename.split(".").pop() : "bin";
  return `${userId}/${crypto.randomUUID()}.${ext}`;
}

/** Resolves a stored avatar PATH to a short-lived signed URL. Uses the
 * caller's own RLS-scoped client — Storage still enforces the bucket's
 * SELECT policy (any authenticated user) before minting one. Returns null
 * for a null/empty path or on any error — fails closed, same convention
 * as resolveSignedUrl in lib/brand/storage.ts and lib/generation/storage.ts. */
export async function resolveAvatarUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string | null
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    if (error) console.error("[resolveAvatarUrl]", error);
    return null;
  }
  return data.signedUrl;
}

export async function uploadAvatarFile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string,
  file: File
) {
  return supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
}

export async function deleteAvatarFile(supabase: Awaited<ReturnType<typeof createClient>>, path: string) {
  return supabase.storage.from(BUCKET).remove([path]);
}
