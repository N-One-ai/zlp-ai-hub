"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import type { AuthGalleryImage } from "@/types/auth-gallery";

// Halved speed vs. the original single-track version (28s -> 56s): same
// distance per loop, twice the duration, i.e. half the px/s. Keep as-is —
// this was an explicit "don't speed it back up" requirement.
const DURATION_SECONDS = 56;

// Generous enough to overflow any realistic viewport width (including
// ultra-wide desktop monitors) from the very first frame, same reasoning
// as dashboard-marquee.tsx's own REPEAT_COUNT — a short admin-configured
// image list (as few as 2) still needs to tile out far past 100vw before
// the loop's 50% duplicate boundary, or the band would show a gap on a
// wide screen while still catching up to a full row. Higher than the
// previous uniform-square version since a mix of landscape/wide cards
// adds less width per unit height than a column of squares would.
const MIN_TILES = 34;

// Fixed seed (never Math.random()) so the per-tile shape / vertical
// offset / gap sequence below is identical on the server-rendered HTML
// and the client hydration pass, and identical again on every re-render
// in between — a real random source would cause a hydration mismatch
// and a layout that visibly jumps every time React re-renders.
const LAYOUT_SEED = 20260207;

function mulberry32(seed: number) {
  let t = seed;
  return function random() {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Card shapes a tile can take, as a height (percentage of the row's
 * full height), a CSS `aspect-ratio` string (width / height) and that
 * same ratio as a number — width is derived from these, never set
 * directly, so every tile stays a clean, undistorted crop regardless of
 * shape. Weighted so most tiles are square/portrait like the reference,
 * with landscape/wide ones mixed in more sparingly. */
const SHAPES = [
  { key: "square", heightPct: 44, aspect: "1 / 1", ratio: 1, weight: 5 },
  { key: "portrait", heightPct: 58, aspect: "3 / 4", ratio: 3 / 4, weight: 4 },
  { key: "tall", heightPct: 70, aspect: "2 / 3", ratio: 2 / 3, weight: 2 },
  { key: "landscape", heightPct: 36, aspect: "4 / 3", ratio: 4 / 3, weight: 2 },
  { key: "wide", heightPct: 30, aspect: "16 / 9", ratio: 16 / 9, weight: 1 },
] as const;

const TOTAL_SHAPE_WEIGHT = SHAPES.reduce((sum, s) => sum + s.weight, 0);

function pickShape(random: () => number, avoidKey: string | null) {
  // Re-roll (bounded) rather than pick the same shape 3 times running —
  // keeps the "controlled random" skyline from accidentally going flat.
  for (let attempt = 0; attempt < 4; attempt++) {
    let roll = random() * TOTAL_SHAPE_WEIGHT;
    for (const shape of SHAPES) {
      roll -= shape.weight;
      if (roll <= 0) {
        if (shape.key !== avoidKey || attempt === 3) return shape;
        break;
      }
    }
  }
  return SHAPES[0];
}

/** When the image's own dimensions are known, pick the shape whose
 * aspect ratio is closest to the image's actual aspect ratio instead of
 * a blind weighted pick. This matters most for small icon-style
 * artwork centered on a mostly-empty canvas (the original seed tiles):
 * forcing one of those into a very different aspect ratio crops the
 * actual illustration out of frame, leaving only its plain background
 * visible — which reads as an empty tile even though it technically has
 * an image in it. A real uploaded photo (no stored dimensions yet, or
 * one that fills its frame edge-to-edge) falls back to the ordinary
 * weighted-random pick, where any crop still shows real content. */
function pickShapeForImage(image: AuthGalleryImage, random: () => number, avoidKey: string | null) {
  if (!image.imageWidth || !image.imageHeight) return pickShape(random, avoidKey);

  const nativeRatio = image.imageWidth / image.imageHeight;
  const ranked = [...SHAPES].sort(
    (a, b) => Math.abs(Math.log(a.ratio / nativeRatio)) - Math.abs(Math.log(b.ratio / nativeRatio)),
  );
  if (ranked[0].key !== avoidKey) return ranked[0];
  return ranked.find((shape) => shape.key !== avoidKey) ?? ranked[0];
}

type TileLayout = {
  image: AuthGalleryImage;
  shape: (typeof SHAPES)[number];
  offsetFraction: number;
  gapPx: number;
};

/** Builds a deterministic-but-irregular tile sequence: repeats the
 * admin's (possibly short) image list until there are at least
 * MIN_TILES tiles, then assigns each one a shape, a vertical offset
 * (bounded so it never clips the band, computed from that shape's own
 * headroom), and a slightly jittered gap to the next tile — height,
 * vertical position AND spacing all vary, matching "ngẫu nhiên có kiểm
 * soát" rather than a uniform grid or a repeating cycle. */
function buildTileLayout(images: AuthGalleryImage[]): TileLayout[] {
  if (images.length === 0) return [];

  const random = mulberry32(LAYOUT_SEED);
  const repeats = Math.ceil(MIN_TILES / images.length);
  const flat = Array.from({ length: repeats }, () => images).flat();

  const layout: TileLayout[] = [];
  let runKey: string | null = null;
  let runLength = 0;

  for (let i = 0; i < MIN_TILES; i++) {
    const image = flat[i % flat.length];
    const shape = pickShapeForImage(image, random, runLength >= 2 ? runKey : null);
    if (shape.key === runKey) {
      runLength++;
    } else {
      runKey = shape.key;
      runLength = 1;
    }

    // Headroom is how far (as a fraction of the row's own height) this
    // shape's content can move up/down from center before touching the
    // top/bottom edge; a 10% safety margin keeps it short of that limit.
    const headroomFraction = (100 - shape.heightPct) / 2 / 100;
    const maxOffset = headroomFraction * 0.85;
    const offsetFraction = (random() * 2 - 1) * maxOffset;

    const gapPx = 14 + Math.round(random() * 22); // ~14-36px, varies tile-to-tile

    layout.push({ image, shape, offsetFraction, gapPx });
  }

  return layout;
}

function GalleryTile({ layout }: { layout: TileLayout }) {
  const { image, shape, offsetFraction, gapPx } = layout;
  return (
    <div
      className="flex h-full shrink-0 items-center justify-center"
      style={{ marginRight: `${gapPx}px`, transform: `translateY(${(offsetFraction * 100).toFixed(2)}%)` }}
    >
      <div
        className="relative overflow-hidden rounded-2xl border border-cyan-400/60"
        style={{
          height: `calc(${shape.heightPct}% * var(--shape-scale, 1))`,
          aspectRatio: shape.aspect,
          boxShadow: "0 0 14px rgba(45, 212, 191, 0.22)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- admin-managed public URLs (Storage public bucket or static /auth/gallery asset); eager-loaded on purpose, see component docstring */}
        <img src={image.imageUrl} alt="" aria-hidden="true" className="size-full object-cover" decoding="async" />
        {/* Subtle bottom fade only — never dark enough to obscure most of the photo. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/25 to-transparent" />
      </div>
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
 * at all via getAuthGallerySettings().isEnabled, and renders nothing here
 * (no geometric placeholder) when there are zero configured images — the
 * "trạng thái fallback tối giản" is simply not reserving the band at all,
 * handled one level up in AuthPageLayout. `prefers-reduced-motion` is
 * already handled globally in globals.css (collapses every animation to
 * a single frame), so no separate reduced-motion branch is needed here.
 *
 * Tiles vary in size (square/portrait/landscape/etc., buildTileLayout's
 * SHAPES), vertical offset and gap, in a deterministic-but-irregular
 * sequence rather than a repeating cycle or a uniform grid — this is
 * "ngẫu nhiên có kiểm soát": random-looking, but computed once from a
 * fixed seed off the `images` prop so the layout never jitters on a
 * re-render. Shape assignment prefers whichever option is closest to the
 * image's own stored aspect ratio (pickShapeForImage) rather than a pure
 * blind pick — a small icon-style illustration on a mostly-empty canvas
 * forced into a very different aspect ratio can get `object-cover`-
 * cropped down to just its plain background, which reads as an empty
 * tile even though an image is technically there. Real photos only —
 * every tile renders the admin's actual
 * `imageUrl`, never a drawn shape/icon in its place. Images are NOT
 * lazy-loaded: every tile is "above the fold" from the first frame by
 * construction (buildTileLayout pre-fills the whole width), so lazy-
 * loading them would just mean a visible pop-in instead of starting
 * fully populated — the explicit requirement that the gallery never
 * starts empty. Tile layout size comes entirely from CSS (percentage
 * height + aspect-ratio), never from the image's own intrinsic size, so
 * there's no layout shift as each `<img>` finishes loading. On narrow
 * (mobile) viewports every tile shrinks together via the `--shape-scale`
 * CSS custom property (0.78 under `max-sm:`) — vertical offsets are
 * already expressed as a fraction of the row's own height rather than
 * the tile's, so shrinking tiles only adds headroom, it never pushes
 * anything toward overlapping or overflowing the band.
 */
export function AuthGallery({ images, className }: { images: AuthGalleryImage[]; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const tiles = useMemo(() => buildTileLayout(images), [images]);

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
    <div ref={rootRef} aria-hidden="true" className={cn("group/gallery overflow-hidden max-sm:[--shape-scale:0.78]", className)}>
      <div className="h-full overflow-hidden opacity-90 transition-opacity group-hover/gallery:opacity-100">
        {/* Two copies back-to-back, animated exactly -50% -> 0% so the loop
         * point is invisible — same technique as dashboard-marquee.tsx, just
         * played in `reverse` so it moves left-to-right instead of
         * right-to-left. Both copies are already fully built
         * (buildTileLayout), so the very first frame is already a
         * completely filled band, not an empty one animating into view. */}
        <div
          className="marquee-row flex h-full w-max items-center animate-marquee [animation-direction:reverse] group-hover/gallery:[animation-play-state:paused]"
          style={{ "--marquee-duration": `${DURATION_SECONDS}s` } as React.CSSProperties}
        >
          {[0, 1].map((copy) => (
            <div key={copy} className="flex h-full shrink-0 items-center">
              {tiles.map((layout, i) => (
                <GalleryTile key={`${copy}-${i}`} layout={layout} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
