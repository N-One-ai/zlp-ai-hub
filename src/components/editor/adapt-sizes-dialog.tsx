"use client";

import { useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type Konva from "konva";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RatioIcon } from "@/components/brand/size-preset-cards";
import { aspectRatioLabel } from "@/components/brand/size-preset-picker";
import { OffscreenBannerStage } from "./offscreen-banner-stage";
import { createBannerSizeVariantAction, setBannerThumbnailAction } from "@/lib/design/actions";
import { cn } from "@/lib/utils";
import type { ResolvedLayer } from "@/types/design";
import type { SizePreset } from "@/types/brand";

const THUMBNAIL_MAX_PX = 480;

interface RenderJob {
  layers: ResolvedLayer[];
  width: number;
  height: number;
  scale: number;
}

/**
 * "Tạo phiên bản kích thước khác" — lets the user pick several target
 * presets at once and adapts the CURRENT banner's layout into a brand-new,
 * independently editable asset for each one (createBannerSizeVariantAction
 * does the actual scaling server-side, reusing scaleLayersToSize — never
 * an AI call). Right after each one is created, this renders a small
 * off-screen thumbnail of the scaled layout (see OffscreenBannerStage,
 * same Stage.toDataURL() the real Export button uses) and uploads it so
 * the variants list has something real to show, one variant at a time so
 * only a single hidden Konva stage is ever mounted at once.
 */
export function AdaptSizesDialog({
  open,
  onOpenChange,
  sourceAssetId,
  currentSizePresetId,
  presets,
  existingVariantPresetIds,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceAssetId: string;
  currentSizePresetId: string | null;
  presets: SizePreset[];
  /** Preset ids that already have a variant in this family — still
   * selectable (re-selecting re-adapts/updates that one, per "Tạo lại một
   * phiên bản đích"), just flagged so the user knows. */
  existingVariantPresetIds: string[];
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const [renderJob, setRenderJob] = useState<RenderJob | null>(null);
  const resolverRef = useRef<((stage: Konva.Stage) => void) | null>(null);

  const existingSet = new Set(existingVariantPresetIds);
  const selectable = presets.filter((p) => p.id !== currentSizePresetId);

  function toggle(id: string) {
    if (creating) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function captureThumbnailStage(layers: ResolvedLayer[], width: number, height: number): Promise<Konva.Stage> {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      const scale = Math.min(1, THUMBNAIL_MAX_PX / Math.max(width, height));
      setRenderJob({ layers, width, height, scale });
    });
  }

  async function handleCreate() {
    const ids = [...selected];
    if (ids.length === 0 || creating) return;
    setCreating(true);
    let createdCount = 0;
    let reviewCount = 0;
    try {
      for (let i = 0; i < ids.length; i++) {
        const presetId = ids[i];
        const preset = presets.find((p) => p.id === presetId);
        setProgress({ current: i + 1, total: ids.length, label: preset?.name ?? "" });

        const result = await createBannerSizeVariantAction({ sourceAssetId, sizePresetId: presetId });
        if (!result.ok) {
          toast.error(`${preset?.name ?? "Phiên bản"}: ${result.error.message}`);
          continue;
        }
        createdCount += 1;
        if (result.data.warnings.length > 0) reviewCount += 1;

        try {
          const stage = await captureThumbnailStage(result.data.layers, result.data.width, result.data.height);
          const dataUrl = stage.toDataURL({ mimeType: "image/png", pixelRatio: 1 });
          const blob = await (await fetch(dataUrl)).blob();
          await setBannerThumbnailAction(result.data.assetId, new File([blob], "thumbnail.png", { type: "image/png" }));
        } catch (e) {
          console.error("[AdaptSizesDialog] thumbnail", e);
        } finally {
          setRenderJob(null);
        }
      }

      if (createdCount > 0) {
        toast.success(
          reviewCount > 0
            ? `Đã tạo ${createdCount} phiên bản — ${reviewCount} phiên bản cần kiểm tra bố cục trước khi xuất.`
            : `Đã tạo ${createdCount} phiên bản.`
        );
        onDone();
        setSelected(new Set());
        onOpenChange(false);
      }
    } finally {
      setCreating(false);
      setProgress(null);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !creating && onOpenChange(v)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tạo phiên bản kích thước khác</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Chọn một hoặc nhiều kích thước đích — mỗi kích thước tạo một phiên bản riêng, giữ nguyên nội dung, logo,
            màu sắc, font và hình ảnh AI đã tạo từ thiết kế hiện tại (không tạo ảnh AI mới).
          </p>
          <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto">
            {selectable.map((p) => {
              const ratio = aspectRatioLabel(p.width, p.height);
              const alreadyExists = existingSet.has(p.id);
              const isSelected = selected.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={creating}
                  onClick={() => toggle(p.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected ? "border-primary bg-primary/10" : "border-border hover:bg-accent/50",
                    creating && "opacity-60"
                  )}
                >
                  <RatioIcon width={p.width} height={p.height} selected={isSelected} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-xs font-medium">{p.name}</span>
                    <span className="truncate text-[11px] text-muted-foreground tabular-nums">
                      {p.width} × {p.height} px{ratio ? ` · ${ratio}` : ""}
                    </span>
                    {alreadyExists && <span className="text-[11px] text-warning">Đã có phiên bản — sẽ tạo lại</span>}
                  </span>
                </button>
              );
            })}
            {selectable.length === 0 && (
              <p className="col-span-2 text-xs text-muted-foreground">Không còn preset kích thước nào khác để tạo phiên bản.</p>
            )}
          </div>
          {progress && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Đang tạo phiên bản {progress.current}/{progress.total} — {progress.label}...
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={creating} onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button type="button" disabled={creating || selected.size === 0} onClick={handleCreate}>
              {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              Tạo {selected.size > 0 ? selected.size : ""} phiên bản
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {renderJob && (
        <OffscreenBannerStage
          layers={renderJob.layers}
          width={renderJob.width}
          height={renderJob.height}
          scale={renderJob.scale}
          onReady={(stage) => {
            resolverRef.current?.(stage);
            resolverRef.current = null;
          }}
        />
      )}
    </>
  );
}
