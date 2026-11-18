import { createClient } from "@/lib/supabase/server";
import { resolveAuthGalleryUrl } from "./storage";
import type { AuthGalleryImage, AuthGalleryImageAdmin, AuthGallerySettings } from "@/types/auth-gallery";

type AuthGalleryImageRow = {
  id: string;
  image_path: string;
  image_width: number | null;
  image_height: number | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

/** Used by /login and /register — anonymous-safe (RLS already restricts
 * this to `is_active = true` for an unauthenticated caller; `.eq` here is
 * explicit too, so the public pages never depend solely on RLS to decide
 * what's "live"). Fails closed to an empty list on any query error, same
 * convention as getDashboardMarquee — a broken gallery query degrades to
 * "no gallery shown", never a crashed auth page. */
export async function getActiveAuthGalleryImages(): Promise<AuthGalleryImage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("auth_gallery_images")
    .select("id, image_path, image_width, image_height, sort_order, is_active, created_at")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data) {
    if (error) console.error("[getActiveAuthGalleryImages]", error);
    return [];
  }

  return (data as AuthGalleryImageRow[]).map((row) => ({
    id: row.id,
    imageUrl: resolveAuthGalleryUrl(supabase, row.image_path),
    imageWidth: row.image_width,
    imageHeight: row.image_height,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
  }));
}

/** Used by the /auth-gallery admin page — includes inactive rows (RLS's
 * admin-only policy grants this; requireWorkspaceAdmin() gates the page
 * itself, so a non-admin never reaches this call). */
export async function getAllAuthGalleryImages(): Promise<AuthGalleryImageAdmin[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("auth_gallery_images")
    .select("id, image_path, image_width, image_height, sort_order, is_active, created_at")
    .order("sort_order", { ascending: true });

  if (error || !data) {
    if (error) console.error("[getAllAuthGalleryImages]", error);
    return [];
  }

  return (data as AuthGalleryImageRow[]).map((row) => ({
    id: row.id,
    imagePath: row.image_path,
    imageUrl: resolveAuthGalleryUrl(supabase, row.image_path),
    imageWidth: row.image_width,
    imageHeight: row.image_height,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
  }));
}

/** Single global on/off switch — read by /login, /register (anonymous-
 * safe, RLS allows anyone to select) and the admin page. Missing row or
 * query error both fail closed to "enabled" (true) — the common case is
 * an un-migrated database still mid-rollout; a hard outage should never
 * silently hide a working gallery, but a missing table also shouldn't be
 * the thing that decides "off" (the table's own `getActive*` query
 * already fails closed to an empty list either way, so worst case here
 * is just an unnecessary empty render, not broken data). */
export async function getAuthGallerySettings(): Promise<AuthGallerySettings> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("auth_gallery_settings").select("is_enabled").eq("id", 1).maybeSingle();

  if (error) {
    console.error("[getAuthGallerySettings]", error);
    return { isEnabled: true };
  }
  if (!data) return { isEnabled: true };
  return { isEnabled: data.is_enabled };
}
