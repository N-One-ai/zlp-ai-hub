"use client";

import { Sparkle } from "lucide-react";
import { cn } from "@/lib/utils";

const REPEAT_COUNT = 16; // generous enough to overflow any realistic Dashboard width, so the 50%-translate loop never shows a gap

function Segment({ text }: { text: string }) {
  return (
    <div className="flex shrink-0 items-center gap-6 pr-6" aria-hidden="true">
      {Array.from({ length: REPEAT_COUNT }).map((_, i) => (
        <span key={i} className="flex shrink-0 items-center gap-6 whitespace-nowrap">
          <span className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{text}</span>
          <Sparkle className="size-3.5 shrink-0 text-primary" />
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
  className,
}: {
  text: string;
  speedSeconds: number;
  className?: string;
}) {
  return (
    <div
      tabIndex={0}
      role="group"
      aria-label={text}
      className={cn(
        "group relative overflow-hidden rounded-feature py-2.5 ring-1 ring-border/60 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <span className="sr-only">{text}</span>
      <div
        aria-hidden="true"
        className="animate-marquee flex w-max group-hover:[animation-play-state:paused] group-focus:[animation-play-state:paused]"
        style={{ "--marquee-duration": `${speedSeconds}s` } as React.CSSProperties}
      >
        <Segment text={text} />
        <Segment text={text} />
      </div>
    </div>
  );
}
