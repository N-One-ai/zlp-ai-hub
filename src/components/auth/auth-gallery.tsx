"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import type { AuthGalleryImage } from "@/types/auth-gallery";

// Halved speed vs. the previous single-track version (28s -> 56s): same
// distance per loop, twice the duration, i.e. half the px/s.
const DURATION_SECONDS = 56;

// 1 image, then 2 stacked, then 1, then 2, ... — the "1-2-1-2" rhythm.
// A slot's length is how many images it consumes from the flat list.
const CLUSTER_PATTERN = [1, 2];

// Generous enough to overflow any realistic viewport width (including
// ultra-wide desktop monitors) from the very first frame, same reasoning
// as dashboard-marquee.tsx's own REPEAT_COUNT — a short admin-configured
// image list (as few as 2) still needs to tile out far past 100vw before
// the loop's 50% duplicate boundary, or the band would show a gap on a
// wide screen while still catching up to a full row.
const MIN_SLOTS = 20;

// Every tile (whether alone in a 1-slot or paired in a 2-slot) is the
// same square size, as a percentage of the row's height — "cùng kích
// thước vuông" regardless of slot type.
const TILE_HEIGHT_PCT = 40;

// Per-slot vertical offset, as a fraction of the SLOT WRAPPER's own
// height (the wrapper is always h-full, i.e. the row's full height, for
// both 1-tile and 2-tile slots) — cycled across slots for the "cao thấp
// xen kẽ" rhythm. A 1-tile slot's content (40% of row, centered) has
// ±30% headroom either side; a 2-tile slot's content (2×40% + a small
// gap, roughly 85-90% of row) has much less headroom, so some clipping
// at the top/bottom of the gallery band is expected for tall 2-slots —
// handled by the existing `overflow-hidden` on the gallery root, per the
// explicit "xử lý bằng clipping/mask gọn gàng" instruction rather than
// shrinking the tiles themselves.
const OFFSET_PATTERN = [0, 0.16, -0.12, 0.1, -0.16, 0.08];

/** Splits the admin's (possibly short) image list into 1-2-1-2 slots,
 * repeating the source list as needed so there are always at least
 * MIN_SLOTS slots — enough to tile densely past any realistic viewport
 * width on the very first frame. */
function buildClusterSlots(images: AuthGalleryImage[]): AuthGalleryImage[][] {
  if (images.length === 0) return [];

  const avgImagesPerSlot = CLUSTER_PATTERN.reduce((sum, n) => sum + n, 0) / CLUSTER_PATTERN.length;
  const neededImages = Math.ceil(MIN_SLOTS * avgImagesPerSlot);
  const repeats = Math.ceil(neededImages / images.length);
  const flat = Array.from({ length: repeats }, () => images).flat();

  const slots: AuthGalleryImage[][] = [];
  let cursor = 0;
  let patternIndex = 0;
  while (slots.length < MIN_SLOTS) {
    const count = CLUSTER_PATTERN[patternIndex % CLUSTER_PATTERN.length];
    const slotImages: AuthGalleryImage[] = [];
    for (let k = 0; k < count; k++) {
      slotImages.push(flat[cursor % flat.length]);
      cursor++;
    }
    slots.push(slotImages);
    patternIndex++;
  }
  return slots;
}

function SquareTile({ image }: { image: AuthGalleryImage }) {
  return (
    <div className="aspect-square shrink-0 overflow-hidden rounded-xl ring-1 ring-border/70" style={{ height: `${TILE_HEIGHT_PCT}%` }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- admin-managed public URLs (Storage public bucket or static /auth/gallery asset); eager-loaded on purpose, see component docstring */}
      <img src={image.imageUrl} alt="" aria-hidden="true" className="size-full object-cover" decoding="async" />
    </div>
  );
}

/** One slot of the 1-2-1-2 pattern: a single square tile, or two square
 * tiles stacked vertically (same tile size as a single slot). The whole
 * slot wrapper carries the vertical offset, so a stacked pair moves as
 * one rhythmic unit rather than each tile offsetting independently. */
function Slot({ images, offsetIndex }: { images: AuthGalleryImage[]; offsetIndex: number }) {
  const offsetFraction = OFFSET_PATTERN[offsetIndex % OFFSET_PATTERN.length];
  const style = {
    transform: `translateY(calc(${offsetFraction} * var(--stagger-scale, 1) * 100%))`,
  };

  if (images.length === 1) {
    return (
      <div className="flex h-full shrink-0 items-center justify-center" style={style}>
        <SquareTile image={images[0]} />
      </div>
    );
  }

  return (
    <div className="flex h-full shrink-0 flex-col items-center justify-center gap-3" style={style}>
      {images.map((image, i) => (
        <SquareTile key={i} image={image} />
      ))}
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
 * Slots follow a 1-2-1-2 rhythm (CLUSTER_PATTERN): every other slot is a
 * single square tile, the ones in between are two square tiles stacked
 * vertically — all tiles the same size, rounded, with a thin stroke.
 * Each slot (not each tile) carries its own vertical offset for the
 * alternating high/low cadence. Images are NOT lazy-loaded: every tile
 * is "above the fold" from the first frame by construction
 * (buildClusterSlots pre-fills the whole width), so lazy-loading them
 * would just mean a visible pop-in instead of starting fully populated —
 * the explicit requirement that the gallery never starts empty. Tile
 * layout size comes entirely from CSS (percentage height + aspect-
 * square), never from the image's own intrinsic size, so there's no
 * layout shift as each `<img>` finishes loading.
 */
export function AuthGallery({ images, className }: { images: AuthGalleryImage[]; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const slots = useMemo(() => buildClusterSlots(images), [images]);

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

  if (slots.length === 0) return null;

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
         * right-to-left. Both copies are already fully built
         * (buildClusterSlots), so the very first frame is already a
         * completely filled band, not an empty one animating into view. */}
        <div
          className="marquee-row flex h-full w-max items-center gap-5 animate-marquee [animation-direction:reverse] group-hover/gallery:[animation-play-state:paused]"
          style={{ "--marquee-duration": `${DURATION_SECONDS}s` } as React.CSSProperties}
        >
          {[0, 1].map((copy) => (
            <div key={copy} className="flex h-full shrink-0 items-center gap-5 pr-5">
              {slots.map((slotImages, i) => (
                <Slot key={`${copy}-${i}`} images={slotImages} offsetIndex={i} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
