"use client";

import { cn } from "@/lib/utils";
import { ZMarkIcon } from "./z-mark-icon";
import type { DashboardMarqueeFontSize, DashboardMarqueeTextStyle } from "@/types/dashboard";

const REPEAT_COUNT = 16; // generous enough to overflow any realistic Dashboard width, so the 50%-translate loop never shows a gap

const FONT_SIZE_CLASSES: Record<DashboardMarqueeFontSize, { text: string; icon: string; padY: string }> = {
  sm: { text: "text-sm", icon: "size-3.5", padY: "py-2.5" },
  md: { text: "text-base", icon: "size-4", padY: "py-3" },
  lg: { text: "text-lg", icon: "size-5", padY: "py-3.5" },
};

function Segment({
  text,
  textClassName,
  iconClassName,
  textStyle,
}: {
  text: string;
  textClassName: string;
  iconClassName: string;
  textStyle: DashboardMarqueeTextStyle;
}) {
  return (
    <div className="flex shrink-0 items-center gap-6 pr-6" aria-hidden="true">
      {Array.from({ length: REPEAT_COUNT }).map((_, i) => (
        <span key={i} className="flex shrink-0 items-center gap-6 whitespace-nowrap">
          <span
            className={cn(
              "font-semibold tracking-wide uppercase",
              textClassName,
              textStyle === "stroke" ? "marquee-text-stroke" : "text-muted-foreground"
            )}
          >
            {text}
          </span>
          <ZMarkIcon className={cn("shrink-0 text-primary", iconClassName)} />
        </span>
      ))}
    </div>
  );
}

/**
 * Continuous right-to-left scrolling strip — shared verbatim between the
 * real Dashboard and the admin settings form's preview. The track renders
 * its content TWICE and animates exactly 50% of its own width, so the
 * loop point is seamless (no visible jump/gap). Pauses on hover/keyboard
 * focus; `prefers-reduced-motion` is already handled globally
 * (globals.css forces every animation to a single near-instant frame),
 * so this needs no reduced-motion branch of its own. Screen readers get
 * the text exactly ONCE via a visually-hidden span — the animated track
 * itself is `aria-hidden`, so the repeated copies are never announced.
 */
export function DashboardMarquee({
  text,
  speedSeconds,
  fontSize = "sm",
  textStyle = "solid",
  className,
}: {
  text: string;
  speedSeconds: number;
  fontSize?: DashboardMarqueeFontSize;
  textStyle?: DashboardMarqueeTextStyle;
  className?: string;
}) {
  const sizeClasses = FONT_SIZE_CLASSES[fontSize];
  return (
    <div
      tabIndex={0}
      role="group"
      aria-label={text}
      className={cn(
        "group relative overflow-hidden rounded-feature ring-1 ring-border/60 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        sizeClasses.padY,
        className
      )}
    >
      <span className="sr-only">{text}</span>
      <div
        aria-hidden="true"
        className="animate-marquee flex w-max group-hover:[animation-play-state:paused] group-focus:[animation-play-state:paused]"
        style={{ "--marquee-duration": `${speedSeconds}s` } as React.CSSProperties}
      >
        <Segment text={text} textClassName={sizeClasses.text} iconClassName={sizeClasses.icon} textStyle={textStyle} />
        <Segment text={text} textClassName={sizeClasses.text} iconClassName={sizeClasses.icon} textStyle={textStyle} />
      </div>
    </div>
  );
}
