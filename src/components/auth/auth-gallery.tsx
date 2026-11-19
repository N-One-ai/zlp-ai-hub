"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import type { AuthGalleryImage } from "@/types/auth-gallery";

const DURATION_SECONDS = 28;

// Generous enough to overflow any realistic viewport width (including
// ultra-wide desktop monitors) from the very first frame, same reasoning
// as dashboard-marquee.tsx's own REPEAT_COUNT — a short admin-configured
// image list (as few as 2) still needs to tile out far past 100vw before
// the loop's 50% duplicate boundary, or the band would show a gap on a
// wide screen while still catching up to a full row.
const MIN_TILES = 28;

// Per-tile vertical offset, as a fraction of the tile's OWN height —
// cycled across tiles for the "cao thấp xen kẽ" rhythm. Each tile is
// rendered at TILE_HEIGHT_PCT of the row's height and vertically
// centered by the row (`items-center`), so ±(1 - TILE_HEIGHT_PCT) / 2 of
// the tile's own height is exactly the room available before a tile
// would clip the top/bottom of the band — these offsets stay inside
// that, confirmed against TILE_HEIGHT_PCT below so nothing is clipped.
const OFFSET_PATTERN = [0, 0.38, -0.22, 0.14, -0.38, 0.22, -0.1, 0.3];
const TILE_HEIGHT_PCT = 56; // leaves ±22% of the tile's own height as headroom either side

/** Repeats the admin's image list until it's at least MIN_TILES long —
 * short lists (as few as 1-2 images) still need to tile densely enough
 * to fill a wide screen on the very first frame. */
function buildTileSet(images: AuthGalleryImage[]): AuthGalleryImage[] {
  if (images.length === 0) return [];
  const repeats = Math.ceil(MIN_TILES / images.length);
  return Array.from({ length: repeats }, () => images).flat();
}

function Tile({ image, offsetIndex }: { image: AuthGalleryImage; offsetIndex: number }) {
  const offsetFraction = OFFSET_PATTERN[offsetIndex % OFFSET_PATTERN.length];
  return (
    <div
      className="aspect-square shrink-0 overflow-hidden rounded-xl ring-1 ring-border/70"
      style={{
        height: `${TILE_HEIGHT_PCT}%`,
        transform: `translateY(calc(${offsetFraction} * var(--stagger-scale, 1) * 100%))`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- admin-managed public URLs (Storage public bucket or static /auth/gallery asset); eager-loaded on purpose, see component docstring */}
      <img src={image.imageUrl} alt="" aria-hidden="true" className="size-full object-cover" decoding="async" />
    </div>
  );
}

/**
 * Purely decorative background gallery for /login and /register — never
 * hosts anything a screen reader or keyboard user needs (no links, no
 * unique content), so the whole thing is `aria-hidden` and outside tab
 * order. Pauses when the tab isn't visible (one shared `visibilitychange`
 * listener toggling a class, never per-frame JS) and on hover (plain CSS
 * `:hover`, no JS needed — there's no explicit "on focus" pause since the
 * whole thing is `aria-hidden` and has no focusable descendant to receive
 * focus). Images come from the admin-managed /auth-gallery list
 * (lib/auth-gallery/queries.ts) — the page decides whether to render this
 * at all via getAuthGallerySettings().isEnabled. `prefers-reduced-motion`
 * is already handled globally in globals.css (collapses every animation
 * to a single frame), so no separate reduced-motion branch is needed here.
 *
 * Single track, not several stacked rows — tiles stagger vertically
 * tile-to-tile (OFFSET_PATTERN) rather than row-to-row, matching the
 * reference's alternating high/low rhythm. Images are NOT lazy-loaded:
 * every tile is "above the fold" from the first frame by construction
 * (buildTileSet pre-fills the whole width), so lazy-loading them would
 * just mean a visible pop-in instead of starting fully populated — the
 * one explicit requirement here ("không để gallery trống rồi chờ ảnh
 * chạy vào"). Tile layout size comes entirely from CSS (percentage
 * height + aspect-square), never from the image's own intrinsic size, so
 * there's no layout shift as each `<img>` finishes loading.
 */
export function AuthGallery({ images, className }: { images: AuthGalleryImage[]; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const tiles = useMemo(() => buildTileSet(images), [images]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onVisibility = () => {
      el.classList.toggle("auth-gallery-paused", document.hidden);
    };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  if (tiles.length === 0) return null;

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className={cn("group/gallery overflow-hidden max-sm:[--stagger-scale:0.55]", className)}
    >
      <div className="h-full overflow-hidden opacity-80 transition-opacity group-hover/gallery:opacity-100">
        {/* Two copies back-to-back, animated exactly -50% -> 0% so the loop
         * point is invisible — same technique as dashboard-marquee.tsx, just
         * played in `reverse` so it moves left-to-right instead of
         * right-to-left. Both copies are already fully built (buildTileSet),
         * so the very first frame is already a completely filled band, not
         * an empty one animating into view. */}
        <div
          className="marquee-row flex h-full w-max items-center gap-5 animate-marquee [animation-direction:reverse] group-hover/gallery:[animation-play-state:paused]"
          style={{ "--marquee-duration": `${DURATION_SECONDS}s` } as React.CSSProperties}
        >
          {[0, 1].map((copy) => (
            <div key={copy} className="flex h-full shrink-0 items-center gap-5 pr-5">
              {tiles.map((image, i) => (
                <Tile key={`${copy}-${i}`} image={image} offsetIndex={i} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
