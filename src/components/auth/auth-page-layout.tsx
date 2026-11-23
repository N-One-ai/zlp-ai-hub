import { getActiveAuthGalleryImages, getAuthGallerySettings } from "@/lib/auth-gallery/queries";
import { AuthGallery } from "./auth-gallery";

/**
 * Shared layout for /login and /register — fetches the admin-managed
 * gallery config ONCE here so both pages always render the exact same
 * list/order/on-off state (the request's "dùng chung... để quản trị một
 * lần có hiệu lực cho cả hai trang"), instead of each page duplicating
 * the fetch.
 *
 * The form (`children`, i.e. <AuthShell>) centers in the space ABOVE a
 * reserved bottom band — not the full viewport — which is what "pushes
 * the form up" so the gallery band at the bottom is always fully
 * visible, never cropped or covered. Gallery height is a chunk of the
 * viewport height on larger screens (≈40-45%, per spec) and a smaller,
 * fixed-minimum chunk on mobile — slots (single tiles and stacked pairs)
 * are all bottom-aligned to this band, so the gallery scales down
 * naturally with the band's own height on a short viewport without
 * needing a separate mobile-specific adjustment.
 */
export async function AuthPageLayout({ children }: { children: React.ReactNode }) {
  const [images, settings] = await Promise.all([getActiveAuthGalleryImages(), getAuthGallerySettings()]);
  const showGallery = settings.isEnabled && images.length > 0;

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      <div className="flex flex-1 items-center justify-center overflow-hidden px-4 py-8">{children}</div>
      {showGallery && (
        <div className="relative h-[26vh] min-h-[170px] shrink-0 sm:h-[36vh] md:h-[42vh] lg:h-[45vh]">
          <AuthGallery images={images} className="absolute inset-0" />
        </div>
      )}
    </div>
  );
}
