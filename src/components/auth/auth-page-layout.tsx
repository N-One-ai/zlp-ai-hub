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
 * <AuthBackdrop> (the big soft color-field glow, see that file) is
 * rendered ONCE here, on the outermost wrapper — not inside the top
 * content div — specifically so it spans the FULL page height,
 * including behind the gallery band. Confining it to only the area
 * above the gallery (an earlier version did this) left the gallery's
 * own region showing nothing but the page's flat `--background` with
 * no gradient reaching it at all — a visible seam/hard rectangle where
 * the gradient-lit top area met the plain-black bottom area, which is
 * exactly the "dải đen" this was reported against. Neither the gallery
 * band's own wrapper nor <AuthGallery>'s internal containers set an
 * opaque background, so with the backdrop now behind the whole page,
 * its color shows through normally in the gaps between tiles and
 * around the band, same as it does behind the form above. Everything
 * about the gallery itself — tiles, stroke, spacing, column heights,
 * animation/speed — is untouched; only what's visible *around* it
 * changes. `-z-10` keeps it behind both the form content and the
 * gallery regardless of DOM order.
 */
export async function AuthPageLayout({ children }: { children: React.ReactNode }) {
  const [images, settings] = await Promise.all([getActiveAuthGalleryImages(), getAuthGallerySettings()]);
  const showGallery = settings.isEnabled && images.length > 0;

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      <AuthBackdrop />
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-8">{children}</div>
      {showGallery && (
        <div className="relative h-[26vh] min-h-[170px] shrink-0 sm:h-[36vh] md:h-[42vh] lg:h-[45vh]">
          <AuthGallery images={images} className="absolute inset-0" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/5 bg-gradient-to-t from-background to-transparent" />
        </div>
      )}
    </div>
  );
}
