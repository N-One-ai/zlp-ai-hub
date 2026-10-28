"use client";

import { Label } from "@/components/ui/label";
import type { ResolvedLayer } from "@/types/design";

const FEATHER_MAX = 64;

/** Shown only for an "image" layer that went through the AI-cutout
 * pipeline (featherPx is defined — see background-removal.ts). Dragging
 * this re-renders the layer live via use-feathered-image.ts; nothing is
 * re-uploaded or re-generated, it's a pure client-side recompute each
 * time, same technique as the panel used right after generation. */
export function ImageProperties({
  layer,
  onChange,
}: {
  layer: ResolvedLayer;
  onChange: (patch: Partial<ResolvedLayer>) => void;
}) {
  const featherPx = layer.featherPx ?? 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Feather viền</Label>
        <span className="text-xs tabular-nums text-muted-foreground">{featherPx}px</span>
      </div>
      <input
        type="range"
        min={0}
        max={FEATHER_MAX}
        step={1}
        value={featherPx}
        onChange={(e) => onChange({ featherPx: Number(e.target.value) })}
        className="w-full accent-primary"
      />
      <p className="text-xs text-muted-foreground">0px giữ mép gốc — tăng dần để làm mềm biên, hoà ảnh vào nền.</p>
    </div>
  );
}
