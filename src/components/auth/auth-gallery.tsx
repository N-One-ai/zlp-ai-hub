"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import type { AuthGalleryImage } from "@/types/auth-gallery";

// Halved speed vs. the original single-track version (28s -> 56s): same
// distance per loop, twice the duration, i.e. half the px/s.
const DURATION_SECONDS = 56;

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

// Fixed seed (never Math.random()) so the "random-looking" 1-vs-2
// sequence below is identical on the server-rendered HTML and the
// client hydration pass — a real random source here would cause a
// hydration mismatch, since this component's initial render has no
// user interaction to justify differing from the server.
const PATTERN_SEED = 20260207;

function mulberry32(seed: number) {
  let t = seed;
  return function random() {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic, irregular sequence of slot sizes (1 or 2 images per
 * slot) — mostly single tiles with doubled tiles mixed in at random
 * (not a repeating 1-2-1-2 cycle), matching the reference's uneven
 * "skyline" look. Allows up to 2 of the same size back-to-back (so the
 * sequence still looks organic, not strictly alternating) but forbids a
 * 3rd in a row, so it never goes flat for too long either. */
function buildSlotPattern(length: number): number[] {
  const random = mulberry32(PATTERN_SEED);
  const pattern: number[] = [];
  let prev = 0;
  let runLength = 0;
  for (let i = 0; i < length; i++) {
    let count = random() < 0.65 ? 1 : 2;
    if (count === prev) {
      runLength++;
      if (runLength > 2) {
        count = prev === 1 ? 2 : 1;
        runLength = 1;
      }
    } else {
      runLength = 1;
    }
    prev = count;
    pattern.push(count);
  }
  return pattern;
}

/** Splits the admin's (possibly short) image list into slots sized per
 * buildSlotPattern, repeating the source list as needed so there are
 * always at least MIN_SLOTS slots — enough to tile densely past any
 * realistic viewport width on the very first frame. */
function buildClusterSlots(images: AuthGalleryImage[]): AuthGalleryImage[][] {
  if (images.length === 0) return [];

  const pattern = buildSlotPattern(MIN_SLOTS);
  const neededImages = pattern.reduce((sum, n) => sum + n, 0);
  const repeats = Math.ceil(neededImages / images.length);
  const flat = Array.from({ length: repeats }, () => images).flat();

  const slots: AuthGalleryImage[][] = [];
  let cursor = 0;
  for (const count of pattern) {
    const slotImages: AuthGalleryImage[] = [];
    for (let k = 0; k < count; k++) {
      slotImages.push(flat[cursor % flat.length]);
      cursor++;
    }
    slots.push(slotImages);
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

/** One slot: a single square tile, or two square tiles stacked
 * vertically (same tile size as a single slot). The slot is always the
 * row's full height with its content pushed to the BOTTOM
 * (`justify-end`) — so a 1-tile slot sits flush with the bottom of a
 * neighboring 2-tile slot, exactly like blocks resting on a shared
 * baseline, rather than both being vertically centered. */
function Slot({ images }: { images: AuthGalleryImage[] }) {
  if (images.length === 1) {
    return (
      <div className="flex h-full shrink-0 flex-col items-center justify-end">
        <SquareTile image={images[0]} />
      </div>
    );
  }

  return (
    <div className="flex h-full shrink-0 flex-col items-center justify-end gap-3">
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
 * Slots are either a single square tile or two stacked vertically, in a
 * deterministic-but-irregular sequence (buildSlotPattern) rather than a
 * strict alternating cycle, and every slot's content sits flush with the
 * bottom of the band — a 1-tile slot is exactly as "low" as the bottom
 * tile of a neighboring 2-tile slot, producing the uneven skyline from
 * the reference instead of a row of vertically-centered tiles. Images
 * are NOT lazy-loaded: every tile is "above the fold" from the first
 * frame by construction (buildClusterSlots pre-fills the whole width),
 * so lazy-loading them would just mean a visible pop-in instead of
 * starting fully populated — the explicit requirement that the gallery
 * never starts empty. Tile layout size comes entirely from CSS
 * (percentage height + aspect-square), never from the image's own
 * intrinsic size, so there's no layout shift as each `<img>` finishes
 * loading.
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
    <div ref={rootRef} aria-hidden="true" className={cn("group/gallery overflow-hidden", className)}>
      <div className="h-full overflow-hidden opacity-80 transition-opacity group-hover/gallery:opacity-100">
        {/* Two copies back-to-back, animated exactly -50% -> 0% so the loop
         * point is invisible — same technique as dashboard-marquee.tsx, just
         * played in `reverse` so it moves left-to-right instead of
         * right-to-left. Both copies are already fully built
         * (buildClusterSlots), so the very first frame is already a
         * completely filled band, not an empty one animating into view. */}
        <div
          className="marquee-row flex h-full w-max items-end gap-5 animate-marquee [animation-direction:reverse] group-hover/gallery:[animation-play-state:paused]"
          style={{ "--marquee-duration": `${DURATION_SECONDS}s` } as React.CSSProperties}
        >
          {[0, 1].map((copy) => (
            <div key={copy} className="flex h-full shrink-0 items-end gap-5 pr-5">
              {slots.map((slotImages, i) => (
                <Slot key={`${copy}-${i}`} images={slotImages} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
