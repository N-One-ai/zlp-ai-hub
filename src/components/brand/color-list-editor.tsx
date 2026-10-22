"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BrandColor, ColorRole } from "@/types/database";

const ROLE_LABEL: Record<ColorRole, string> = {
  primary: "Primary",
  secondary: "Secondary",
  background: "Background",
  text: "Text",
  accent: "Accent",
};

export function ColorListEditor({ colors, onChange }: { colors: BrandColor[]; onChange: (next: BrandColor[]) => void }) {
  function update(index: number, patch: Partial<BrandColor>) {
    onChange(colors.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function remove(index: number) {
    onChange(colors.filter((_, i) => i !== index));
  }

  function add() {
    onChange([...colors, { name: "", hex: "#000000", role: "accent" }]);
  }

  return (
    <div className="flex flex-col gap-2">
      {colors.map((color, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(color.hex) ? color.hex : "#000000"}
            onChange={(e) => update(i, { hex: e.target.value })}
            className="size-8 shrink-0 rounded-md border cursor-pointer"
            aria-label="Chọn màu"
          />
          <Input
            value={color.hex}
            onChange={(e) => update(i, { hex: e.target.value })}
            placeholder="#RRGGBB"
            className="w-28 font-mono text-xs"
          />
          <Input
            value={color.name}
            onChange={(e) => update(i, { name: e.target.value })}
            placeholder="Tên màu"
            className="flex-1 min-w-0"
          />
          <Select value={color.role} onValueChange={(v) => update(i, { role: v as ColorRole })}>
            <SelectTrigger className="w-32 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ROLE_LABEL).map(([role, label]) => (
                <SelectItem key={role} value={role}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" size="icon-sm" variant="ghost" onClick={() => remove(i)}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={add} className="w-fit">
        <Plus className="size-3.5" />
        Thêm màu
      </Button>
    </div>
  );
}
