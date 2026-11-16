"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DASHBOARD_BANNER_FRAME } from "@/lib/dashboard/banner-frame";

/** Shared shape consumed by both the real Dashboard carousel and the
 * admin form's live preview — whichever one renders this is guaranteed to
 * look exactly like the other, since they're the same component fed
 * either saved data or in-progress draft state. */
export interface BannerSlideData {
  title: string;
  description: string;
  ctaLabel: string;
  ctaUrl: string;
  imageUrl: string | null;
  focalX: number;
  focalY: number;
  /** Null → the desktop image above is reused for the mobile frame too. */
  mobileImageUrl: string | null;
  mobileFocalX: number;
  mobileFocalY: number;
}

function CtaLink({
  href,
  className,
  tabIndex,
  children,
}: {
  href: string;
  className?: string;
  tabIndex?: number;
  children: React.ReactNode;
}) {
  const internal = href.startsWith("/") && !href.startsWith("//");
  if (internal) {
    return (
      <Link href={href} className={className} tabIndex={tabIndex}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} tabIndex={tabIndex}>
      {children}
    </a>
  );
}

/** Renders one image layer, falling back to a plain gradient (never a
 * broken <img>) when there is no image or the URL fails to load — the one
 * place a bad/expired image path degrades gracefully instead of breaking
 * the slide's layout. */
function SlideImage({ url, focalX, focalY, alt }: { url: string | null; focalX: number; focalY: number; alt: string }) {
  const [broken, setBroken] = useState(false);
  const show = url && !broken;
  return show ? (
    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, or a local blob preview URL in the form
    <img
      src={url}
      alt={alt}
      onError={() => setBroken(true)}
      className="size-full object-cover"
      style={{ objectPosition: `${focalX}% ${focalY}%` }}
    />
  ) : (
    <div className="size-full bg-gradient-to-br from-primary/15 via-transparent to-primary/10" />
  );
}

export function BannerSlideContent({
  data,
  active = true,
  index = 0,
  total = 1,
  className,
}: {
  data: BannerSlideData;
  /** False marks a non-visible carousel slide for assistive tech — always
   * true for a standalone preview (form, single-slide contexts). */
  active?: boolean;
  index?: number;
  total?: number;
  className?: string;
}) {
  const mobileUrl = data.mobileImageUrl ?? data.imageUrl;
  const mobileFocalX = data.mobileImageUrl ? data.mobileFocalX : data.focalX;
  const mobileFocalY = data.mobileImageUrl ? data.mobileFocalY : data.focalY;

  return (
    // `@container` keys every `@sm:` below to THIS element's own rendered
    // width, not the viewport — this is what the form's live preview and
    // the real Dashboard carousel share: both get the desktop (2:1) layout
    // only once they're actually wide enough to show it, regardless of how
    // wide the browser window is. A plain `sm:` viewport breakpoint would
    // wrongly apply desktop sizing inside a narrow column (e.g. the form's
    // side-by-side preview) on a wide screen, overflowing the frame.
    <div className="@container w-full shrink-0">
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-xl ring-1 ring-border bg-gradient-to-br from-primary/14 via-card to-primary/6",
          DASHBOARD_BANNER_FRAME.mobile.aspectClass,
          DASHBOARD_BANNER_FRAME.desktop.aspectClass,
          className
        )}
        role={total > 1 ? "group" : undefined}
        aria-roledescription={total > 1 ? "slide" : undefined}
        aria-label={total > 1 ? `${index + 1} / ${total}` : undefined}
        aria-hidden={!active}
        inert={!active}
      >
        <div className="absolute inset-0 @sm:hidden">
          <SlideImage url={mobileUrl} focalX={mobileFocalX} focalY={mobileFocalY} alt="" />
        </div>
        <div className="absolute inset-0 hidden @sm:block">
          <SlideImage url={data.imageUrl} focalX={data.focalX} focalY={data.focalY} alt="" />
        </div>

        {/* Scrim — keeps text legible over an arbitrary photo, lighter on
            the right so the image itself still reads. */}
        <div className="absolute inset-0 bg-gradient-to-r from-background/92 via-background/60 to-background/10 @sm:from-background/88 @sm:via-background/45 @sm:to-transparent" />

        <div className="relative z-10 flex h-full flex-col justify-center gap-2 p-4 @sm:gap-3 @sm:p-6 max-w-[90%] @sm:max-w-[55%]">
          <span className="inline-flex w-fit items-center rounded-md bg-gradient-to-r from-primary to-accent px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
            Creative Hub
          </span>
          <h2 className="font-heading text-lg @sm:text-xl @xl:text-2xl font-bold tracking-tight text-balance line-clamp-2">
            {data.title || "Tiêu đề banner"}
          </h2>
          {data.description && (
            <p className="hidden text-sm text-muted-foreground max-w-sm line-clamp-2 @sm:block">{data.description}</p>
          )}
          {data.ctaLabel && data.ctaUrl && (
            <CtaLink
              href={data.ctaUrl}
              tabIndex={active ? 0 : -1}
              className="group mt-1 flex w-fit items-center gap-1 rounded-sm text-sm font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {data.ctaLabel}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </CtaLink>
          )}
        </div>
      </div>
    </div>
  );
}
