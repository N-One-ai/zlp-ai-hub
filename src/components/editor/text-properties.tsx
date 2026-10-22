"use client";

import { AlignLeft, AlignCenter, AlignRight, Bold } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AVAILABLE_FONTS } from "@/lib/brand/fonts";
import type { ResolvedLayer } from "@/types/design";
import type { TextAlign } from "@/types/database";

export function TextProperties({
  layer,
  onChange,
}: {
  layer: ResolvedLayer;
  onChange: (patch: Partial<ResolvedLayer>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Nội dung</Label>
        <Textarea rows={2} value={layer.text ?? ""} onChange={(e) => onChange({ text: e.target.value })} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Font</Label>
        <Select
          value={layer.fontFamily ?? ""}
          onValueChange={(v) => {
            if (!v) return;
            const font = AVAILABLE_FONTS.find((f) => f.family === v);
            onChange({ fontFamily: v, fontFallback: font?.fallback });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Chọn font" />
          </SelectTrigger>
          <SelectContent>
            {AVAILABLE_FONTS.map((f) => (
              <SelectItem key={f.family} value={f.family}>
                {f.family}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Cỡ chữ</Label>
          <Input
            type="number"
            min={8}
            value={layer.fontSize ?? 24}
            onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Màu</Label>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={layer.color ?? "#000000"}
              onChange={(e) => onChange({ color: e.target.value })}
              className="size-8 rounded-md border cursor-pointer"
            />
            <Input value={layer.color ?? "#000000"} onChange={(e) => onChange({ color: e.target.value })} className="font-mono text-xs" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          size="icon-sm"
          variant={layer.fontWeight && layer.fontWeight >= 600 ? "secondary" : "ghost"}
          onClick={() => onChange({ fontWeight: layer.fontWeight && layer.fontWeight >= 600 ? 400 : 700 })}
        >
          <Bold className="size-3.5" />
        </Button>
        {(["left", "center", "right"] as TextAlign[]).map((align) => {
          const Icon = align === "left" ? AlignLeft : align === "center" ? AlignCenter : AlignRight;
          return (
            <Button
              key={align}
              size="icon-sm"
              variant={layer.align === align ? "secondary" : "ghost"}
              onClick={() => onChange({ align })}
              className={cn()}
            >
              <Icon className="size-3.5" />
            </Button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Line-height</Label>
          <Input
            type="number"
            step={0.1}
            min={0.8}
            value={layer.lineHeight ?? 1.2}
            onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Letter-spacing</Label>
          <Input
            type="number"
            step={0.5}
            value={layer.letterSpacing ?? 0}
            onChange={(e) => onChange({ letterSpacing: Number(e.target.value) })}
          />
        </div>
      </div>
    </div>
  );
}
