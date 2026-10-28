"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trackEvent } from "@/lib/analytics/track";
import type { Brand } from "@/types/brand";

/** Shared brand-select control for the Create Image / Create Banner flows
 * (Task 3.0 / 4.0) — only ever lists ACTIVE brands the caller already has
 * (fetched server-side via getBrands(), RLS-scoped), never fetches
 * anything itself.
 *
 * `<Select.Value>` does not automatically mirror a matching `<Select.Item>`
 * label — without an explicit `items` map or a children render-fn it falls
 * back to printing the raw `value` (the brand's UUID). We pass a render-fn
 * here so the trigger always shows the brand name, never the id; the id
 * stays the `value`/`onChange` payload used for the actual request. */
export function BrandPicker({
  brands,
  value,
  onChange,
}: {
  brands: Brand[];
  value: string | null;
  onChange: (brandId: string) => void;
}) {
  const activeBrands = brands.filter((b) => b.status === "active");
  const selected = activeBrands.find((b) => b.id === value);

  return (
    <Select
      value={value ?? undefined}
      onValueChange={(v) => {
        if (!v) return;
        onChange(v);
        void trackEvent({ name: "brand_selected", brandId: v });
      }}
    >
      <SelectTrigger className="w-full sm:w-64">
        <SelectValue placeholder="Chọn thương hiệu">
          {() => (selected ? <span className="truncate">{selected.name}</span> : "Chọn thương hiệu")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {activeBrands.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.name}
          </SelectItem>
        ))}
        {activeBrands.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            Chưa có thương hiệu — thêm thương hiệu trong mục Thương hiệu.
          </div>
        )}
      </SelectContent>
    </Select>
  );
}
