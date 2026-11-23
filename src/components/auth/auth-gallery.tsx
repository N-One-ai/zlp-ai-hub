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
const MIN_COLUMNS = 26;

// Every column (single tile or double-stack) is separated from its
// neighbor by this exact gap, measured edge-to-edge — "khoảng cách...
// phải bằng nhau... tính theo mép thẻ, không theo tâm". No per-column
// jitter anymore: a fixed gap is what makes every column, regardless of
// its own width or whether it's a single/double, read as evenly spaced.
const GAP_PX = 22;

// Fixed seed (never Math.random()) so the column-type / aspect / height
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

/** Card aspect ratios a SINGLE column's tile can take, as a CSS
 * `aspect-ratio` string (width / height) and that same ratio as a
 * number — width is derived from the tile's height and this ratio,
 * never set directly, so every tile stays a clean, undistorted crop
 * regardless of shape. Weighted so most tiles are square/portrait, with
 * landscape/wide ones mixed in more sparingly. Height is picked
 * independently (see pickHeightPct) so a "tall" column and a short one
 * can each be any aspect. Double columns always use the "square" entry
 * for both of their tiles (see buildColumnLayout) — that's what keeps
 * the two tiles in a double column the same size as each other. */
const ASPECTS = [
  { key: "square", aspect: "1 / 1", ratio: 1, weight: 5 },
  { key: "portrait", aspect: "3 / 4", ratio: 3 / 4, weight: 4 },
  { key: "narrow", aspect: "2 / 3", ratio: 2 / 3, weight: 2 },
  { key: "landscape", aspect: "4 / 3", ratio: 4 / 3, weight: 2 },
  { key: "wide", aspect: "16 / 9", ratio: 16 / 9, weight: 1 },
] as const;

const SQUARE_ASPECT = ASPECTS[0];
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

// Single-column heights vary column-to-column between these bounds, as
// a percentage of the row's own height — bottom-aligned (see
// GalleryColumn), so the tallest columns reach almost to the top of the
// band and the shortest still sit flush with the bottom, producing the
// skyline/bar-chart silhouette that fills the footer edge to edge.
const MIN_HEIGHT_PCT = 34;
const MAX_HEIGHT_PCT = 96;

function pickHeightPct(random: () => number) {
  return MIN_HEIGHT_PCT + random() * (MAX_HEIGHT_PCT - MIN_HEIGHT_PCT);
}

// Both tiles in a double column are this height (% of row height),
// stacked with a small fixed gap — kept modest so the pair's total
// height (2x this + the stack gap) comfortably clears MAX_HEIGHT_PCT,
// never the tallest thing in the band.
const DOUBLE_TILE_HEIGHT_PCT = 38;

type SingleColumn = { type: "single"; image: AuthGalleryImage; aspect: (typeof ASPECTS)[number]; heightPct: number };
type DoubleColumn = { type: "double"; images: [AuthGalleryImage, AuthGalleryImage]; heightPct: number };
type ColumnLayout = SingleColumn | DoubleColumn;

/** Builds a deterministic-but-irregular column sequence: repeats the
 * admin's (possibly short) image list as needed, then walks MIN_COLUMNS
 * slots where every 2nd-or-3rd single column is replaced by a double
 * column (two square tiles stacked) — "cứ khoảng 2-3 ảnh/cột đơn thì
 * chèn một cột đôi". Single columns vary in aspect and height
 * ("cột đơn cao/thấp... có chủ đích"); double columns are always two
 * same-size squares. Computed once from a fixed seed off the `images`
 * prop (see LAYOUT_SEED), so it's stable across re-renders and
 * identical in both halves of the marquee's back-to-back loop. */
function buildColumnLayout(images: AuthGalleryImage[]): ColumnLayout[] {
  if (images.length === 0) return [];

  const random = mulberry32(LAYOUT_SEED);

  // Decide the single/double sequence first, so we know exactly how
  // many images it needs before slicing the repeated list.
  const columnTypes: ("single" | "double")[] = [];
  while (columnTypes.length < MIN_COLUMNS) {
    const runLength = 2 + Math.floor(random() * 2); // 2 or 3 singles...
    for (let i = 0; i < runLength && columnTypes.length < MIN_COLUMNS; i++) columnTypes.push("single");
    if (columnTypes.length < MIN_COLUMNS) columnTypes.push("double"); // ...then one double column
  }

  const neededImages = columnTypes.reduce((sum, t) => sum + (t === "double" ? 2 : 1), 0);
  const repeats = Math.ceil(neededImages / images.length);
  const flat = Array.from({ length: repeats }, () => images).flat();

  const layout: ColumnLayout[] = [];
  let cursor = 0;
  let runKey: string | null = null;
  let runLength = 0;

  for (const type of columnTypes) {
    if (type === "double") {
      const a = flat[cursor % flat.length];
      cursor++;
      const b = flat[cursor % flat.length];
      cursor++;
      layout.push({ type: "double", images: [a, b], heightPct: DOUBLE_TILE_HEIGHT_PCT });
      continue;
    }

    const image = flat[cursor % flat.length];
    cursor++;
    const aspect = pickAspectForImage(image, random, runLength >= 2 ? runKey : null);
    if (aspect.key === runKey) {
      runLength++;
    } else {
      runKey = aspect.key;
      runLength = 1;
    }
    layout.push({ type: "single", image, aspect, heightPct: pickHeightPct(random) });
  }

  return layout;
}

function TileBox({ image, aspect, heightPct }: { image: AuthGalleryImage; aspect: string; heightPct: number }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-cyan-400/60"
      style={{
        height: `calc(${heightPct}% * var(--shape-scale, 1))`,
        aspectRatio: aspect,
        boxShadow: "0 0 14px rgba(45, 212, 191, 0.22)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- admin-managed public URLs (Storage public bucket or static /auth/gallery asset); eager-loaded on purpose, see component docstring */}
      <img src={image.imageUrl} alt="" aria-hidden="true" className="size-full object-cover" decoding="async" />
      {/* Subtle bottom fade only — never dark enough to obscure most of the photo. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/25 to-transparent" />
    </div>
  );
}

// The fixed, mobile-scaled gap applied after every column — same value
// whether the column to its left/right is single or double, which is
// what keeps edge-to-edge spacing uniform across the whole strip.
const columnGapStyle: React.CSSProperties = { marginRight: `calc(${GAP_PX}px * var(--shape-scale, 1))` };

function GalleryColumn({ column }: { column: ColumnLayout }) {
  if (column.type === "single") {
    return (
      <div className="flex h-full shrink-0 items-end" style={columnGapStyle}>
        <TileBox image={column.image} aspect={column.aspect.aspect} heightPct={column.heightPct} />
      </div>
    );
  }

  return (
    <div className="flex h-full shrink-0 flex-col items-center justify-end gap-3" style={columnGapStyle}>
      <TileBox image={column.images[0]} aspect={SQUARE_ASPECT.aspect} heightPct={column.heightPct} />
      <TileBox image={column.images[1]} aspect={SQUARE_ASPECT.aspect} heightPct={column.heightPct} />
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
 * The strip is a sequence of COLUMNS, each either a single tile or a
 * double column (two equal-size square tiles stacked, gap-3 between
 * them) — buildColumnLayout inserts a double column after every run of
 * 2-3 singles. Every column (whichever kind) is bottom-aligned and
 * separated from its neighbor by the exact same GAP_PX, so edge-to-edge
 * spacing never varies by column size or type. Single-column height
 * varies independently of its aspect ratio (MIN_HEIGHT_PCT..
 * MAX_HEIGHT_PCT) for the skyline silhouette; aspect assignment prefers
 * whichever option is closest to the image's own stored aspect ratio
 * (pickAspectForImage) rather than a pure blind pick — a small icon-
 * style illustration on a mostly-empty canvas forced into a very
 * different aspect ratio can get `object-cover`-cropped down to just
 * its plain background, which reads as an empty tile even though an
 * image is technically there. Real photos only — every tile renders the
 * admin's actual `imageUrl`, never a drawn shape/icon in its place.
 * Images are NOT lazy-loaded: every tile is "above the fold" from the
 * first frame by construction (buildColumnLayout pre-fills the whole
 * width), so lazy-loading them would just mean a visible pop-in instead
 * of starting fully populated — the explicit requirement that the
 * gallery never starts empty. Tile layout size comes entirely from CSS
 * (percentage height + aspect-ratio), never from the image's own
 * intrinsic size, so there's no layout shift as each `<img>` finishes
 * loading. On narrow (mobile) viewports every tile AND the gap between
 * columns shrink together via the `--shape-scale` CSS custom property
 * (0.78 under `max-sm:`) — spacing stays proportionally even, and since
 * every column still anchors to the same bottom edge, shrinking can
 * never cause overlap or page-level horizontal overflow (the strip
 * itself scrolls inside its own `overflow-hidden` ancestors, same as
 * before).
 */
export function AuthGallery({ images, className }: { images: AuthGalleryImage[]; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const columns = useMemo(() => buildColumnLayout(images), [images]);

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

  if (columns.length === 0) return null;

  return (
    <div ref={rootRef} aria-hidden="true" className={cn("group/gallery overflow-hidden max-sm:[--shape-scale:0.78]", className)}>
      <div className="h-full overflow-hidden opacity-90 transition-opacity group-hover/gallery:opacity-100">
        {/* Two copies back-to-back, animated exactly -50% -> 0% so the loop
         * point is invisible — same technique as dashboard-marquee.tsx, just
         * played in `reverse` so it moves left-to-right instead of
         * right-to-left. Both copies are already fully built
         * (buildColumnLayout), so the very first frame is already a
         * completely filled band, not an empty one animating into view. */}
        <div
          className="marquee-row flex h-full w-max items-end animate-marquee [animation-direction:reverse] group-hover/gallery:[animation-play-state:paused]"
          style={{ "--marquee-duration": `${DURATION_SECONDS}s` } as React.CSSProperties}
        >
          {[0, 1].map((copy) => (
            <div key={copy} className="flex h-full shrink-0 items-end">
              {columns.map((column, i) => (
                <GalleryColumn key={`${copy}-${i}`} column={column} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
