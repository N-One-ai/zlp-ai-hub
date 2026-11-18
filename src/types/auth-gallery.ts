export interface AuthGalleryImage {
  id: string;
  /** Storage path (resolved to a public URL) OR an already-public
   * "/..." site-relative URL — see auth_gallery_images.image_path in
   * migration 0016_auth_gallery.sql. */
  imageUrl: string;
  imageWidth: number | null;
  imageHeight: number | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

/** Only the field the admin's own image-management actions need back —
 * never exposed to /login or /register, which only ever render imageUrl. */
export interface AuthGalleryImageAdmin extends AuthGalleryImage {
  imagePath: string;
}

export interface AuthGallerySettings {
  isEnabled: boolean;
}
