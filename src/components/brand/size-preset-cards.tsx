"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { aspectRatioLabel } from "./size-preset-picker";
import type { SizePreset } from "@/types/brand";

const ICON_MAX_PX = 26;

/** A small rectangle oriented and roughly proportioned to the preset's
 * real width/height — never a generic square icon — so the shape itself
 * previews the aspect ratio at a glance (PRD ask: "Icon minh hoạ tỷ lệ
 * bằng hình chữ nhật đúng hướng và gần đúng tỷ lệ thực tế"). */
export function RatioIcon({ width, height, selected }: { width: number; height: number; selected: boolean }) {
  const isWide = width >= height;
  const w = isWide ? ICON_MAX_PX : Math.max(5, Math.round(ICON_MAX_PX * (width / height)));
  const h = isWide ? Math.max(5, Math.round(ICON_MAX_PX * (height / width))) : ICON_MAX_PX;
  return (
    <span
      aria-hidden="true"
      className={cn("shrink-0 rounded-[3px] border-2 border-current", selected ? "opacity-100" : "opacity-55")}
      style={{ width: w, height: h }}
    />
  );
}

/**
 * Visible, scannable size-preset chooser — every preset the workspace has
 * actually configured (never a hardcoded sample list) shown at once as
 * selectable cards, replacing the dropdown `SizePresetPicker` wherever a
 * banner's size is the primary, frequently-changed choice (the banner
 * setup form and the in-editor "Thiết lập banner" panel). Reuses the SAME
 * `SizePreset[]` data/ids as the dropdown version — this is presentation
 * only, no new preset source.
 *
 * Plain `<button>`s inside a `radiogroup` — focusable and operable by
 * keyboard (Tab + Enter/Space) with no extra wiring, and
 * `focus-visible:ring` gives a visible focus state. `flex-wrap` lets cards
 * reflow to as many rows as the container needs instead of ever
 * overflowing it horizontally.
 */
export function SizePresetCards({
  presets,
  value,
  onChange,
}: {
  presets: SizePreset[];
  value: string;
  onChange: (presetId: string) => void;
}) {
  if (presets.length === 0) {
    return <p className="text-xs text-muted-foreground">Chưa có preset kích thước.</p>;
  }

  return (
    <div role="radiogroup" aria-label="Chọn kích thước" className="flex flex-wrap gap-2">
      {presets.map((p) => {
        const selected = p.id === value;
        const ratio = aspectRatioLabel(p.width, p.height);
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(p.id)}
            className={cn(
              "flex min-w-[108px] flex-col items-center gap-1.5 rounded-lg border px-3 py-2.5 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "border-primary bg-primary/10"
                : "border-border bg-card hover:border-primary/40 hover:bg-accent/50"
            )}
          >
            <div className="relative flex h-[26px] w-full items-center justify-center">
              <RatioIcon width={p.width} height={p.height} selected={selected} />
              {selected && (
                <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-2.5" />
                </span>
              )}
            </div>
            <span className="text-xs font-medium leading-tight">{p.name}</span>
            <span className="text-[11px] leading-tight text-muted-foreground tabular-nums">
              {p.width} × {p.height} px{ratio ? ` · ${ratio}` : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
