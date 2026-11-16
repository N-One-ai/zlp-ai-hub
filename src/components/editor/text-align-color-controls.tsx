"use client";

import { AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TextAlign, BrandColor } from "@/types/database";

const ALIGN_LABEL: Record<TextAlign, string> = { left: "trái", center: "giữa", right: "phải" };

/** Shared align + color row — used by the "Nội dung chữ" panel's inline
 * Tagline/Subtitle controls AND (same shape) TextProperties' own color
 * picker, so there's one place that defines "how you pick a text color"
 * rather than two slightly different ones. */
export function TextAlignColorControls({
  align,
  color,
  onChangeAlign,
  onChangeColor,
  guidelineColors = [],
  disabled = false,
}: {
  align: TextAlign;
  color: string;
  onChangeAlign: (align: TextAlign) => void;
  onChangeColor: (color: string) => void;
  guidelineColors?: BrandColor[];
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        {(["left", "center", "right"] as TextAlign[]).map((a) => {
          const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
          return (
            <Button
              key={a}
              type="button"
              size="icon-sm"
              variant={align === a ? "secondary" : "ghost"}
              disabled={disabled}
              onClick={() => onChangeAlign(a)}
              aria-label={`Căn ${ALIGN_LABEL[a]}`}
            >
              <Icon className="size-3.5" />
            </Button>
          );
        })}
      </div>

      {guidelineColors.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {guidelineColors.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={`${c.name} — ${c.hex}`}
              aria-label={`Dùng màu ${c.name}`}
              disabled={disabled}
              onClick={() => onChangeColor(c.hex)}
              className={cn(
                "size-5 shrink-0 rounded-full border-2 disabled:cursor-not-allowed disabled:opacity-50",
                color.toLowerCase() === c.hex.toLowerCase() ? "border-primary" : "border-transparent"
              )}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(color) ? color : "#000000"}
          disabled={disabled}
          onChange={(e) => onChangeColor(e.target.value)}
          className="size-8 shrink-0 rounded-md border cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Input
          value={color}
          disabled={disabled}
          onChange={(e) => onChangeColor(e.target.value)}
          placeholder="#000000"
          className="font-mono text-xs"
        />
      </div>
    </div>
  );
}
