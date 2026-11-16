"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DASHBOARD_FEATURE_CARD_BACKGROUNDS } from "@/lib/dashboard/banner-frame";
import type { DashboardFeatureCard } from "@/types/dashboard";

/** Shows the card's custom image when present, falling back to the
 * built-in decorative SVG art (never a broken <img>) — same
 * graceful-degradation convention as the big banner's SlideImage.
 * `defaultArt` is an ALREADY-RENDERED element (not a component
 * reference) — a Server Component caller (dashboard/page.tsx) can only
 * hand a Client Component pre-rendered JSX, never a bare function, across
 * that boundary. */
function CardArt({
  imageUrl,
  focalX,
  focalY,
  defaultArt,
}: {
  imageUrl: string | null;
  focalX: number;
  focalY: number;
  defaultArt: React.ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  if (imageUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
      <img
        src={imageUrl}
        alt=""
        onError={() => setBroken(true)}
        className="absolute inset-0 size-full scale-105 object-cover transition-transform duration-300 group-hover:scale-110"
        style={{ objectPosition: `${focalX}% ${focalY}%` }}
      />
    );
  }
  return <>{defaultArt}</>;
}

/**
 * One Dashboard feature card ("Tạo ảnh" / "Tạo banner") — shared verbatim
 * between the real Dashboard and the admin form's live preview, same
 * reasoning as BannerSlideContent for the big banner, so custom content
 * is guaranteed to look identical in both places.
 */
export function DashboardFeatureCardTile({
  card,
  icon,
  defaultArt,
  interactive = true,
}: {
  card: DashboardFeatureCard;
  /** A pre-rendered icon element, e.g. `<ImageIcon className="size-4.5" />`
   * — a ReactNode, not a component reference, so this is safe to receive
   * from a Server Component (dashboard/page.tsx) as well as from client
   * code (the admin form's preview). */
  icon: React.ReactNode;
  /** The existing decorative SVG art for this slot (ImageHeroArt /
   * BannerHeroArt), already rendered with its className — shown only
   * when there's no custom image. Same ReactNode reasoning as `icon`. */
  defaultArt: React.ReactNode;
  /** False disables navigation — used by the admin preview, which should
   * never actually follow the CTA. */
  interactive?: boolean;
}) {
  const bg = DASHBOARD_FEATURE_CARD_BACKGROUNDS[card.backgroundStyle];
  const hasCta = Boolean(card.ctaLabel && card.ctaUrl);
  const internal = card.ctaUrl.startsWith("/") && !card.ctaUrl.startsWith("//");

  const className = cn(
    "@container group relative flex flex-1 flex-col @sm:flex-row overflow-hidden rounded-feature ring-1 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all",
    bg.className
  );

  const content = (
    <>
      <div className="relative z-10 flex flex-col gap-3 p-5 @sm:py-5 @sm:pr-2 @sm:max-w-[58%]">
        <div className="flex size-10 items-center justify-center rounded-icon bg-primary text-primary-foreground shadow-sm shadow-primary/30">
          {icon}
        </div>
        <div>
          <h3 className="font-heading text-base font-semibold">{card.title || "Tiêu đề thẻ"}</h3>
          {card.description && <p className="text-sm text-muted-foreground mt-0.5">{card.description}</p>}
        </div>
        {hasCta && (
          <span className="flex items-center gap-1 text-sm font-medium text-primary mt-auto">
            {card.ctaLabel}
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        )}
      </div>
      <div className="relative z-0 h-24 @sm:h-auto @sm:w-36 shrink-0 @sm:self-stretch overflow-hidden @sm:[mask-image:linear-gradient(to_right,transparent,black_18%)]">
        <CardArt imageUrl={card.imageUrl} focalX={card.focalX} focalY={card.focalY} defaultArt={defaultArt} />
      </div>
    </>
  );

  if (!interactive || !hasCta) {
    return <div className={className}>{content}</div>;
  }
  if (internal) {
    return (
      <Link href={card.ctaUrl} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <a href={card.ctaUrl} target="_blank" rel="noopener noreferrer" className={className}>
      {content}
    </a>
  );
}
