"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Loader2, RotateCw, Download, AlertTriangle, ImageIcon, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";
import type Konva from "konva";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OffscreenBannerStage } from "./offscreen-banner-stage";
import {
  createBannerSizeVariantAction,
  getCurrentDesignDocumentAction,
  exportDesign,
  setBannerThumbnailAction,
} from "@/lib/design/actions";
import { buildExportFilename } from "@/lib/design/export-filename";
import { cn } from "@/lib/utils";
import type { BannerFamilyMember } from "@/lib/design/queries";
import type { ExportFormat } from "@/types/database";
import type { ResolvedLayer } from "@/types/design";

interface RenderJob {
  layers: ResolvedLayer[];
  width: number;
  height: number;
  scale: number;
}

/**
 * Lists a banner's whole size-variant family (the root + every adapted
 * size — see getBannerFamily/createBannerSizeVariantAction) as cards with
 * a thumbnail, preset name and pixel size. "Mở" navigates to that
 * variant's OWN editor page (it's a normal, independently-editable banner
 * asset — nothing special about opening it). "Tạo lại" and "Xuất"
 * (single + batch) work WITHOUT opening the editor, reusing the exact
 * same off-screen Stage.toDataURL() → exportDesign() pipeline the real
 * "Xuất" button already uses.
 */
export function BannerVariantsPanel({
  rootId,
  currentAssetId,
  members,
  brandName,
  exportFormat,
  onRefresh,
}: {
  rootId: string;
  currentAssetId: string;
  members: BannerFamilyMember[];
  brandName: string;
  exportFormat: ExportFormat;
  onRefresh: () => void;
}) {
  const [recreatingId, setRecreatingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [batchExporting, setBatchExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [renderJob, setRenderJob] = useState<RenderJob | null>(null);
  const resolverRef = useRef<((stage: Konva.Stage) => void) | null>(null);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function captureStage(layers: ResolvedLayer[], width: number, height: number, scale: number): Promise<Konva.Stage> {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setRenderJob({ layers, width, height, scale });
    });
  }

  async function handleRecreate(member: BannerFamilyMember) {
    if (!member.sizePresetId || recreatingId) return;
    setRecreatingId(member.id);
    try {
      const result = await createBannerSizeVariantAction({ sourceAssetId: rootId, sizePresetId: member.sizePresetId });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      try {
        const scale = Math.min(1, 480 / Math.max(result.data.width, result.data.height));
        const stage = await captureStage(result.data.layers, result.data.width, result.data.height, scale);
        const dataUrl = stage.toDataURL({ mimeType: "image/png", pixelRatio: 1 });
        const blob = await (await fetch(dataUrl)).blob();
        await setBannerThumbnailAction(result.data.assetId, new File([blob], "thumbnail.png", { type: "image/png" }));
      } finally {
        setRenderJob(null);
      }
      toast.success(
        result.data.warnings.length > 0
          ? `Đã tạo lại "${member.name}" — còn cảnh báo bố cục, mở để kiểm tra.`
          : `Đã tạo lại "${member.name}".`
      );
      onRefresh();
    } finally {
      setRecreatingId(null);
    }
  }

  async function exportMember(member: BannerFamilyMember): Promise<boolean> {
    const doc = await getCurrentDesignDocumentAction(member.id);
    if (!doc) {
      toast.error(`Không tìm thấy bản thiết kế của "${member.name}".`);
      return false;
    }
    const stage = await captureStage(doc.layers, doc.width, doc.height, 1);
    try {
      const dataUrl = stage.toDataURL({
        mimeType: exportFormat === "png" ? "image/png" : "image/jpeg",
        quality: 0.92,
        pixelRatio: 1,
      });
      const bytes = new Uint8Array(await (await fetch(dataUrl)).arrayBuffer());
      const result = await exportDesign(
        { assetId: member.id, designDocumentId: doc.id, format: exportFormat, width: doc.width, height: doc.height },
        bytes
      );
      if (!result.ok) {
        toast.error(`${member.name}: ${result.error.message}`);
        return false;
      }
      if (result.data.url) {
        const a = document.createElement("a");
        a.href = result.data.url;
        a.download = buildExportFilename(brandName, member.name, member.presetName, doc.version, exportFormat);
        a.click();
      }
      return true;
    } finally {
      setRenderJob(null);
    }
  }

  async function handleExportOne(member: BannerFamilyMember) {
    if (exportingId || batchExporting) return;
    setExportingId(member.id);
    try {
      const okResult = await exportMember(member);
      if (okResult) toast.success(`Đã xuất "${member.name}".`);
    } finally {
      setExportingId(null);
    }
  }

  async function handleExportSelected() {
    if (selectedIds.size === 0 || batchExporting || exportingId) return;
    setBatchExporting(true);
    let successCount = 0;
    try {
      for (const member of members) {
        if (!selectedIds.has(member.id)) continue;
        const okResult = await exportMember(member);
        if (okResult) successCount += 1;
      }
      toast.success(`Đã xuất ${successCount}/${selectedIds.size} phiên bản đã chọn.`);
    } finally {
      setBatchExporting(false);
    }
  }

  const busy = Boolean(recreatingId || exportingId || batchExporting);

  return (
    <div className="flex flex-col gap-2">
      {members.length > 1 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{selectedIds.size} đã chọn</p>
          <Button type="button" size="sm" variant="outline" disabled={selectedIds.size === 0 || busy} onClick={handleExportSelected}>
            {batchExporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            Xuất đã chọn
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {members.map((member) => {
          const isOpen = member.id === currentAssetId;
          const selected = selectedIds.has(member.id);
          return (
            <div
              key={member.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2 py-1.5",
                isOpen ? "border-primary/50 bg-primary/5" : "border-border bg-card"
              )}
            >
              <button
                type="button"
                aria-label={selected ? "Bỏ chọn" : "Chọn để xuất hàng loạt"}
                onClick={() => toggleSelected(member.id)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                {selected ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
              </button>

              <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/40">
                {member.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                  <img src={member.thumbnailUrl} alt="" className="size-full object-cover" />
                ) : (
                  <ImageIcon className="size-4 text-muted-foreground" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">
                  {member.presetName ?? "Kích thước tuỳ chỉnh"}
                  {isOpen && <span className="ml-1 text-[10px] font-normal text-primary">· đang mở</span>}
                </p>
                <p className="truncate text-[11px] text-muted-foreground tabular-nums">
                  {member.width} × {member.height} px
                </p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {member.isOriginal && (
                    <Badge variant="outline" className="h-4 px-1 text-[10px]">
                      Gốc
                    </Badge>
                  )}
                  {member.needsReview && (
                    <Badge variant="outline" className="h-4 gap-0.5 border-warning/40 px-1 text-[10px] text-warning">
                      <AlertTriangle className="size-2.5" />
                      Cần kiểm tra
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isOpen}
                  nativeButton={false}
                  render={<Link href={`/create/banner/${member.id}`} />}
                >
                  Mở
                </Button>
                {!member.isOriginal && (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Tạo lại phiên bản này"
                    disabled={busy}
                    onClick={() => handleRecreate(member)}
                  >
                    {recreatingId === member.id ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />}
                  </Button>
                )}
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Xuất ${member.presetName ?? member.name}`}
                  disabled={busy}
                  onClick={() => handleExportOne(member)}
                >
                  {exportingId === member.id ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

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
    </div>
  );
}
