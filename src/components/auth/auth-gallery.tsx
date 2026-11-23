"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import type { AuthGalleryImage } from "@/types/auth-gallery";

// Halved again per explicit request (56s -> 112s): same distance per
// loop, twice the duration, i.e. half the px/s once more (a quarter of
// the original 28s speed overall).
const DURATION_SECONDS = 112;

// Generous enough to overflow any realistic viewport width (including
// ultra-wide desktop monitors) from the very first frame, same reasoning
// as dashboard-marquee.tsx's own REPEAT_COUNT — a short admin-configured
// image list (as few as 2) still needs to tile out far past 100vw before
// the loop's 50% duplicate boundary, or the band would show a gap on a
// wide screen while still catching up to a full row.
const MIN_TILES = 34;

// Fixed seed (never Math.random()) so the per-tile aspect / height / gap
// sequence below is identical on the server-rendered HTML and the client
// hydration pass, and identical again on every re-render in between — a
// real random source would cause a hydration mismatch and a layout that
// visibly jumps every time React re-renders.
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

/** Card aspect ratios a tile can take, as a CSS `aspect-ratio` string
 * (width / height) and that same ratio as a number — width is derived
 * from the tile's height and this ratio, never set directly, so every
 * tile stays a clean, undistorted crop regardless of shape. Weighted so
 * most tiles are square/portrait, with landscape/wide ones mixed in
 * more sparingly. Height is picked independently (see pickHeightPct) so
 * a "tall" column and a short one can each be any aspect. */
const ASPECTS = [
  { key: "square", aspect: "1 / 1", ratio: 1, weight: 5 },
  { key: "portrait", aspect: "3 / 4", ratio: 3 / 4, weight: 4 },
  { key: "narrow", aspect: "2 / 3", ratio: 2 / 3, weight: 2 },
  { key: "landscape", aspect: "4 / 3", ratio: 4 / 3, weight: 2 },
  { key: "wide", aspect: "16 / 9", ratio: 16 / 9, weight: 1 },
] as const;

const TOTAL_ASPECT_WEIGHT = ASPECTS.reduce((sum, a) => sum + a.weight, 0);

function pickAspect(random: () => number, avoidKey: string | null) {
  // Re-roll (bounded) rather than pick the same aspect 3 times running —
  // keeps the sequence looking organic instead of accidentally regular.
  for (let attempt = 0; attempt < 4; attempt++) {
    let roll = random() * TOTAL_ASPECT_WEIGHT;
    for (const aspect of ASPECTS) {
      roll -= aspect.weight;
      if (roll <= 0) {
        if (aspect.key !== avoidKey || attempt === 3) return aspect;
        break;
      }
    }
  }
  return ASPECTS[0];
}

/** When the image's own dimensions are known, pick the aspect closest
 * to the image's actual aspect ratio instead of a blind weighted pick.
 * This matters most for small icon-style artwork centered on a mostly-
 * empty canvas (the original seed tiles): forcing one of those into a
 * very different aspect ratio crops the actual illustration out of
 * frame, leaving only its plain background visible — which reads as an
 * empty tile even though it technically has an image in it. A real
 * uploaded photo (no stored dimensions yet, or one that fills its frame
 * edge-to-edge) falls back to the ordinary weighted-random pick, where
 * any crop still shows real content. */
function pickAspectForImage(image: AuthGalleryImage, random: () => number, avoidKey: string | null) {
  if (!image.imageWidth || !image.imageHeight) return pickAspect(random, avoidKey);

  const nativeRatio = image.imageWidth / image.imageHeight;
  const ranked = [...ASPECTS].sort(
    (a, b) => Math.abs(Math.log(a.ratio / nativeRatio)) - Math.abs(Math.log(b.ratio / nativeRatio)),
  );
  if (ranked[0].key !== avoidKey) return ranked[0];
  return ranked.find((aspect) => aspect.key !== avoidKey) ?? ranked[0];
}

// Tile heights vary tile-to-tile between these bounds, as a percentage
// of the row's own height — bottom-aligned (see GalleryTile), so the
// tallest tiles reach almost to the top of the band and the shortest
// ones still sit flush with the bottom, producing the reference's
// uneven "skyline"/bar-chart silhouette that fills the footer edge to
// edge rather than leaving empty space above a row of same-height
// tiles.
const MIN_HEIGHT_PCT = 34;
const MAX_HEIGHT_PCT = 96;

function pickHeightPct(random: () => number) {
  return MIN_HEIGHT_PCT + random() * (MAX_HEIGHT_PCT - MIN_HEIGHT_PCT);
}

type TileLayout = {
  image: AuthGalleryImage;
  aspect: (typeof ASPECTS)[number];
  heightPct: number;
  gapPx: number;
};

/** Builds a deterministic-but-irregular tile sequence: repeats the
 * admin's (possibly short) image list until there are at least
 * MIN_TILES tiles, then assigns each one an aspect ratio, a height, and
 * a slightly jittered gap to the next tile — shape, height AND spacing
 * all vary, matching "ngẫu nhiên có kiểm soát" rather than a uniform
 * grid or a repeating cycle. */
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
    const aspect = pickAspectForImage(image, random, runLength >= 2 ? runKey : null);
    if (aspect.key === runKey) {
      runLength++;
    } else {
      runKey = aspect.key;
      runLength = 1;
    }

    const heightPct = pickHeightPct(random);
    const gapPx = 14 + Math.round(random() * 22); // ~14-36px, varies tile-to-tile

    layout.push({ image, aspect, heightPct, gapPx });
  }

  return layout;
}

function GalleryTile({ layout }: { layout: TileLayout }) {
  const { image, aspect, heightPct, gapPx } = layout;
  return (
    <div className="flex h-full shrink-0 items-end" style={{ marginRight: `${gapPx}px` }}>
      <div
        className="relative overflow-hidden rounded-2xl border border-cyan-400/60"
        style={{
          height: `calc(${heightPct}% * var(--shape-scale, 1))`,
          aspectRatio: aspect.aspect,
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
 * Every tile is bottom-aligned (`items-end`, no vertical centering or
 * offset) and has its own height picked independently of its aspect
 * ratio (MIN_HEIGHT_PCT..MAX_HEIGHT_PCT) — this is what produces the
 * reference's uneven skyline/bar-chart silhouette, flush with the
 * bottom of the band and reaching close to its top at the tallest
 * points, rather than a row of tiles vertically centered with empty
 * space above and below all of them. Aspect assignment prefers
 * whichever option is closest to the image's own stored aspect ratio
 * (pickAspectForImage) rather than a pure blind pick — a small icon-
 * style illustration on a mostly-empty canvas forced into a very
 * different aspect ratio can get `object-cover`-cropped down to just
 * its plain background, which reads as an empty tile even though an
 * image is technically there. Real photos only — every tile renders
 * the admin's actual `imageUrl`, never a drawn shape/icon in its place.
 * Images are NOT lazy-loaded: every tile is "above the fold" from the
 * first frame by construction (buildTileLayout pre-fills the whole
 * width), so lazy-loading them would just mean a visible pop-in instead
 * of starting fully populated — the explicit requirement that the
 * gallery never starts empty. Tile layout size comes entirely from CSS
 * (percentage height + aspect-ratio), never from the image's own
 * intrinsic size, so there's no layout shift as each `<img>` finishes
 * loading. On narrow (mobile) viewports every tile shrinks together via
 * the `--shape-scale` CSS custom property (0.78 under `max-sm:`) —
 * shrinking only ever reduces how close the tallest tiles get to the
 * top of the band, it can never cause overlap or overflow since every
 * tile stays anchored to the same bottom edge.
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
          className="marquee-row flex h-full w-max items-end animate-marquee [animation-direction:reverse] group-hover/gallery:[animation-play-state:paused]"
          style={{ "--marquee-duration": `${DURATION_SECONDS}s` } as React.CSSProperties}
        >
          {[0, 1].map((copy) => (
            <div key={copy} className="flex h-full shrink-0 items-end">
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
