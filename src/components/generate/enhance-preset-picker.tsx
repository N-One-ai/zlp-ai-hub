"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getMarketingStudioPresets } from "@/lib/generation/actions";
import type { MarketingStudioPreset } from "@/lib/generation/providers/marketing-studio-provider";

/**
 * Marketing Studio's enhancement presets, loaded live from Higgsfield's
 * own presets endpoint the first time this picker opens — never
 * hardcoded, per the docs' own warning that preset ids/visibility change
 * over time (see fetchMarketingStudioPresets in marketing-studio-provider.ts).
 */
export function EnhancePresetPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (presetId: string, presetName: string) => void;
}) {
  const [presets, setPresets] = useState<MarketingStudioPreset[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function loadMore(fromCursor?: number) {
    setLoading(true);
    try {
      const result = await getMarketingStudioPresets(fromCursor);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setPresets((prev) => (fromCursor === undefined ? result.data.items : [...prev, ...result.data.items]));
      setCursor(result.data.nextCursor);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }

  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    void loadMore();
  }, []);

  if (!loaded && loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Đang tải danh sách preset...
      </div>
    );
  }
  if (loaded && presets.length === 0) {
    return <p className="text-sm text-muted-foreground">Không tải được danh sách preset. Thử lại sau.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto">
        {presets.map((preset) => {
          const selected = preset.id === value;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(preset.id, preset.name)}
              className={cn(
                "flex flex-col gap-1 rounded-lg border p-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "border-primary ring-2 ring-primary/40" : "border-input hover:border-foreground/30"
              )}
            >
              <span className="aspect-square w-full overflow-hidden rounded bg-muted">
                {preset.coverImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- Higgsfield CDN, not short-lived
                  <img src={preset.coverImageUrl} alt={preset.name} className="size-full object-cover" />
                )}
              </span>
              <span className="truncate px-0.5 text-[11px] leading-tight">{preset.name}</span>
            </button>
          );
        })}
      </div>
      {cursor !== null && (
        <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => loadMore(cursor)}>
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Tải thêm preset
        </Button>
      )}
    </div>
  );
}
