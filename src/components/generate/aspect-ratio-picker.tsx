"use client";

import { cn } from "@/lib/utils";

// Exactly the 9 values Marketing Studio's real API accepts (confirmed via
// its own 422 enum-validation error — see marketing-studio-provider.ts),
// never an arbitrary ratio. Ordered widest-landscape to narrowest-portrait
// with "auto" first, same scannable progression as HiggsfieldSizePicker.
export const MARKETING_STUDIO_ASPECT_RATIOS = ["auto", "21:9", "16:9", "3:2", "4:3", "1:1", "3:4", "2:3", "9:16"] as const;
export type MarketingStudioAspectRatio = (typeof MARKETING_STUDIO_ASPECT_RATIOS)[number];

const ICON_MAX_PX = 22;

function RatioIcon({ ratio, selected }: { ratio: MarketingStudioAspectRatio; selected: boolean }) {
  if (ratio === "auto") {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-[3px] border-2 border-dashed border-current text-[9px] font-semibold",
          selected ? "opacity-100" : "opacity-70"
        )}
        style={{ width: ICON_MAX_PX, height: ICON_MAX_PX }}
      >
        ?
      </span>
    );
  }
  const [w, h] = ratio.split(":").map(Number);
  const isWide = w >= h;
  const width = isWide ? ICON_MAX_PX : Math.round(ICON_MAX_PX * (w / h));
  const height = isWide ? Math.round(ICON_MAX_PX * (h / w)) : ICON_MAX_PX;
  return (
    <span
      aria-hidden="true"
      className={cn("shrink-0 rounded-[3px] border-2 border-current", selected ? "opacity-100" : "opacity-70")}
      style={{ width, height }}
    />
  );
}

/** Visual, scannable aspect-ratio picker — shown only for Marketing
 * Studio, instead of a pixel-size preset picker, since that model's real
 * API takes an aspect_ratio STRING, not literal width/height. */
export function AspectRatioPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: MarketingStudioAspectRatio) => void;
}) {
  return (
    <div role="group" aria-label="Chọn tỷ lệ khung hình" className="grid grid-cols-3 min-[480px]:grid-cols-4 gap-2">
      {MARKETING_STUDIO_ASPECT_RATIOS.map((ratio) => {
        const selected = ratio === value;
        return (
          <button
            key={ratio}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(ratio)}
            className={cn(
              "flex min-h-[56px] flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "border-primary bg-primary/10 text-primary"
                : "border-input text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            )}
          >
            <RatioIcon ratio={ratio} selected={selected} />
            <span className="text-xs font-medium leading-none">{ratio === "auto" ? "Tự động" : ratio}</span>
          </button>
        );
      })}
    </div>
  );
}

export const MARKETING_STUDIO_RESOLUTIONS = ["1k", "2k", "4k"] as const;
export type MarketingStudioResolution = (typeof MARKETING_STUDIO_RESOLUTIONS)[number];

/** Resolution-tier picker — "1k"/"2k"/"4k" ONLY (the 3 values the real API
 * accepts, confirmed via its 422 enum error). No pixel number is shown
 * next to each tier: the API doesn't guarantee an exact pixel size per
 * tier/ratio combo (only "1k"+"1:1" -> 1024x1024 was independently
 * verified), so showing one here would imply a promise the API doesn't
 * make. The actually-saved asset's real size is always read from the
 * downloaded image afterward. */
export function ResolutionPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: MarketingStudioResolution) => void;
}) {
  return (
    <div role="group" aria-label="Chọn độ phân giải" className="flex gap-1.5">
      {MARKETING_STUDIO_RESOLUTIONS.map((resolution) => {
        const selected = resolution === value;
        return (
          <button
            key={resolution}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(resolution)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "border-primary bg-primary/10 text-primary"
                : "border-input text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            )}
          >
            {resolution}
          </button>
        );
      })}
    </div>
  );
}
