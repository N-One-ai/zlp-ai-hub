"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { GALLERY_ROWS, type GalleryTile } from "@/lib/auth/gallery-assets";

const ROW_DURATIONS_S = [52, 64, 46];
const ROW_HEIGHT_CLASSES = ["h-28 sm:h-36 md:h-44", "h-24 sm:h-32 md:h-40", "h-28 sm:h-36 md:h-44"];

function Tile({ tile }: { tile: GalleryTile }) {
  return (
    <div
      className="h-full shrink-0 overflow-hidden rounded-xl ring-1 ring-border/40"
      style={{ aspectRatio: `${tile.w} / ${tile.h}` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- small local static SVGs, optimization adds no benefit */}
      <img src={tile.src} alt="" aria-hidden="true" className="size-full object-cover" loading="lazy" decoding="async" />
    </div>
  );
}

function Row({ tiles, durationSeconds, heightClassName }: { tiles: GalleryTile[]; durationSeconds: number; heightClassName: string }) {
  return (
    <div className={cn("overflow-hidden", heightClassName)}>
      {/* Two copies back-to-back, animated exactly -50% -> 0% so the loop
       * point is invisible — same technique as dashboard-marquee.tsx, just
       * played in `reverse` so it moves left-to-right instead of right-to-left. */}
      <div
        className="marquee-row flex h-full w-max items-stretch gap-4 animate-marquee [animation-direction:reverse]"
        style={{ "--marquee-duration": `${durationSeconds}s` } as React.CSSProperties}
      >
        {[0, 1].map((copy) => (
          <div key={copy} className="flex h-full shrink-0 items-stretch gap-4 pr-4">
            {tiles.map((tile, i) => (
              <Tile key={`${copy}-${i}`} tile={tile} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Purely decorative background gallery for /register — never hosts
 * anything a screen reader or keyboard user needs (no links, no unique
 * content), so the whole thing is `aria-hidden` and outside tab order.
 * Pauses all rows when the tab isn't visible (via a shared CSS class
 * toggled from one `visibilitychange` listener) to avoid burning CPU/GPU
 * on an off-screen animation; `prefers-reduced-motion` is already handled
 * globally in globals.css (collapses every animation to a single frame),
 * so no separate reduced-motion branch is needed here.
 */
export function AuthGallery({ className }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden [mask-image:radial-gradient(ellipse_60%_55%_at_50%_42%,transparent_38%,black_78%)]",
        className
      )}
    >
      <div className="flex h-full flex-col justify-center gap-4 opacity-40 sm:opacity-55">
        {GALLERY_ROWS.map((tiles, i) => (
          // Mobile keeps only the first two rows — a shorter, lighter strip
          // that prioritizes the form, per spec ("giảm số hàng... trên mobile").
          <div key={i} className={i === 2 ? "hidden sm:block" : undefined}>
            <Row tiles={tiles} durationSeconds={ROW_DURATIONS_S[i]} heightClassName={ROW_HEIGHT_CLASSES[i]} />
          </div>
        ))}
      </div>
    </div>
  );
}
