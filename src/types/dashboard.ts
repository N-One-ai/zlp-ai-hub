export interface DashboardBanner {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaUrl: string;
  /** Raw Storage path — kept so the manager UI can tell whether an edit
   * replaced the image (and delete the old file), never rendered directly. */
  imagePath: string;
  /** Short-lived signed URL resolved from image_path — never a public URL,
   * same convention as brand logos/avatars. Null if the stored path no
   * longer resolves (deleted/expired) — rendered as a graceful missing
   * state, never a broken <img>. */
  imageUrl: string | null;
  /** Natural pixel size read client-side at upload time — null for a
   * banner created before this existed and never re-saved since. */
  imageWidth: number | null;
  imageHeight: number | null;
  /** CSS object-position anchor (0-100, percentage) used when the image is
   * cover-cropped into the Dashboard frame. */
  focalX: number;
  focalY: number;
  /** Optional separate image for the mobile (4:3) frame — null means the
   * desktop image above is reused (cover-cropped with its own focal point). */
  mobileImagePath: string | null;
  mobileImageUrl: string | null;
  mobileImageWidth: number | null;
  mobileImageHeight: number | null;
  mobileFocalX: number;
  mobileFocalY: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DashboardFeatureCardSlot = "image" | "banner";
export type DashboardFeatureCardBackground = "primary" | "accent" | "neutral";

/** A Dashboard feature card ("Tạo ảnh" / "Tạo banner"), already merged
 * with its built-in default — every field here is the EFFECTIVE value to
 * render, never partially-null: `isCustomized` is the only way callers
 * can tell a workspace has a saved row for this slot (vs. still on the
 * untouched default), e.g. to decide whether "Khôi phục mặc định" does
 * anything. */
export interface DashboardFeatureCard {
  slot: DashboardFeatureCardSlot;
  title: string;
  description: string;
  ctaLabel: string;
  ctaUrl: string;
  /** Raw Storage path of a CUSTOM image — null when using the built-in
   * decorative SVG art (ImageHeroArt/BannerHeroArt) for this slot. */
  imagePath: string | null;
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  focalX: number;
  focalY: number;
  backgroundStyle: DashboardFeatureCardBackground;
  isActive: boolean;
  isCustomized: boolean;
}
