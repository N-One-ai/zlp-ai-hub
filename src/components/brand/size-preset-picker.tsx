"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SizePreset } from "@/types/brand";

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** "16:9", "1:1", "9:16"... — skipped (returns null) when the simplified
 * fraction is too large to read at a glance (an odd pixel size with no
 * clean common divisor), since a ratio like "137:91" doesn't actually
 * help anyone scan the list faster than the pixel size alone does. */
function aspectRatioLabel(width: number, height: number): string | null {
  const divisor = gcd(width, height) || 1;
  const w = width / divisor;
  const h = height / divisor;
  if (w > 40 || h > 40) return null;
  return `${w}:${h}`;
}

/** Shared size-preset select for the Create Image / Create Banner flows —
 * mirrors BrandPicker's approach. `<Select.Value>` has no built-in way to
 * mirror a matching `<Select.Item>`'s label (it falls back to the raw
 * `value`, i.e. the preset's UUID, unless given an explicit render-fn), so
 * we pass one here to always show "Tên — W × H px" in the trigger. List
 * items show the name on the main line and the pixel size as a muted
 * second line, per the brief's "dễ quét" requirement. The preset id stays
 * the `value`/`onChange` payload used for the actual request. */
export function SizePresetPicker({
  presets,
  value,
  onChange,
}: {
  presets: SizePreset[];
  value: string;
  onChange: (presetId: string) => void;
}) {
  const selected = presets.find((p) => p.id === value);

  return (
    <Select value={value || undefined} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Chọn kích thước">
          {() =>
            selected ? (
              <span className="truncate">
                {selected.name} — {selected.width} × {selected.height} px
                {aspectRatioLabel(selected.width, selected.height) && ` (${aspectRatioLabel(selected.width, selected.height)})`}
              </span>
            ) : (
              "Chọn kích thước"
            )
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {presets.map((p) => {
          const ratio = aspectRatioLabel(p.width, p.height);
          return (
            <SelectItem key={p.id} value={p.id}>
              <span className="flex flex-col py-0.5">
                <span>{p.name}</span>
                <span className="text-xs text-muted-foreground">
                  {p.width} × {p.height} px{ratio && ` · ${ratio}`}
                </span>
              </span>
            </SelectItem>
          );
        })}
        {presets.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">Chưa có preset kích thước.</div>
        )}
      </SelectContent>
    </Select>
  );
}
