"use client";

import { cn } from "@/lib/utils";
import { HIGGSFIELD_SIZE_OPTIONS, type HiggsfieldSizeOption } from "@/lib/generation/providers/higgsfield-sizes";

// Landscape-widest to portrait-narrowest, square in the middle — a
// scannable left-to-right progression rather than the catalog's raw
// declaration order.
const SORTED_OPTIONS = [...HIGGSFIELD_SIZE_OPTIONS].sort((a, b) => b.width / b.height - a.width / a.height);

const ICON_MAX_PX = 22;

/** Small rect sized to the option's REAL pixel ratio (not a guessed/clean
 * fraction) — accurate even for the 2 entries whose ratio isn't a clean
 * "A:B" (960x1696, 1696x960). */
function RatioIcon({ option, selected }: { option: HiggsfieldSizeOption; selected: boolean }) {
  const isWide = option.width >= option.height;
  const w = isWide ? ICON_MAX_PX : Math.round(ICON_MAX_PX * (option.width / option.height));
  const h = isWide ? Math.round(ICON_MAX_PX * (option.height / option.width)) : ICON_MAX_PX;
  return (
    <span
      aria-hidden="true"
      className={cn("shrink-0 rounded-[3px] border-2 border-current", selected ? "opacity-100" : "opacity-70")}
      style={{ width: w, height: h }}
    />
  );
}

/** Visual, scannable size picker shown ONLY when the Higgsfield model is
 * explicitly selected — exactly the 16 width_and_height values that
 * model's real API accepts (confirmed directly against the live
 * endpoint, see higgsfield-sizes.ts), instead of the generic workspace
 * size_presets dropdown. Every tile is a real <button> (native mouse +
 * keyboard operability, no extra ARIA wiring needed) in a wrapping grid.
 * `value` is the exact string sent as width_and_height, e.g. "2048x1152". */
export function HiggsfieldSizePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div role="group" aria-label="Chọn kích thước" className="grid grid-cols-3 min-[480px]:grid-cols-4 gap-2">
      {SORTED_OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "border-primary bg-primary/10 text-primary"
                : "border-input text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            )}
          >
            <RatioIcon option={option} selected={selected} />
            <span className="text-xs font-medium leading-none">{option.ratioLabel ?? "Khác"}</span>
            <span className="text-[10px] leading-none text-muted-foreground tabular-nums">
              {option.width}×{option.height}
            </span>
          </button>
        );
      })}
    </div>
  );
}
