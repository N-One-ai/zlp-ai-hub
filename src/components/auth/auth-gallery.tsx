"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import type { AuthGalleryImage } from "@/types/auth-gallery";

const ROW_DURATIONS_S = [52, 64, 46];

/** Splits the flat, admin-ordered image list into up to 3 rows (round-
 * robin, not contiguous chunks) so consecutive rows never look like a
 * scrolled copy of each other — same intent as the previous static
 * version's hand-picked per-row subsets, now derived from however many
 * images the admin actually configured. Each row needs at least 2 tiles
 * to loop convincingly; rows that would end up empty are dropped. */
function splitIntoRows(images: AuthGalleryImage[], rowCount: number): AuthGalleryImage[][] {
  const rows: AuthGalleryImage[][] = Array.from({ length: rowCount }, () => []);
  images.forEach((image, i) => rows[i % rowCount].push(image));
  return rows.filter((row) => row.length >= 2);
}

function Tile({ image }: { image: AuthGalleryImage }) {
  return (
    <div className="aspect-square h-full shrink-0 overflow-hidden rounded-xl ring-1 ring-border/40">
      {/* eslint-disable-next-line @next/next/no-img-element -- admin-managed public URLs (Storage public bucket or static /auth/gallery asset) */}
      <img src={image.imageUrl} alt="" aria-hidden="true" className="size-full object-cover" loading="lazy" decoding="async" />
    </div>
  );
}

function Row({ images, durationSeconds }: { images: AuthGalleryImage[]; durationSeconds: number }) {
  return (
    <div className="h-full overflow-hidden">
      {/* Two copies back-to-back, animated exactly -50% -> 0% so the loop
       * point is invisible — same technique as dashboard-marquee.tsx, just
       * played in `reverse` so it moves left-to-right instead of right-to-left. */}
      <div
        className="marquee-row flex h-full w-max items-stretch gap-4 animate-marquee [animation-direction:reverse] group-hover/gallery:[animation-play-state:paused]"
        style={{ "--marquee-duration": `${durationSeconds}s` } as React.CSSProperties}
      >
        {[0, 1].map((copy) => (
          <div key={copy} className="flex h-full shrink-0 items-stretch gap-4 pr-4">
            {images.map((image, i) => (
              <Tile key={`${copy}-${i}`} image={image} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Purely decorative background gallery for /login and /register — never
 * hosts anything a screen reader or keyboard user needs (no links, no
 * unique content), so the whole thing is `aria-hidden` and outside tab
 * order. Pauses all rows when the tab isn't visible (one shared
 * `visibilitychange` listener toggling a class, never per-frame JS) and
 * on hover (plain CSS `:hover`, no JS needed for that one — there's no
 * explicit "on focus" pause since the whole thing is `aria-hidden` and
 * has no focusable descendant to receive focus in the first place).
 * Images come
 * from the admin-managed /auth-gallery list (lib/auth-gallery/queries.ts)
 * — the page decides whether to render this at all via
 * getAuthGallerySettings().isEnabled. `prefers-reduced-motion` is already
 * handled globally in globals.css (collapses every animation to a single
 * frame), so no separate reduced-motion branch is needed here.
 */
export function AuthGallery({ images, className }: { images: AuthGalleryImage[]; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => splitIntoRows(images, 3), [images]);

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

  if (rows.length === 0) return null;

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className={cn("group/gallery overflow-hidden", className)}
    >
      <div className="flex h-full flex-col justify-center gap-4 opacity-55 transition-opacity group-hover/gallery:opacity-80">
        {rows.map((row, i) => (
          // Mobile keeps only the first two rows — a shorter, lighter strip
          // that prioritizes the form, per spec ("giảm số hàng... trên mobile").
          <div key={i} className={cn("flex-1 min-h-0", i === 2 && "hidden sm:block")}>
            <Row images={row} durationSeconds={ROW_DURATIONS_S[i % ROW_DURATIONS_S.length]} />
          </div>
        ))}
      </div>
    </div>
  );
}
