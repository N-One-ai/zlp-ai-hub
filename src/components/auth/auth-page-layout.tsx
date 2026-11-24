import { getActiveAuthGalleryImages, getAuthGallerySettings } from "@/lib/auth-gallery/queries";
import { AuthGallery } from "./auth-gallery";
import { AuthBackdrop } from "./auth-backdrop";

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
 * fixed-minimum chunk on mobile, where AuthGallery also shrinks every
 * tile (via its own `--shape-scale` custom property) so the varied
 * card sizes stay comfortably inside the shorter band instead of
 * crowding or clipping it.
 *
 * When there are no active gallery images (or the admin has disabled
 * the gallery), this band isn't rendered at all — that *is* the
 * "trạng thái fallback tối giản": no reserved empty space, no drawn
 * placeholder shapes standing in for real photos, just the plain form.
 *
 * A bottom fade (`bg-background` -> transparent, `pointer-events-none`)
 * sits over the band's own bottom ~20% — this is a band-wide vignette
 * on top of the whole gallery, distinct from each tile's own small
 * bottom-fade inside auth-gallery.tsx — so the gallery's lower edge
 * blends into the page background instead of ending in a hard line.
 * `bg-background` (not a literal black) so this still looks correct if
 * the theme is ever switched to light. Rendered after <AuthGallery> in
 * the DOM so it paints on top without needing an explicit z-index.
 *
 * <AuthBackdrop> is the big soft color-field glow behind the form (see
 * that file) — rendered inside the top content wrapper only, so it's
 * confined above the gallery band and never overlaps or alters the
 * gallery's own look/animation.
 */
export async function AuthPageLayout({ children }: { children: React.ReactNode }) {
  const [images, settings] = await Promise.all([getActiveAuthGalleryImages(), getAuthGallerySettings()]);
  const showGallery = settings.isEnabled && images.length > 0;

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-8">
        <AuthBackdrop />
        {children}
      </div>
      {showGallery && (
        <div className="relative h-[26vh] min-h-[170px] shrink-0 sm:h-[36vh] md:h-[42vh] lg:h-[45vh]">
          <AuthGallery images={images} className="absolute inset-0" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/5 bg-gradient-to-t from-background to-transparent" />
        </div>
      )}
    </div>
  );
}
