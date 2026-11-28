"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { BannerSlideContent } from "./banner-slide";
import type { DashboardBanner } from "@/types/dashboard";

const AUTOPLAY_MS = 6000;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);
  return reduced;
}

export function BannerCarousel({ banners }: { banners: DashboardBanner[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const total = banners.length;

  const goTo = useCallback((next: number) => setIndex(((next % total) + total) % total), [total]);
  const goNext = useCallback(() => goTo(index + 1), [goTo, index]);
  const goPrev = useCallback(() => goTo(index - 1), [goTo, index]);

  useEffect(() => {
    if (total <= 1 || paused || reducedMotion) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % total), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [total, paused, reducedMotion]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      goNext();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goPrev();
    }
  }

  return (
    <div
      ref={containerRef}
      // `h-full` is what lets this match the "Tạo ảnh"/"Tạo banner" column's
      // height via the parent grid's `items-stretch` on `lg:` and up. Below
      // `lg:` the grid collapses to a single column, so this has no taller
      // sibling to stretch against — `min-h-72` is the floor that keeps it
      // from collapsing to 0 there (same fallback value the original
      // static/no-banner hero used).
      className="relative h-full min-h-72 lg:min-h-0"
      role="region"
      aria-roledescription="carousel"
      aria-label="Banner nổi bật"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) setPaused(false);
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="h-full overflow-hidden rounded-feature">
        <div
          className="flex h-full w-full transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {banners.map((banner, i) => (
            <BannerSlideContent
              key={banner.id}
              active={i === index}
              index={i}
              total={total}
              fit="fill"
              className="rounded-none ring-0"
              data={{
                title: banner.title,
                description: banner.description,
                ctaLabel: banner.ctaLabel,
                ctaUrl: banner.ctaUrl,
                imageUrl: banner.imageUrl,
                focalX: banner.focalX,
                focalY: banner.focalY,
                mobileImageUrl: banner.mobileImageUrl,
                mobileFocalX: banner.mobileFocalX,
                mobileFocalY: banner.mobileFocalY,
              }}
            />
          ))}
        </div>
      </div>

      {total > 1 && (
        <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5">
          {banners.map((banner, i) => (
            <button
              key={banner.id}
              type="button"
              aria-label={`Đến banner ${i + 1}`}
              aria-current={i === index}
              onClick={() => goTo(i)}
              className={cn(
                "h-1.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                i === index ? "w-5 bg-primary" : "w-1.5 bg-foreground/25 hover:bg-foreground/40"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
